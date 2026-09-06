<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

class TestFcmDelivery extends Command
{
    protected $signature = 'fcm:test
        {user? : User ID or email. Lists active tokens and sends a test push to them}
        {--tokens= : Comma-separated raw FCM tokens to test instead of a user}
        {--title= : Notification title (default: FCM diagnostic) }
        {--body= : Notification body (default: sent from artisan fcm:test) }';

    protected $description = 'Send a test push notification via FCM and report the result for every token';

    public function handle(Messaging $messaging): int
    {
        $tokens = $this->resolveTokens();

        if (empty($tokens)) {
            $this->error('No active FCM tokens found to test.');

            return self::FAILURE;
        }

        $this->info('Testing '.count($tokens).' token(s)...');

        foreach ($tokens as $token) {
            $short = strlen($token) > 40 ? substr($token, 0, 24).'…'.substr($token, -16) : $token;
            $this->line('  • '.$short);
        }

        $message = CloudMessage::new()
            ->withNotification(Notification::create($this->option('title') ?? 'FCM diagnostic', $this->option('body') ?? 'Sent from artisan fcm:test'))
            ->withData([
                'url' => url('/dashboard'),
                'tag' => 'fcm-test-'.now()->timestamp,
            ]);

        try {
            $report = $messaging->sendMulticast($message, $tokens);
        } catch (\Throwable $e) {
            $this->error('Send threw an exception: '.$e->getMessage());
            Log::error('fcm:test threw', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Successes: '.$report->successes()->count().'   Failures: '.$report->failures()->count());

        foreach ($report->getItems() as $item) {
            $token = $item->target()->value();
            $short = strlen($token) > 40 ? substr($token, 0, 24).'…'.substr($token, -16) : $token;

            if ($item->isSuccess()) {
                $this->info('  ✅ '.$short.' — OK');

                continue;
            }

            $error = $item->error();
            $this->error('  ❌ '.$short);
            $this->line('        code:    '.($error?->getCode() ?? 'n/a'));
            $this->line('        message: '.($error?->getMessage() ?? 'n/a'));
            $this->line('        unknown_token: '.var_export($item->messageWasSentToUnknownToken(), true));
            $this->line('        invalid_message: '.var_export($item->messageWasInvalid(), true));
        }

        $this->newLine();
        $this->info('Tip: open Firebase Console → Cloud Messaging → Reports to see delivered-vs-sent counts.');
        $this->info('Tip: in Chrome, DevTools → Application → Service Workers must show an active firebase-messaging-sw.js');

        return self::SUCCESS;
    }

    protected function resolveTokens(): array
    {
        if ($raw = $this->option('tokens')) {
            return array_values(array_filter(array_map('trim', explode(',', $raw))));
        }

        $userArg = $this->argument('user');

        if (! $userArg) {
            $this->error('Provide a user ID/email or --tokens.');

            return [];
        }

        $user = is_numeric($userArg)
            ? User::find($userArg)
            : User::where('email', $userArg)->first();

        if (! $user) {
            $this->error("User not found: {$userArg}");

            return [];
        }

        $tokens = $user->activeFcmTokens()->get();

        if ($tokens->isEmpty()) {
            $this->warn("User {$user->id} ({$user->email}) has no active device tokens.");

            return [];
        }

        $this->info("User {$user->id} ({$user->email}) — ".$tokens->count().' active token(s):');

        return $tokens->pluck('token')->all();
    }
}
