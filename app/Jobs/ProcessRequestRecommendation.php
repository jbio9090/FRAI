<?php

namespace App\Jobs;

use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Enums\RequestStatus; 
use App\Services\RAG\AIRecommendationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessRequestRecommendation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries         = 2;
    public int $timeout       = 80;
    public int $maxExceptions = 2;
    public bool $failOnTimeout = true;

    public function __construct(
        public FacilityRequest $request
    ) {}

    public function backoff(): array
    {
        return [5, 15];
    }

    public function handle(AIRecommendationService $aiService): void
    {
        $this->request->loadMissing([
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment',
        ]);

        $recommendations = $aiService->recommend($this->request);

        if (empty($recommendations)) {
            Log::warning("ProcessRequestRecommendation: no recommendations returned for Request#{$this->request->id}. Aborting.");
            return;
        }

        DB::transaction(function () use ($recommendations) {
            foreach ($recommendations as $rfId => $result) {
                /** @var RequestStatus $status */
                $status = $result['status'];
                $reason = $result['reason'] ?? '';

                RequestFacility::where('id', $rfId)->update([
                    'ai_recommended_status' => $status->value,
                    'ai_recommendation_reason' => $reason,
                ]);

                Log::info("ProcessRequestRecommendation: RequestFacility#{$rfId} → {$status->value}");
            }

            $rollupStatus = $this->deriveRollupStatus($recommendations);

            $this->request->update([
                'recommended_action' => $rollupStatus, 
            ]);

            Log::info("ProcessRequestRecommendation: Request#{$this->request->id} rolled up to → {$rollupStatus->value}");
        });
    }

    private function deriveRollupStatus(array $recommendations): RequestStatus
    {
        $statuses = array_column($recommendations, 'status');
        $uniqueStatuses = array_unique(array_map(fn($s) => $s->value, $statuses));

        if (in_array(RequestStatus::DENIED->value, $uniqueStatuses, true)) {
            return RequestStatus::DENIED;
        }

        if (count($uniqueStatuses) === 1 && $uniqueStatuses[0] === RequestStatus::APPROVED->value) {
            return RequestStatus::APPROVED;
        }

        $nonDeniedAllowed = [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value];
        if (empty(array_diff($uniqueStatuses, $nonDeniedAllowed))) {
            return RequestStatus::CONDITIONALLY_APPROVED;
        }

        if (count($uniqueStatuses) > 1) {
            return RequestStatus::PARTIALLY_APPROVED;
        }

        return RequestStatus::PENDING;
    }
}