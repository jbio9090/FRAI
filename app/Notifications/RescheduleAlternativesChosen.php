<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use App\Notifications\Channels\LoggableFcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\URL;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class RescheduleAlternativesChosen extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected RequestStatus $status,
        protected string $url,
        protected array $alternatives,
    ) {}

    public function via($notifiable): array
    {
        return ['database', LoggableFcmChannel::class, 'mail'];
    }

    public function toFcm($notifiable): FcmMessage
    {
        $count = collect($this->alternatives)->sum(fn ($group) => count($group['options']));

        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->title(),
                body: $this->body($count),
                image: URL::to('/FRAI.png'),
            )
        ))->data([
            'url' => $this->url,
            'tag' => "reschedule-alternatives-{$this->status->value}-{$this->request_title}.".Date::now()->toString(),
        ]);
    }

    public function toDatabase($notifiable): array
    {
        return [
            'title' => $this->title(),
            'body' => $this->body(collect($this->alternatives)->sum(fn ($g) => count($g['options']))),
            'url' => $this->url,
            'category' => 'reschedule_alternatives_chosen',
            'status' => $this->status->value,
            'alternatives' => $this->alternatives,
        ];
    }

    public function toMail($notifiable)
    {
        return (new \App\Mail\RescheduleAlternativesChosen($this->request_title, $this->url, $this->alternatives))
            ->to($notifiable->email);
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }

    private function title(): string
    {
        return 'Reschedule options available for: '.$this->request_title;
    }

    private function body(int $count): string
    {
        return "An admin has suggested {$count} reschedule option(s) for your request. View them in the app.";
    }
}
