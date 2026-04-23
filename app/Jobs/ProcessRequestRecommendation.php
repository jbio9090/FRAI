<?php

namespace App\Jobs;

use App\Models\Request as FacilityRequest;
use App\Services\RequestService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessRequestRecommendation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Keep recommendation jobs quick and bounded so they don't block the queue.
     */
    public int $tries = 2;
    public int $timeout = 80;
    public int $maxExceptions = 2;
    public bool $failOnTimeout = true;

    public function __construct(
        public FacilityRequest $request,
        public array $facilityBookings,
    ) {}

    public function backoff(): array
    {
        return [5, 15];
    }

    public function handle(RequestService $service): void
    {
        $service->recommendAction(
            ['facility_bookings' => $this->facilityBookings],
            $this->request
        );
    }
}
