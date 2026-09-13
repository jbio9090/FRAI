<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Jobs\ProcessRequestRecommendation;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Services\NotificationService;
use App\Services\RAG\AIRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProcessRequestRecommendationTest extends TestCase
{
    use RefreshDatabase;

    public function test_rollup_reason_is_single_concise_paragraph_for_wordy_per_facility_reasons(): void
    {
        Notification::fake();
        Permission::findOrCreate('approve requests');
        Role::findOrCreate('admin')->givePermissionTo('approve requests');
        Role::findOrCreate('Super Admin')->givePermissionTo('approve requests');

        $requester = \App\Models\User::factory()->create();
        $facility = Facility::factory()->create();
        $facilityRequest = FacilityRequest::factory()->pending()->create([
            'user_id' => $requester->id,
            'recommended_action' => null,
            'recommended_action_reason' => null,
        ]);
        $first = $facilityRequest->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => now()->addDays(5)->toDateString(),
            'time_start' => '09:00:00',
            'time_end' => '11:00:00',
        ]);
        $second = $facilityRequest->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => now()->addDays(6)->toDateString(),
            'time_start' => '09:00:00',
            'time_end' => '11:00:00',
        ]);

        $wordy = '- First very long explanation sentence about the policy with lots of extra detail and filler words. Second sentence adds even more context that is not needed for a quick scan. Third sentence keeps going with background. Fourth sentence should be cut off. Fifth sentence is definitely too much.';

        $this->mock(AIRecommendationService::class, function ($mock) use ($first, $second, $wordy) {
            $mock->shouldReceive('recommend')
                ->once()
                ->andReturn([
                    $first->id => ['status' => RequestStatus::APPROVED, 'reason' => $wordy],
                    $second->id => ['status' => RequestStatus::APPROVED, 'reason' => $wordy.' Extra unique tail sentence.'],
                ]);
        });

        (new ProcessRequestRecommendation($facilityRequest))->handle(
            app(AIRecommendationService::class),
            app(NotificationService::class),
        );

        $reason = $facilityRequest->fresh()->recommended_action_reason;

        $this->assertStringNotContainsString("\n", $reason);
        $this->assertLessThanOrEqual(3, count(preg_split('/(?<=[.!?])\s+/', $reason) ?: []));
        $this->assertLessThanOrEqual(70, str_word_count($reason));
    }
}
