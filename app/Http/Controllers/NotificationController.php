<?php

namespace App\Http\Controllers;

use App\Notifications\TestPushNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'subscription.endpoint' => 'required|string',
            'subscription.keys.p256dh' => 'required|string',
            'subscription.keys.auth' => 'required|string',
        ]);

        $request->user()->updatePushSubscription(
            $validated["subscription"]["endpoint"],
            $validated["subscription"]["keys"]["p256dh"],
            $validated["subscription"]["keys"]["auth"],
        );


        return redirect()->back()->with(['message' => 'Subscription saved']);
    }

    public function unsubscribe(Request $request)
    {
        $validated = $request->validate([
            'subscription.endpoint' => 'required|string',
        ]);

        $request->user()->deletePushSubscription($validated["subscription"]["endpoint"]);

        return redirect()->back()->with(['message' => 'Unsubscribed']);
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
