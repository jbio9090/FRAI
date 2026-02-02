<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Inertia\Inertia;

class GenerateBreadcrumbs
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle($request, Closure $next)
    {
        Inertia::share(
            'breadcrumbs',
            $this->generateBreadcrumbs($request),
        );

        return $next($request);
    }

    private function generateBreadcrumbs($request)
    {
        $routes = explode("/", $request->path());

        foreach($routes as $key => $route) {
            if (empty($route)) {
                unset($routes[$key]);
            }
        }

        return $routes;
    }
}
