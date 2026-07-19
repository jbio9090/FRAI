<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

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

    public function via($notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toFcm($notifiable, $notification): FcmMessage
    {
        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->title(),
                body: $this->body(),
                image: '/FRAI.png',
            )
        ))->data([
            'url' => $this->url,
            'tag' => "{$this->status->value}-".$this->request_title.Date::now()->toString(),
        ]);
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
