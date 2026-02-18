<?php

namespace App\Notifications;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;
use Illuminate\Support\Facades\Date;

class RequestOnHold extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected string $request_title,
        protected string $held_by_title,
        protected string $priority_reason,
        protected string $url,
        protected bool $is_admin = false,
    ) {}

    public function via($notifiable)
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        if ($this->is_admin) {
            $body = "Approved request \"{$this->request_title}\" has been put on hold — overridden by higher-priority request \"{$this->held_by_title}\". Reason: {$this->priority_reason}";
            $title = "⚠️ Request Put On Hold: {$this->request_title}";
        } else {
            $body = "Your request \"{$this->request_title}\" has been put on hold because a higher-priority request was submitted for the same time slot. Reason: {$this->priority_reason}";
            $title = "⏸ Your Request is On Hold";
        }

        return (new WebPushMessage)
            ->title($title)
            ->icon('/app-icon.png')
            ->body($body)
            ->action('View Request', 'view_request')
            ->options(['TTL' => 1000])
            ->data(["url" => $this->url])
            ->tag("on-hold-" . $this->request_title . Date::now()->toString());
    }
}
