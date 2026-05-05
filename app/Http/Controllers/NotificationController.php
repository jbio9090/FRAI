<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

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

        $request->user()->notify(new class($title, $body, $url) extends Notification {
            public function __construct(
                protected string $title,
                protected string $body,
                protected string $url,
            ) {}

            public function via($notifiable): array
            {
                return [WebPushChannel::class];
            }

            public function toWebPush($notifiable, $notification): WebPushMessage
            {
                return (new WebPushMessage)
                    ->title($this->title)
                    ->body($this->body)
                    ->action('Open', 'open_url')
                    ->data(['url' => $this->url]);
            }
        });

        return redirect()->back()->with(['message' => 'Notification queued']);
    }

    
}
