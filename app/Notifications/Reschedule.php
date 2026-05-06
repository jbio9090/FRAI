<?php

namespace App\Notifications;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;
use Illuminate\Support\Facades\Date;
use App\Enums\RequestStatus;

class Reschedule extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected RequestStatus $status,
        protected string $facility,
        protected string $url,
        protected string $date,
        protected string $time,
    ) {}

    public function via($notifiable)
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        return (new WebPushMessage)
            ->title("This Request needs recheduling" . $this->request_title)
            ->icon('/FRAI.png')
            ->body("Another event will be ongoing on $this->facility on selected $this->date $this->time")
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
