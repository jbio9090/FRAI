<?php

namespace App\Http\Controllers;

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
}
