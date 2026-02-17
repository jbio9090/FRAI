<?php

namespace App\Notifications;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;
use Illuminate\Support\Facades\Date;
use App\RequestStatus;

class RequestResult extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected RequestStatus $status,
        protected string $url,
    ) {}

    public function via($notifiable)
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        $status_message = ($this->status->value === RequestStatus::APPROVED->value) ? "Your request has been approved!" : "Your request has been denied";

        return (new WebPushMessage)
            ->title($this->request_title)
            ->icon('/app-icon.png')
            ->body($status_message)
            ->action('View your request', 'view_request')
            ->options(['TTL' => 1000])
            ->data(["url" => $this->url])
            ->tag("{$this->status->value}-" . $this->request_title . Date::now()->toString());
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
