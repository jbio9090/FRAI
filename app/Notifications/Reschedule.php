<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use App\Notifications\Channels\LoggableFcmChannel;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\URL;
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
        $channels = ['database', LoggableFcmChannel::class];
        if (NotificationService::getUserEmailEnabled($notifiable)) {
            $channels[] = 'mail';
        }
        return $channels;
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reschedule Required: '.$this->request_title)
            ->markdown('emails.request-reschedule', [
                'requestTitle' => $this->request_title,
                'status' => $this->status->value,
                'facility' => $this->facility,
                'date' => $this->date,
                'time' => $this->time,
                'url' => $this->url,
            ]);
    }

    public function toFcm($notifiable): FcmMessage
    {
        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->title(),
                body: $this->body(),
                image: URL::to('/FRAI.png'),
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
