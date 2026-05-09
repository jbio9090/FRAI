<?php

namespace App\Http\Controllers;

use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function __construct(
        protected AuditLogger $auditLogger
    ) {}

    public function show()
    {
        if (Auth::check()) {
            return redirect()->intended('/');
        }

        return Inertia::render('login');
    }


    public function authenticate(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::where('email', $credentials['email'])->firstOrFail();

        if ($user && !$user->is_active) {
            throw ValidationException::withMessages([
                'email' => 'Your account is inactive. Please contact support.',
            ]);
        }

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            $this->auditLogger::loginSucceeded(Auth::id(), $credentials['email']);
            return redirect()->intended('/');
        }

        $this->auditLogger::loginFailed($credentials['email']);
        return back()->withErrors([
            'email' => 'Email or password do not match',
        ])->onlyInput('email');
    }


    public function logout(Request $request)
    {
        $userId = Auth::id();
        $email  = Auth::user()->email;
        $this->auditLogger::loggedOut($userId, $email);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect("/login");
    }
}
