<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'subscription.endpoint' => 'required|string',
            'subscription.keys.p256dh' => 'required|string',
            'subscription.keys.auth' => 'required|string',
        ]);

        $subscription = $validated['subscription'];

        PushSubscription::updateOrCreate(
            [
                'user_id' => Auth::id(),
                'endpoint' => $subscription['endpoint'],
            ],
            [
                'public_key' => $subscription['keys']['p256dh'],
                'auth_token' => $subscription['keys']['auth'],
            ]
        );

        return response()->json(['message' => 'Subscription saved']);
    }

    public function unsubscribe(Request $request)
    {
        PushSubscription::where('user_id', Auth::id())->delete();

        return response()->json(['message' => 'Unsubscribed']);
    }

    public function send(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'body' => 'required|string',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $userId = $validated['user_id'] ?? Auth::id();

        $subscriptions = PushSubscription::where('user_id', $userId)->get();

        if ($subscriptions->isEmpty()) {
            return response()->json(['message' => 'No subscriptions found'], 404);
        }

        $auth = [
            'VAPID' => [
                'subject' => config('services.vapid.subject'),
                'publicKey' => config('services.vapid.public_key'),
                'privateKey' => config('services.vapid.private_key'),
            ],
        ];

        $webPush = new WebPush($auth);

        $payload = json_encode([
            'title' => $validated['title'],
            'body' => $validated['body'],
            'icon' => '/apple-touch-icon.png',
        ]);

        foreach ($subscriptions as $sub) {
            $subscription = Subscription::create([
                'endpoint' => $sub->endpoint,
                'publicKey' => $sub->public_key,
                'authToken' => $sub->auth_token,
            ]);

            $webPush->queueNotification($subscription, $payload);
        }

        $results = $webPush->flush();

        return response()->json([
            'message' => 'Notifications sent',
            'results' => $results,
        ]);
    }
}
