<?php

namespace Tests\Feature;

use App\Enums\PriorityLevel;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\Rule;
use App\Services\AI\EmbeddingService;
use App\Services\AI\OpenRouterClient;
use App\Services\RAG\AIRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiRecommendationPromptTest extends TestCase
{
    use RefreshDatabase;

    public function test_recommendation_prompt_contains_no_advance_day_rule(): void
    {
        Rule::create([
            'rule' => 'External equipment requires conditional approval.',
            'forPolicy' => 0,
            'priority' => 0,
        ]);

        $requester = \App\Models\User::factory()->create();
        $facility = Facility::factory()->create();
        $facilityRequest = FacilityRequest::factory()->pending()->create([
            'user_id' => $requester->id,
            'title' => 'Near-term booking',
            'description' => 'Booked for tomorrow.',
            'priority_level' => PriorityLevel::Academic,
        ]);
        $facilityRequest->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => now()->addDay()->toDateString(),
            'time_start' => '09:00:00',
            'time_end' => '11:00:00',
        ]);

        $captured = null;
        $this->mock(OpenRouterClient::class, function ($mock) use (&$captured): void {
            $mock->shouldReceive('chat')
                ->once()
                ->withArgs(function ($messages) use (&$captured): bool {
                    $captured = $messages;

                    return true;
                })
                ->andReturn('{"status": "Approved", "reason": "No conflicts found for this slot."}');
        });
        $this->mock(EmbeddingService::class, function ($mock): void {
            $mock->shouldReceive('isConfigured')->andReturn(false);
        });

        app(AIRecommendationService::class)->recommend($facilityRequest->fresh());

        $this->assertNotNull($captured);
        $prompt = collect($captured)->pluck('content')->join("\n");

        $this->assertStringNotContainsStringIgnoringCase('TEMPORAL', $prompt);
        $this->assertStringNotContainsStringIgnoringCase('advance rule', $prompt);
        $this->assertStringNotContainsStringIgnoringCase('days from today', $prompt);
        $this->assertStringNotContainsStringIgnoringCase('PAST DATE', $prompt);
    }
}
