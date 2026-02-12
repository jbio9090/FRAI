<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;

class RequestApproved extends Notification
{
    use Queueable;

    protected $request;

    public function __construct($request)
    {
        $this->request = $request;
    }

    public function via($notifiable)
    {
        return [WebPushChannel::class, 'database']; // Can use multiple channels
    }

    public function toWebPush($notifiable, $notification)
    {
        return (new WebPushMessage)
            ->title('Request Approved! 🎉')
            ->icon('/icon.png')
            ->body("Your request '{$this->request->title}' has been approved!")
            ->action('View Request', 'view_request')
            ->data(['request_id' => $this->request->id])
            ->badge('/badge.png')
            ->dir('auto')
            ->lang('en')
            ->renotify()
            ->requireInteraction()
            ->tag('request-approved')
            ->vibrate([200, 100, 200]);
    }

    // Optional: Database notification
    public function toArray($notifiable)
    {
        return [
            'request_id' => $this->request->id,
            'title' => $this->request->title,
            'message' => 'Your request has been approved'
        ];
    }
}
