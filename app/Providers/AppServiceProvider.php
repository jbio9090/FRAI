<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Pgvector\Laravel\Schema as PgvectorSchema;
use App\Mail\Transports\BrevoTransport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->extend(MailManager::class, function ($manager, $app) {
            $manager->extend('brevo', function () use ($app) {
                return new BrevoTransport(
                    config('services.brevo.api_key'),
                    config('services.brevo.sender_name', 'FRAI'),
                    config('services.brevo.sender_email', 'frai.plv@gmail.com')
                );
            });

            return $manager;
        });
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
}
