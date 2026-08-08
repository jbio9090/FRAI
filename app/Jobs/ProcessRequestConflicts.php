<?php

namespace App\Jobs;

use App\Models\Request as FacilityRequest;
use App\Services\NotificationService;
use App\Services\RequestService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessRequestConflicts implements ShouldQueue, ShouldQueueAfterCommit
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 300;

    public int $maxExceptions = 2;

    public function __construct(
        public FacilityRequest $request
    ) {}

    public function backoff(): array
    {
        return [5, 15];
    }

    public function handle(RequestService $service, NotificationService $notification): void
    {
        $service->detectAndStoreConflicts($this->request);

        $this->request->loadMissing('user');

        $notification->notifyAdmin(
            $this->request->title,
            $this->request->user?->name ?? 'A user',
            (string) $this->request->id
        );
    }
}
