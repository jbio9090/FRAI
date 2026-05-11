<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Illuminate\Notifications\Events\NotificationFailed as NotificationFailedEvent;
use NotificationChannels\Fcm\FcmChannel;
use Pgvector\Laravel\Schema as PgvectorSchema;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        PgvectorSchema::register();
        $this->configureDefaults();
        $this->logNotificationFailures();
        $this->createEmptySQLliteDatabase();
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(
            fn(): ?Password => app()->isProduction()
                ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
                : null
        );
    }

    protected function createEmptySQLliteDatabase()
    {
        if (config('database.default') !== 'sqlite') {
            return;
        }

        $path = config('database.connections.sqlite.database');

        // Ignore in-memory databases (used in tests)
        if ($path === ':memory:') {
            return;
        }

        // Ensure directory exists
        $directory = dirname($path);

        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        // Create DB file if missing
        if (! file_exists($path)) {
            touch($path);
        }
    }

    protected function logNotificationFailures(): void
    {
        Event::listen(NotificationFailedEvent::class, function (NotificationFailedEvent $event): void {
            // Only log FCM channel failures here
            if ($event->channel !== FcmChannel::class) {
                return;
            }

            // The FCM channel attaches a 'report' in the event data for failed sends.
            $report = $event->data['report'] ?? null;

            Log::warning('FCM notification failed.', [
                'notifiable' => $event->notifiable->id ?? null,
                'notification' => is_object($event->notification) ? get_class($event->notification) : (string) $event->notification,
                'report' => $report,
            ]);
        });
    }
}
