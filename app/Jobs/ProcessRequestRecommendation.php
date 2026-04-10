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

    public function __construct(
        public FacilityRequest $request,
        public array $facilityBookings,
    ) {}

    public function handle(RequestService $service): void
    {
        $service->recommendAction(
            ['facility_bookings' => $this->facilityBookings],
            $this->request
        );
    }
}