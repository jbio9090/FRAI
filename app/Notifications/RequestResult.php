<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

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
        return ['database', WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title($this->request_title)
            ->icon('/FRAI.png')
            ->body($this->statusMessage())
            ->action('View your request', 'view_request')
            ->options(['TTL' => 1000])
            ->data(['url' => $this->url])
            ->tag("{$this->status->value}-".$this->request_title.Date::now()->toString());
        // ->vibrate();
        // ->data(['id' => $notification->id])
        // ->badge()
        // ->dir()
        // ->image()
        // ->lang()
        // ->renotify()
        // ->requireInteraction()
    }

    public function toDatabase($notifiable): array
    {
        return [
            'title' => $this->request_title,
            'body' => $this->statusMessage(),
            'url' => $this->url,
            'category' => 'request_result',
            'status' => $this->status->value,
        ];
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }

    private function statusMessage(): string
    {
        return match ($this->status) {
            RequestStatus::PENDING => 'Your request is currently pending review.',
            RequestStatus::APPROVED => 'Your request has been approved!',
            RequestStatus::DENIED => 'Your request has been denied.',
            RequestStatus::CONDITIONALLY_APPROVED => 'Your request has been conditionally approved.',
            RequestStatus::ON_HOLD => 'Your request has been placed on hold.',
            RequestStatus::FOR_RESCHEDULE => 'Your request needs to be rescheduled.',
            RequestStatus::PARTIALLY_APPROVED => 'Your request has been partially approved.',
        };
    }
}
