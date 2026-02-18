<?php

namespace App\Notifications;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;
use Illuminate\Support\Facades\Date;

class NewPendingRequest extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected string $user_name,
        protected string $url,
    ) {}

    public function via($notifiable)
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        return (new WebPushMessage)
            ->title($this->request_title)
            ->icon('/app-icon.png')
            ->body('Pending Request from ' . $this->user_name)
            ->action('Approve', 'approve_request')
            ->action('Deny', 'deny_request')
            ->options(['TTL' => 1000])
            ->data(["url" => $this->url])
            ->tag("pending-".$this->request_title . Date::now()->toString());
<<<<<<< Updated upstream
        // ->vibrate();
        // ->data(['id' => $notification->id])
        // ->badge()
        // ->dir()
        // ->image()
        // ->lang()
        // ->renotify()
        // ->requireInteraction()
=======
>>>>>>> Stashed changes
    }
}
