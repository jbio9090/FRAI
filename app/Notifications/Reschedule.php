<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

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
        return ['database', WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title($this->title())
            ->icon('/FRAI.png')
            ->body($this->body())
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
            'title' => $this->title(),
            'body' => $this->body(),
            'url' => $this->url,
            'category' => 'reschedule',
            'status' => $this->status->value,
        ];
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }

    private function title(): string
    {
        return 'This request needs rescheduling: '.$this->request_title;
    }

    private function body(): string
    {
        return "Another event will be ongoing on $this->facility on selected $this->date $this->time";
    }
}
