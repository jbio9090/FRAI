<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Container\Attributes\Auth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class AccountController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 10);

        $query = User::with('roles');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ILIKE', "%{$search}%")
                  ->orWhere('email', 'ILIKE', "%{$search}%");
            });
        }

        if ($sort = $request->input('sort')) {
            [$col, $dir] = explode('-', $sort) + [1 => 'asc'];
            $dir = strtolower($dir) === 'desc' ? 'desc' : 'asc';
            if (in_array($col, ['name', 'email'])) {
                $query->orderBy($col, $dir);
            }
        } else {
            $query->orderBy('name', 'asc');
        }

        $users = $query->paginate($perPage)->appends($request->query());

        // Transform collection items for the frontend
        $users->getCollection()->transform(fn($user) => [
            'id'      => $user->id,
            'name'    => $user->name,
            'email'   => $user->email,
            'role'    => $user->roles->first()?->name,
            'profile' => $user->profile,
        ]);

        return Inertia::render('accounts/index', [
            'users' => $users,
            'roles' => Role::pluck('name')->map(fn($role) => strtolower($role)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'role'     => 'required|string|exists:roles,name',
            'profile'  => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $actor = $request->user();

        // Resolve canonical role name (case-insensitive)
        $role = Role::where('name', 'ILIKE', $validated['role'])->first();
        if (! $role) {
            return back()->withErrors(['role' => 'Selected role is invalid.'])->withInput();
        }

        if ($msg = $this->canAssignRole($actor, $role->name)) {
            return back()->withErrors(['role' => $msg])->withInput();
        }

        if ($request->hasFile('profile')) {
            $path = $request->file('profile')->store('profiles', 'public');
            $validated['profile'] = basename($path);
        }

        $tempPassword = Str::random(10);
        $validated['password'] = Hash::make($tempPassword);
        $validated['force_password_change'] = true;

        $user = User::create($validated);
        $user->assignRole($role->name);

        return redirect()->route("accounts.index")
            ->with('temp_password_reset', [
                'temp_password' => $tempPassword,
                'target_user' => $user->name,
                'context' => 'create',
            ]);
    }

    /**
     * Create multiple accounts from a CSV-parsed payload.
     *
     * Expected request body:
     *   accounts: [{ name, email, role }, ...]
     *
     * Returns flash data with:
     *   batch_results.created  – successfully created accounts + temp passwords
     *   batch_results.failed   – rows that failed validation or DB insert
     */
    public function batchStore(Request $request): RedirectResponse
    {
        $request->validate([
            'accounts'          => 'required|array|min:1|max:500',
            'accounts.*.name'   => 'required|string|max:255',
            'accounts.*.email'  => 'required|email|max:255',
            'accounts.*.role'   => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    if (!Role::where('name', 'ILIKE', $value)->exists()) {
                        $fail("The selected role {$value} is invalid.");
                    }
                },
            ],
        ]);

        $created = [];
        $failed  = [];

        $actor = $request->user();

        foreach ($request->accounts as $index => $account) {
            $rowNumber = $index + 1;
            $role = Role::where('name', 'ILIKE', $account['role'])->first();

            $validator = Validator::make($account, [
                'email' => 'unique:users,email',
            ]);

            if ($validator->fails()) {
                $failed[] = [
                    'row'    => $rowNumber,
                    'name'   => $account['name'],
                    'email'  => $account['email'],
                    'reason' => 'Email already exists: ' . $account['email'],
                ];
                continue;
            }

            $alreadyCreated = collect($created)->pluck('email')->contains($account['email']);
            if ($alreadyCreated) {
                $failed[] = [
                    'row'    => $rowNumber,
                    'name'   => $account['name'],
                    'email'  => $account['email'],
                    'reason' => 'Duplicate email in CSV: ' . $account['email'],
                ];
                continue;
            }

            // role permission check (per-row)
            if ($msg = $this->canAssignRole($actor, $role->name)) {
                $failed[] = [
                    'row'    => $rowNumber,
                    'name'   => $account['name'],
                    'email'  => $account['email'],
                    'reason' => $msg,
                ];
                continue;
            }

            try {
                $tempPassword = Str::random(10);

                $user = DB::transaction(function () use ($account, $tempPassword, $role) {
                    $user = User::create([
                        'name'                  => $account['name'],
                        'email'                 => $account['email'],
                        'password'              => Hash::make($tempPassword),
                        'force_password_change' => true,
                    ]);

                    if ($role) {
                        $user->assignRole($role->name);
                    }

                    return $user;
                });

                $created[] = [
                    'name'          => $user->name,
                    'email'         => $user->email,
                    'temp_password' => $tempPassword,
                ];
            } catch (\Throwable $e) {
                $failed[] = [
                    'row'    => $rowNumber,
                    'name'   => $account['name'],
                    'email'  => $account['email'],
                    'reason' => 'Unexpected error: ' . $e->getMessage(),
                ];
            }
        }

        return redirect()
            ->route('accounts.index')
            ->with('batch_results', compact('created', 'failed'));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'role'     => 'required|string|exists:roles,name',
            'profile'  => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $actor = $request->user();

        $role = Role::where('name', 'ILIKE', $validated['role'])->first();
        if (! $role) {
            return back()->withErrors(['role' => 'Selected role is invalid.'])->withInput();
        }

        if ($msg = $this->canAssignRole($actor, $role->name)) {
            return back()->withErrors(['role' => $msg])->withInput();
        }

        if ($request->hasFile('profile')) {

            if ($user->profile && $user->profile !== 'default.png') {
                Storage::disk('public')->delete('profiles/' . $user->profile);
            }

            $path = $request->file('profile')->store('profiles', 'public');
            $user->profile = basename($path);
        }

        $updateData = [
            'name'  => $validated['name'],
            'email' => $validated['email'],
        ];

        if (!empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);
        $user->syncRoles([$role->name]);

        return redirect()->route('accounts.index');
    }

    /**
     * Check whether an actor may assign a role.
     *
     * Returns null when allowed, otherwise returns error message string.
     */
    private function canAssignRole(User $actor, string $roleName): ?string
    {
        $normalized = strtolower($roleName);

        // Disallow assigning Super Admin through the UI
        if ($normalized === 'super admin') {
            return 'Assigning the Super Admin role is not allowed through the account management interface.';
        }

        if ($actor->hasRole(['admin', 'Super Admin'])) {
            if ($normalized !== 'department head') {
                return 'Admins may only create Department Head accounts.';
            }
        } elseif ($actor->hasRole('Super Admin')) {
            if (! in_array($normalized, ['admin', 'department head'], true)) {
                return 'Super Admins may only create admin and Department Head accounts.';
            }
        } else {
            return 'You are not authorized to assign roles.';
        }

        return null;
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->profile && $user->profile !== 'default.png') {
            Storage::disk('public')->delete('profiles/' . $user->profile);
        }

        $user->delete();

        return redirect()->route('accounts.index');
    }

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        $admin = $request->user();

        if ($admin->id === $user->id) {
            return back()->withErrors([
                'error' => 'You cannot reset your own password from the account management table. Please use your profile settings.'
            ]);
        }
        $admin = $request->user();
        $tempPassword = Str::random(10);

        DB::transaction(function () use ($user, $admin, $tempPassword) {
            $user->update([
                'password' => Hash::make($tempPassword),
                'force_password_change' => true,
                'remember_token' => Str::random(60),
            ]);

            DB::table('sessions')
                ->where('user_id', $user->id)
                ->delete();

            \App\Services\AuditLogger::passwordResetInitiated($user, $admin);
        });

        return redirect()
            ->route('accounts.index')
            ->with('temp_password_reset', [
                'temp_password' => $tempPassword,
                'target_user' => $user->name,
                'context' => 'reset',
            ]);
    }
}
