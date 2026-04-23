<?php

namespace Tests\Feature;

use App\Models\ChatbotInteractionLog;
use App\Models\User;
use App\Services\RAG\FaqMatchingService;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Psr\Http\Message\ResponseInterface;
use Tests\TestCase;

class ChatFaqBehaviorTest extends TestCase
{
    use RefreshDatabase;
    use MockeryPHPUnitIntegration;

    public function test_chat_faq_mode_returns_matched_faq_and_logs_faq_intent(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('retrieveCandidates')
            ->once()
            ->with('How can I book a room?', 5)
            ->andReturn([
                [
                    'rule_id' => 11,
                    'question' => 'How can I book a room?',
                    'answer' => 'Go to Create Request, complete details, then submit.',
                    'similarity' => 0.91,
                ],
            ]);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('How can I book a room?')
            ->andReturn([
                'rule_id' => 11,
                'question' => 'How can I book a room?',
                'answer' => 'Go to Create Request, complete details, then submit.',
                'similarity' => 0.91,
            ]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $guzzleClient = Mockery::mock('overload:' . GuzzleClient::class);
        $guzzleResponse = Mockery::mock(ResponseInterface::class);
        $guzzleResponse->shouldReceive('getBody')->andReturn(json_encode([
            'message' => [
                'role' => 'assistant',
                'content' => 'You can start by opening Create Request, entering the details, then submitting.',
            ],
        ]));
        $guzzleClient->shouldReceive('__construct');
        $guzzleClient->shouldReceive('post')
            ->once()
            ->withArgs(function ($url, $options) {
                $payload = $options['json'] ?? [];
                $messages = $payload['messages'] ?? [];
                $fullPrompt = collect($messages)
                    ->map(fn($m) => (string) ($m['content'] ?? ''))
                    ->implode("\n");

                return str_contains((string) $url, '/api/chat')
                    && str_contains($fullPrompt, 'FAQ SNIPPETS:')
                    && str_contains($fullPrompt, 'Go to Create Request, complete details, then submit.')
                    && !str_contains($fullPrompt, 'How can I book a room?');
            })
            ->andReturn($guzzleResponse);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'user', 'content' => 'How can I book a room?'],
                ],
                'faq_mode' => true,
            ]);

        $response->assertOk();
        $response->assertJsonPath('message.content', 'You can start by opening Create Request, entering the details, then submitting.');
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.status', 'grounded_answer');
        $response->assertJsonPath('deterministic.faq_mode', true);

        $log = ChatbotInteractionLog::query()->latest()->first();
        $this->assertNotNull($log);
        $this->assertSame('faq_answer', $log->interaction_type);
        $this->assertSame('faq', $log->intent);
        $this->assertSame(11, (int) ($log->context_data['faq_match_rule_id'] ?? 0));
        $this->assertTrue((bool) ($log->context_data['faq_mode'] ?? false));
        $this->assertFalse((bool) ($log->context_data['faq_paraphrased'] ?? false));
    }

    public function test_chat_auto_matches_faq_in_normal_chat_mode(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('What is the maximum file size for attachments?')
            ->andReturn([
                'rule_id' => 5,
                'question' => 'What is the maximum file size for attachments?',
                'answer' => 'Each upload is limited to 10MB.',
                'similarity' => 0.86,
            ]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'user', 'content' => 'What is the maximum file size for attachments?'],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('message.content', 'Each upload is limited to 10MB.');
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.faq_mode', false);
    }

    public function test_faq_mode_low_confidence_returns_clarification_first(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('retrieveCandidates')
            ->once()
            ->with('Tell me something else', 5)
            ->andReturn([
                [
                    'rule_id' => 19,
                    'question' => 'How do I contact the GSO office?',
                    'answer' => 'You can send an email to plvgso@example.com.',
                    'similarity' => 0.41,
                ],
            ]);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('Tell me something else')
            ->andReturn(null);
        $faqMatcher->shouldReceive('suggestNearMatch')
            ->once()
            ->with('Tell me something else')
            ->andReturn([
                'rule_id' => 19,
                'question' => 'How do I contact the GSO office?',
                'answer' => 'You can send an email to plvgso@example.com.',
                'similarity' => 0.41,
                'match_type' => 'semantic',
            ]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $guzzleClient = Mockery::mock('overload:' . GuzzleClient::class);
        $guzzleResponse = Mockery::mock(ResponseInterface::class);
        $guzzleResponse->shouldReceive('getBody')->andReturn(json_encode([
            'message' => [
                'role' => 'assistant',
                'content' => 'Do you want contact details for the GSO office? Did you mean: "How do I contact the GSO office?"',
            ],
        ]));
        $guzzleClient->shouldReceive('__construct');
        $guzzleClient->shouldReceive('post')->once()->andReturn($guzzleResponse);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'user', 'content' => 'Tell me something else'],
                ],
                'faq_mode' => true,
            ]);

        $response->assertOk();
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.status', 'needs_clarification');
        $response->assertJsonPath('deterministic.faq_mode', true);

        $log = ChatbotInteractionLog::query()->latest()->first();
        $this->assertNotNull($log);
        $this->assertTrue((bool) ($log->context_data['faq_mode'] ?? false));
        $this->assertTrue((bool) ($log->context_data['faq_clarifier_asked'] ?? false));
    }

    public function test_faq_mode_low_confidence_after_clarifier_returns_no_match(): void
    {
        $user = User::factory()->create();
        Cache::put('chat_faq_state_' . $user->id, [
            'clarifier_asked' => true,
            'anchor_key' => 'rule:19',
        ], now()->addMinutes(15));

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('retrieveCandidates')
            ->once()
            ->with('Tell me something else', 5)
            ->andReturn([
                [
                    'rule_id' => 19,
                    'question' => 'How do I contact the GSO office?',
                    'answer' => 'You can send an email to plvgso@example.com.',
                    'similarity' => 0.41,
                ],
            ]);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('Tell me something else')
            ->andReturn(null);
        $faqMatcher->shouldReceive('suggestNearMatch')
            ->once()
            ->with('Tell me something else')
            ->andReturn([
                'rule_id' => 19,
                'question' => 'How do I contact the GSO office?',
                'answer' => 'You can send an email to plvgso@example.com.',
                'similarity' => 0.41,
                'match_type' => 'semantic',
            ]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $guzzleClient = Mockery::mock('overload:' . GuzzleClient::class);
        $guzzleClient->shouldReceive('__construct')->never();
        $guzzleClient->shouldReceive('post')->never();

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'user', 'content' => 'Tell me something else'],
                ],
                'faq_mode' => true,
            ]);

        $response->assertOk();
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.status', 'no_match');
        $response->assertJsonPath('deterministic.faq_mode', true);

        $log = ChatbotInteractionLog::query()->latest()->first();
        $this->assertNotNull($log);
        $this->assertTrue((bool) ($log->context_data['faq_mode'] ?? false));
        $this->assertTrue((bool) ($log->context_data['faq_no_match'] ?? false));
    }

    public function test_faq_mode_ambiguous_confirmation_uses_classifier_and_resolves_suggestion(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('retrieveCandidates')
            ->once()
            ->with('ye that one', 5)
            ->andReturn([
                [
                    'rule_id' => 33,
                    'question' => 'How do i contact the GSO office?',
                    'answer' => 'You can reach out to them by sending an email to plvgso@example.com.',
                    'similarity' => 0.87,
                ],
            ]);
        $faqMatcher->shouldReceive('findByQuestion')
            ->once()
            ->with('How do i contact the GSO office?')
            ->andReturn([
                'rule_id' => 33,
                'question' => 'How do i contact the GSO office?',
                'answer' => 'You can reach out to them by sending an email to plvgso@example.com.',
                'similarity' => 1.0,
                'match_type' => 'suggestion_confirmation',
            ]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $classifierResponse = Mockery::mock(ResponseInterface::class);
        $classifierResponse->shouldReceive('getBody')->andReturn(json_encode([
            'message' => ['role' => 'assistant', 'content' => '{"intent":"confirm_suggestion"}'],
        ]));
        $faqAnswerResponse = Mockery::mock(ResponseInterface::class);
        $faqAnswerResponse->shouldReceive('getBody')->andReturn(json_encode([
            'message' => ['role' => 'assistant', 'content' => 'You can contact the GSO office by sending an email to plvgso@example.com.'],
        ]));

        $guzzleClient = Mockery::mock('overload:' . GuzzleClient::class);
        $guzzleClient->shouldReceive('__construct');
        $guzzleClient->shouldReceive('post')
            ->twice()
            ->andReturn($classifierResponse, $faqAnswerResponse);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'assistant', 'content' => 'No FAQ match found. Did you mean: "How do i contact the GSO office?"'],
                    ['role' => 'user', 'content' => 'ye that one'],
                ],
                'faq_mode' => true,
            ]);

        $response->assertOk();
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.status', 'grounded_answer');
        $response->assertJsonPath('deterministic.reason', 'suggestion_confirmation');
    }

    public function test_no_faq_match_in_normal_chat_continues_to_ai_path(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('Tell me something else')
            ->andReturn(null);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);

        $guzzleClient = Mockery::mock('overload:' . GuzzleClient::class);
        $guzzleResponse = Mockery::mock(ResponseInterface::class);
        $guzzleResponse->shouldReceive('getBody')->andReturn(json_encode([
            'message' => [
                'role' => 'assistant',
                'content' => 'AI fallback response',
            ],
        ]));

        $guzzleClient->shouldReceive('__construct');
        $guzzleClient->shouldReceive('post')->once()->andReturn($guzzleResponse);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), [
                'messages' => [
                    ['role' => 'user', 'content' => 'Tell me something else'],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('message.content', 'AI fallback response');
    }
}
