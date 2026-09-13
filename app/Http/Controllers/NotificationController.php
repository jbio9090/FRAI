<?php

namespace App\Http\Controllers;

use App\Notifications\TestPushNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
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
