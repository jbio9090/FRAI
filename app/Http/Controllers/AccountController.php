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
        $archived = $request->boolean('archived');
        if ($archived) {
            $query = $query->onlyTrashed();
        }

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
            'id'        => $user->id,
            'name'      => $user->name,
            'email'     => $user->email,
            'role'      => $user->roles->first()?->name,
            'profile'   => $user->profile,
            'is_active' => $user->is_active,
            'created_at' => $user->created_at,
            'deleted_at' => $user->deleted_at,
        ]);

        return Inertia::render('accounts/index', [
            'users' => $users,
            'roles' => Role::pluck('name')->map(fn($role) => strtolower($role)),
            'archived' => $archived,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'role'     => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    if (!Role::where('name', 'ILIKE', $value)->exists()) {
                        $fail("The selected role {$value} is invalid.");
                    }
                },
            ],
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
            $stored = app(\App\Services\StorageService::class)->uploadProfileFromUploadedFile($request->file('profile'));
            $validated['profile'] = $stored;
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
            'role'     => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    if (!Role::where('name', 'ILIKE', $value)->exists()) {
                        $fail("The selected role {$value} is invalid.");
                    }
                },
            ],
            'profile'  => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $actor = $request->user();

        if ($msg = $this->canEditUser($actor, $user)) {
            return back()->withErrors(['error' => $msg])->withInput();
        }

        $role = Role::where('name', 'ILIKE', $validated['role'])->first();
        if (! $role) {
            return back()->withErrors(['role' => 'Selected role is invalid.'])->withInput();
        }

        if ($msg = $this->canAssignRole($actor, $role->name)) {
            return back()->withErrors(['role' => $msg])->withInput();
        }

        if ($request->hasFile('profile')) {
            if ($user->profile && $user->profile !== 'default.png') {
                try {
                    app(\App\Services\StorageService::class)->deleteByPath($user->profile);
                } catch (\Throwable $e) {
                    // ignore
                }
            }

            $stored = app(\App\Services\StorageService::class)->uploadProfileFromUploadedFile($request->file('profile'));
            $user->profile = $stored;
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
     * Toggle the active/inactive status of a user account.
     *
     * Rules:
     *  - Super Admins can toggle anyone except themselves.
     *  - Admins can only toggle Department Heads.
     *  - No one can toggle a Super Admin account.
     */
    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        $actor = $request->user();

        if ($msg = $this->canToggleStatus($actor, $user)) {
            return back()->withErrors(['error' => $msg]);
        }

        $user->update(['is_active' => ! $user->is_active]);

        return redirect()->route('accounts.index');
    }

    /**
     * Check whether an actor may toggle a target user's status.
     *
     * Returns null when allowed, otherwise returns an error message string.
     */
    private function canToggleStatus(User $actor, User $target): ?string
    {
        // Nobody can toggle a Super Admin
        if ($target->hasRole('Super Admin')) {
            return 'The status of a Super Admin account cannot be changed.';
        }

        // Super Admins can toggle anyone except themselves
        if ($actor->hasRole('Super Admin')) {
            if ($actor->id === $target->id) {
                return 'You cannot deactivate your own account.';
            }
            return null;
        }

        // Admins can only toggle Department Heads
        if ($actor->hasRole('admin')) {
            if ($target->hasRole('Department Head')) {
                return null;
            }
            return 'Admins may only change the status of Department Head accounts.';
        }

        return 'You are not authorized to change account status.';
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

        // Super Admins may create 'admin' and 'department head' accounts.
        if ($actor->hasRole('Super Admin')) {
            if (! in_array($normalized, ['admin', 'department head'], true)) {
                return 'Super Admins may only create admin and Department Head accounts.';
            }
        } elseif ($actor->hasRole('admin')) {
            // Regular admins may only create 'department head' accounts.
            if ($normalized !== 'department head') {
                return 'Admins may only create Department Head accounts.';
            }
        } else {
            return 'You are not authorized to assign roles.';
        }

        return null;
    }

    /**
     * Check whether an actor may edit a target user.
     *
     * Returns null when allowed, otherwise returns an error message string.
     */
    private function canEditUser(User $actor, User $target): ?string
    {
        // Allow self-edit
        if ($actor->id === $target->id) {
            return null;
        }

        // Super Admins may edit everyone
        if ($actor->hasRole('Super Admin')) {
            return null;
        }

        // Admins may only edit Department Head users (not other Admins — that requires Super Admin)
        if ($actor->hasRole('admin')) {
            $targetRoles = $target->roles->pluck('name')->map(fn($r) => strtolower($r))->toArray();
            if (in_array('department head', $targetRoles, true)) {
                return null;
            }
            return 'Admins may only edit Department Head accounts. Editing Admin accounts requires Super Admin privileges.';
        }

        return 'You are not authorized to edit accounts.';
    }

    public function destroy(User $user): RedirectResponse
    {
        // Soft-delete (archive) the user. Do not remove profile files when archiving.
        $user->delete();

        return redirect()->route('accounts.index');
    }

    /**
     * Restore a soft-deleted (archived) user.
     */
    public function restore(Request $request, $id): RedirectResponse
    {
        $actor = $request->user();
        $user = User::withTrashed()->with('roles')->findOrFail($id);

        if ($msg = $this->canEditUser($actor, $user)) {
            return back()->withErrors(['error' => $msg]);
        }

        $user->restore();

        return redirect()->route('accounts.index')->with('success', 'Account restored.');
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