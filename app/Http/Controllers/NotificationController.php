<?php

namespace App\Http\Controllers;

use App\Notifications\TestPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    /**
     * Serve the Firebase web config as JavaScript for the push service worker.
     *
     * The service worker runs outside the app bundle and cannot read Inertia
     * props, so it imports this endpoint via importScripts(). These keys are
     * public by design (they ship to every browser). No auth: the worker
     * installs on first visit, including logged-out pages.
     */
    public function swConfig(): Response
    {
        $config = [
            'apiKey' => config('services.firebase.api_key'),
            'authDomain' => config('services.firebase.auth_domain'),
            'projectId' => config('services.firebase.project_id'),
            'storageBucket' => config('services.firebase.storage_bucket'),
            'messagingSenderId' => config('services.firebase.messaging_sender_id'),
            'appId' => config('services.firebase.app_id'),
            'measurementId' => config('services.firebase.measurement_id'),
        ];

        $js = 'self.__FIREBASE_CONFIG = '.json_encode($config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES).';';

        return response($js, 200, [
            'Content-Type' => 'application/javascript; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string|max:500',
            'platform' => 'nullable|string|in:web,android,ios',
        ]);

        $request->user()->registerFcmToken(
            $validated['token'],
            $validated['platform'] ?? 'web'
        );

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'Device registered for push notifications', 'active' => true]);
        }

        return redirect()->back()->with(['message' => 'Device registered for push notifications']);
    }

    public function unsubscribe(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string|max:500',
        ]);

        $request->user()->removeFcmToken($validated['token']);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'Device unregistered from push notifications', 'active' => false]);
        }

        return redirect()->back()->with(['message' => 'Device unregistered from push notifications']);
    }

    public function status(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|max:500',
        ]);

        $active = $request->user()->fcmTokens()
            ->where('token', $validated['token'])
            ->where('is_active', true)
            ->exists();

        return response()->json(['active' => $active]);
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:100',
            'body' => 'nullable|string|max:255',
            'url' => 'nullable|string|max:255',
        ]);

        $title = $validated['title'] ?? 'Test Notification';
        $body = $validated['body'] ?? 'This is a push notification test.';
        $url = $validated['url'] ?? route('dashboard');

        $request->user()->notify(new TestPushNotification($title, $body, $url));

        return redirect()->back()->with(['message' => 'Notification queued']);
    }
}
