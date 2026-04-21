<?php

namespace Tests\Feature;

use App\Models\ChatbotInteractionLog;
use App\Models\User;
use App\Services\RAG\FaqMatchingService;
use GuzzleHttp\Client as GuzzleClient;
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
                'content' => 'Open Create Request, fill in the needed details, then submit your request.',
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
                    && str_contains($fullPrompt, 'Source FAQ answer:')
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
        $response->assertJsonPath('message.content', 'Open Create Request, fill in the needed details, then submit your request.');
        $response->assertJsonPath('deterministic.check', 'faq');
        $response->assertJsonPath('deterministic.status', 'matched_paraphrased');
        $response->assertJsonPath('deterministic.faq_mode', true);

        $log = ChatbotInteractionLog::query()->latest()->first();
        $this->assertNotNull($log);
        $this->assertSame('faq_answer', $log->interaction_type);
        $this->assertSame('faq', $log->intent);
        $this->assertSame(11, (int) ($log->context_data['faq_match_rule_id'] ?? 0));
        $this->assertTrue((bool) ($log->context_data['faq_mode'] ?? false));
        $this->assertTrue((bool) ($log->context_data['faq_paraphrased'] ?? false));
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

    public function test_faq_mode_no_match_returns_no_match_without_ai_fallback(): void
    {
        $user = User::factory()->create();

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')
            ->once()
            ->with('Tell me something else')
            ->andReturn(null);
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
