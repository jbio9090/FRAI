<?php

namespace Tests\Feature;

use App\Enums\PriorityLevel;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\Rule;
use App\Services\AI\OpenRouterClient;
use App\Services\RAG\AIRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
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

        $prompt = $this->captureRecommendationPrompt();

        // Scoped to the service-authored region: the prompt now inlines every
        // admin-authored rule verbatim, so rule text must not be able to fail
        // an assertion about this service's own template.
        $serviceAuthored = Str::after($prompt, '===PRE-EVALUATED SIGNALS===');

        $this->assertStringNotContainsStringIgnoringCase('TEMPORAL', $serviceAuthored);
        $this->assertStringNotContainsStringIgnoringCase('advance rule', $serviceAuthored);
        $this->assertStringNotContainsStringIgnoringCase('days from today', $serviceAuthored);
        $this->assertStringNotContainsStringIgnoringCase('PAST DATE', $serviceAuthored);
    }

    public function test_prompt_contains_every_policy_rule_not_just_the_top_ten(): void
    {
        $policyRules = collect(range(1, 12))->map(fn (int $i) => Rule::create([
            'rule' => "Policy provision {$i} governing approval criteria for facility bookings.",
            'forPolicy' => 0,
            'priority' => $i,
        ]));

        $prompt = $this->captureRecommendationPrompt();

        $this->assertStringContainsString('12 total', $prompt);

        foreach ($policyRules as $rule) {
            $this->assertStringContainsString($rule->rule, $prompt);
        }
    }

    public function test_prompt_excludes_faq_rules(): void
    {
        Rule::create([
            'rule' => 'Students may only book the gymnasium during open hours.',
            'forPolicy' => 0,
            'priority' => 0,
        ]);

        Rule::create([
            'rule' => 'FAQ entry about locker key collection that must never reach the prompt.',
            'forPolicy' => 1,
            'priority' => 0,
            'faq_answer' => 'Collect the key from the front desk.',
        ]);

        $prompt = $this->captureRecommendationPrompt();

        $this->assertStringContainsString('Students may only book the gymnasium during open hours.', $prompt);
        $this->assertStringNotContainsString('FAQ entry about locker key collection', $prompt);
    }

    public function test_prompt_tells_the_model_to_ignore_rules_that_do_not_apply(): void
    {
        Rule::create([
            'rule' => 'Outdoor events require a weather contingency plan.',
            'forPolicy' => 0,
            'priority' => 0,
        ]);

        $prompt = $this->captureRecommendationPrompt();

        $this->assertStringContainsString('NOT APPLICABLE', $prompt);
        $this->assertStringNotContainsStringIgnoringCase('you MUST apply every single one', $prompt);
    }

    /**
     * Seed a pending single-facility request, stub the chat client, run the
     * recommendation, and return the full prompt text sent to the LLM.
     */
    private function captureRecommendationPrompt(): string
    {
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

        app(AIRecommendationService::class)->recommend($facilityRequest->fresh());

        $this->assertNotNull($captured);

        return collect($captured)->pluck('content')->join("\n");
    }
}
