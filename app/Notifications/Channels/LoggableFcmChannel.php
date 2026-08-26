<?php

namespace App\Notifications\Channels;

use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\MulticastSendReport;
use NotificationChannels\Fcm\FcmChannel;

class LoggableFcmChannel extends FcmChannel
{
    public function __construct(
        protected Dispatcher $events,
        protected Application $app,
    ) {}

    public function send(mixed $notifiable, Notification $notification): ?Collection
    {
        $tokens = Arr::wrap($notifiable->routeNotificationFor('fcm', $notification));

        if (empty($tokens)) {
            return null;
        }

        $notifiableId = method_exists($notifiable, 'getKey')
            ? $notifiable->getKey()
            : null;

        $context = [
            'notifiable' => get_class($notifiable),
            'id' => $notifiableId,
            'notification' => get_class($notification),
            'token_count' => count($tokens),
        ];

        Log::info('FCM send starting.', $context);

        try {
            $this->client = $this->app->make(Messaging::class);
        } catch (\Throwable $e) {
            Log::error('FCM client initialization failed.', [
                ...$context,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }

        try {
            $reports = parent::send($notifiable, $notification);

            if ($reports !== null) {
                $this->logReportFailures($reports, $context, $notifiable);
            }

            Log::info('FCM send completed.', $context);

            return $reports;
        } catch (\Throwable $e) {
            Log::error('FCM send threw an exception.', [
                ...$context,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    protected function logReportFailures(Collection $reports, array $context, mixed $notifiable): void
    {
        foreach ($reports as $report) {
            if (! $report instanceof MulticastSendReport) {
                continue;
            }

            foreach ($report->getItems() as $item) {
                if ($item->isFailure()) {
                    $error = $item->error();
                    $token = $item->target()->value();

                    Log::warning('FCM token-level failure.', [
                        ...$context,
                        'token' => strlen($token) > 24 ? substr($token, 0, 24).'…' : $token,
                        'error' => $error?->getMessage() ?? 'unknown error',
                        'error_code' => $error?->getCode(),
                        'unknown_token' => $item->messageWasSentToUnknownToken(),
                        'invalid_message' => $item->messageWasInvalid(),
                    ]);

                    if ($this->shouldRemoveToken($item)) {
                        $this->removeToken($notifiable, $token);
                    }
                }
            }
        }
    }

    protected function shouldRemoveToken($item): bool
    {
        if ($item->messageWasSentToUnknownToken()) {
            return true;
        }

        $message = strtolower($item->error()?->getMessage() ?? '');

        return str_contains($message, 'unregistered') || str_contains($message, 'device unregistered');
    }

    protected function removeToken(mixed $notifiable, string $token): void
    {
        if (! is_object($notifiable) || ! method_exists($notifiable, 'removeFcmToken')) {
            Log::warning('Unable to remove stale FCM token.', [
                'notifiable' => is_object($notifiable) ? get_class($notifiable) : gettype($notifiable),
                'token' => strlen($token) > 24 ? substr($token, 0, 24).'…' : $token,
            ]);

            return;
        }

        try {
            $notifiable->removeFcmToken($token);

            Log::info('Deactivated stale FCM token.', [
                'notifiable' => get_class($notifiable),
                'token' => strlen($token) > 24 ? substr($token, 0, 24).'…' : $token,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to deactivate stale FCM token.', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
