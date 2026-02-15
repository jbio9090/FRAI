<?php

namespace App\Notifications;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;

class NewPendingRequest extends Notification
{
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
            ->icon('/approved-icon.png')
            ->body('New Pending Request from ' . $this->user_name)
            ->action('View account', 'view_account')
            ->options(['TTL' => 1000])
            ->data(["url" => $this->url])
            ->tag("pending");
        // ->vibrate();
        // ->data(['id' => $notification->id])
        // ->badge()
        // ->dir()
        // ->image()
        // ->lang()
        // ->renotify()
        // ->requireInteraction()
    }
}
