<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequirePasswordChange
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->force_password_change) {
            if (!$request->routeIs('password.force.*') && !$request->routeIs('logout')) {
                return redirect()->route('password.force.edit');
            }
        }

        return $next($request);
    }
}