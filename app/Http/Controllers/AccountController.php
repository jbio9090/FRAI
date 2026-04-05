<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Storage;

class AccountController extends Controller
{
    public function index()
    {
        $users = User::with('roles')->get()->map(fn($user) => [
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
            'role'  => $user->roles->first()?->name,
            'profile' => $user->profile,
        ]);

        return Inertia::render("accounts/index", [
            "users" => $users,
            "roles" => Role::pluck('name'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role'     => 'required|string|exists:roles,name',
            'profile'  => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        if ($request->hasFile('profile')) {
            $path = $request->file('profile')->store('profiles', 'public');
            $validated['profile'] = basename($path);
        }

        $user = User::create($validated);
        $user->assignRole($validated['role']);

        return redirect()->route("accounts.index");
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
            $updateData['password'] = bcrypt($validated['password']);
        }

        $user->update($updateData);

        $user->syncRoles([$validated['role']]);

        return redirect()->route('accounts.index');
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->profile && $user->profile !== 'default.png') {
            Storage::disk('public')->delete('profiles/' . $user->profile);
        }
        $user->delete();

        return redirect()->route('accounts.index');
    }
}
