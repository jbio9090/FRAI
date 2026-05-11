<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Notifications\Notification;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class NotificationController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'device_type' => 'nullable|string',
        ]);

        $token = $validated['token'];
        $deviceType = $validated['device_type'] ?? null;

        $user = $request->user();

        $user->fcmTokens()->updateOrCreate([
            'fcm_token' => $token,
        ], [
            'device_type' => $deviceType,
        ]);

        return redirect()->back()->with(['message' => 'FCM token saved']);
    }

    public function unsubscribe(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $token = $validated['token'];
        $user = $request->user();

        $user->fcmTokens()->where('fcm_token', $token)->delete();

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
                return [FcmChannel::class];
            }

            public function toFcm($notifiable): FcmMessage
            {
                return FcmMessage::create()
                    ->notification((new FcmNotification())->title($this->title)->body($this->body))
                    ->data(['url' => (string) $this->url]);
            }
        });

        return redirect()->back()->with(['message' => 'Notification queued']);
    }

    
}
