<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use NotificationChannels\WebPush\Events\NotificationFailed;
use NotificationChannels\WebPush\Events\NotificationSent;
use Pgvector\Laravel\Schema as PgvectorSchema;

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
        PgvectorSchema::register();
        $this->configureDefaults();
        $this->logWebPushReports();
        $this->createEmptySQLliteDatabase();
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(
            fn (): ?Password => app()->isProduction()
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

    protected function logWebPushReports(): void
    {
        Event::listen(NotificationSent::class, function (NotificationSent $event): void {
            $report = $event->report;
            $response = $report->getResponse();

            Log::info('WebPush notification accepted by push service.', [
                'subscription_id' => $event->subscription->getKey(),
                'endpoint' => str($report->getEndpoint())->limit(80)->toString(),
                'status' => $response?->getStatusCode(),
                'reason' => $report->getReason(),
            ]);
        });

        Event::listen(NotificationFailed::class, function (NotificationFailed $event): void {
            $report = $event->report;
            $response = $report->getResponse();

            Log::warning('WebPush notification rejected by push service.', [
                'subscription_id' => $event->subscription->getKey(),
                'endpoint' => str($report->getEndpoint())->limit(80)->toString(),
                'status' => $response?->getStatusCode(),
                'reason' => $report->getReason(),
                'expired' => $report->isSubscriptionExpired(),
                'response' => $report->getResponseContent(),
            ]);
        });
    }
}
