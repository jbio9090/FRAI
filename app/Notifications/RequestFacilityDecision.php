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

class RequestFacilityDecision extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $requestTitle,
        protected string $facilityName,
        protected RequestStatus $status,
        protected string $url,
        protected ?string $date = null,
        protected ?string $timeStart = null,
        protected ?string $timeEnd = null,
    ) {}

    public function via($notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    private function makeBody(): string
    {
        $base = match ($this->status) {
            RequestStatus::APPROVED => "Your booking for {$this->facilityName} has been approved.",
            RequestStatus::DENIED => "Your booking for {$this->facilityName} has been denied.",
            RequestStatus::CONDITIONALLY_APPROVED => "Your booking for {$this->facilityName} has been conditionally approved.",
            RequestStatus::FOR_RESCHEDULE => "Your booking for {$this->facilityName} needs rescheduling.",
            RequestStatus::ON_HOLD => "Your booking for {$this->facilityName} has been placed on hold.",
            RequestStatus::PENDING => "Your booking for {$this->facilityName} is pending review.",
            RequestStatus::PARTIALLY_APPROVED => "Your booking for {$this->facilityName} has a mixed decision.",
        };

        if ($this->date || ($this->timeStart && $this->timeEnd)) {
            $parts = [];
            if ($this->date) $parts[] = $this->date;
            if ($this->timeStart && $this->timeEnd) $parts[] = "{$this->timeStart}-{$this->timeEnd}";
            $base .= ' ('.implode(' ', $parts).')';
        }

        return $base;
    }

    public function toFcm($notifiable): FcmMessage
    {
        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->requestTitle,
                body: $this->makeBody(),
                image: '/FRAI.png',
            )
        ))->data([
            'url' => $this->url,
            'tag' => "facility-{$this->status->value}-".$this->facilityName.Date::now()->toString(),
        ]);
    }

    public function toDatabase($notifiable): array
    {
        return [
            'title' => $this->requestTitle,
            'body' => $this->makeBody(),
            'url' => $this->url,
            'category' => 'facility_decision',
            'status' => $this->status->value,
            'facility' => $this->facilityName,
        ];
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}
