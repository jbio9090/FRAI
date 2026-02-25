<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AccountController extends Controller
{
    public function index()
    {
        return Inertia::render("accounts/index", ["users" => User::all(["id", "name", "email"])]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create($validated);

        $user->assignRole('user');

        return redirect()->route("accounts.index");
    }

    public function destroy(User $user): RedirectResponse
    {
        $user->delete();

        return redirect()->route('accounts.index');
    }
}
