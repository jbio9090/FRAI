<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use App\Services\RequestSettingsService;

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
        $manifestPath = public_path('build/manifest.json');

        return file_exists($manifestPath)
            ? md5_file($manifestPath)
            : parent::version($request);
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
                    'profile' => $request->user()->profile,
                    'roles' => $request->user()->getRoleNames(),
                    'permissions' => $request->user()->getAllPermissions()->pluck('name'),
                    'admin_email_notifications_enabled' => $request->user()->admin_email_notifications_enabled,
                    'notification_unread_count' => $request->user()->unreadNotifications()->count(),
                ] : null,
            ],
            'breadcrumbs' => $this->getBreadcrumbs($request),
            'flash' => fn() => [
                'success' => session('success'),
                'error' => session('error'),
                'temp_password_reset' => session('temp_password_reset'),
            ],
            'requestOptions' => RequestSettingsService::all(),
            'firebaseConfig' => [
                'apiKey'            => config('services.firebase.api_key'),
                'authDomain'        => config('services.firebase.auth_domain'),
                'projectId'         => config('services.firebase.project_id'),
                'storageBucket'     => config('services.firebase.storage_bucket'),
                'messagingSenderId' => config('services.firebase.messaging_sender_id'),
                'appId'             => config('services.firebase.app_id'),
                'measurementId'     => config('services.firebase.measurement_id'),
            ],
        ]);
    }

    private function getBreadcrumbs(Request $request): array
    {
        $path = $request->path();

        // Remove leading/trailing slashes and split
        $segments = array_filter(explode('/', trim($path, '/')));

        // Filter out numeric IDs
        $breadcrumbs = array_filter($segments, function ($segment) {
            return ! is_numeric($segment);
        });

        return array_values($breadcrumbs);
    }
}
