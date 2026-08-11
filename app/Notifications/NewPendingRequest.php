<?php

namespace App\Notifications;

use App\Enums\RequestStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\URL;
use NotificationChannels\Fcm\FcmChannel;
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

class NewPendingRequest extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected string $user_name,
        protected string $url,
        protected int $request_id,
        protected int $admin_id,
        protected ?RequestStatus $recommended_action = null
    ) {}

    public function via($notifiable): array
    {
        return ['database', FcmChannel::class];
    }

    public function toFcm($notifiable): FcmMessage
    {
        $actionTitle = 'Approve';
        $routeAction = 'approve';

        if ($this->recommended_action) {
            $actionTitle = $this->recommended_action->value;

            $routeAction = match ($this->recommended_action->name) {
                'CONDITIONALLY_APPROVED' => 'conditionally_approve',
                'FOR_RESCHEDULE' => 'for_reschedule',
                'DENIED' => 'reject',
                default => 'approve',
            };
        }

        $recommendedUrl = URL::temporarySignedRoute(
            'requests.push_action', now()->addHours(24),
            ['id' => $this->request_id, 'action' => $routeAction, 'admin_id' => $this->admin_id]
        );

        $denyUrl = URL::temporarySignedRoute(
            'requests.push_action', now()->addHours(24),
            ['id' => $this->request_id, 'action' => 'reject', 'admin_id' => $this->admin_id]
        );

        return (new FcmMessage(
            notification: new FcmNotification(
                title: $this->request_title,
                body: 'Pending Request from '.$this->user_name,
                image: URL::to('/FRAI.png'),
            )
        ))->data([
            'url' => $this->url,
            'recommended_action_url' => $recommendedUrl,
            'deny_url' => $denyUrl,
            'action_title' => $actionTitle,
            'tag' => 'pending-'.$this->request_title.Date::now()->toString(),
        ]);
    }

    public function toDatabase($notifiable): array
    {
        return [
            'title' => $this->request_title,
            'body' => 'Pending Request from '.$this->user_name,
            'url' => $this->url,
            'request_id' => $this->request_id,
            'category' => 'new_pending_request',
            'status' => RequestStatus::PENDING->value,
        ];
    }

    public function toArray($notifiable): array
    {
        return $this->toDatabase($notifiable);
    }
}
