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
        // Use a match expression to assign the correct message based on the Enum case
        $status_message = match ($this->status) {
            RequestStatus::PENDING => "Your request is currently pending review.",
            RequestStatus::APPROVED => "Your request has been approved!",
            RequestStatus::DENIED => "Your request has been denied.",
            RequestStatus::CONDITIONALLY_APPROVED => "Your request has been conditionally approved.",
            RequestStatus::ON_HOLD => "Your request has been placed on hold.",
            RequestStatus::FOR_RESCHEDULE => "Your request needs to be rescheduled.",
        };

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
