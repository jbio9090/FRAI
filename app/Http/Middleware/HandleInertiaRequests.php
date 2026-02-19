<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'roles' => $request->user()->getRoleNames(),
                    'permissions' => $request->user()->getAllPermissions()->pluck('name'),

                ] : null,
            ],
            'breadcrumbs' => $this->getBreadcrumbs($request),
            "csrfToken" => csrf_token(),
        ]);
    }


    private function getBreadcrumbs(Request $request): array
    {
        $path = $request->path();

        // Remove leading/trailing slashes and split
        $segments = array_filter(explode('/', trim($path, '/')));

        // Filter out numeric IDs
        $breadcrumbs = array_filter($segments, function ($segment) {
            return !is_numeric($segment);
        });

        return array_values($breadcrumbs);
    }
}
