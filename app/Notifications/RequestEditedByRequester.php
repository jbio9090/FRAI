<?php

namespace App\Notifications;

use App\Notifications\Channels\LoggableFcmChannel;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\URL;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class RequestEditedByRequester extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected string $user_name,
        protected string $url,
        protected int $request_id,
        protected string $status,
    ) {}

    public function via($notifiable): array
    {
        return ['database', LoggableFcmChannel::class];
    }

    public function toFcm($notifiable): FcmMessage
    {
        $statusLabel = $this->status === 'for_reschedule'
            ? 'For Reschedule'
            : 'Pending';

        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->request_title,
                body: "Request edited by {$this->user_name} ({$statusLabel})",
                image: URL::to('/FRAI.png'),
            )
        ))->data([
            'url' => $this->url,
            'tag' => "request-edited-{$this->status}-{$this->request_id}.".Date::now()->toString(),
            'category' => 'request_edited',
            'status' => $this->status,
        ]);
    }

    public function toDatabase($notifiable): array
    {
        $statusLabel = $this->status === 'for_reschedule'
            ? 'For Reschedule'
            : 'Pending';

        return [
            'title' => $this->request_title,
            'body' => "Request edited by {$this->user_name} ({$statusLabel})",
            'url' => $this->url,
            'request_id' => $this->request_id,
            'category' => 'request_edited',
            'status' => $this->status,
        ];
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}
