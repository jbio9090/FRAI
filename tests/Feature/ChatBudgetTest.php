<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\RAG\FaqMatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\TestCase;

/**
 * The chat turn is one synchronous request that can call the AI provider several
 * times (tool loop plus a fallback call). nginx gives up after 60s by default,
 * so the turn is capped by the ai.chat budget and degrades to a flagged fallback
 * message instead of surfacing as a 504 Gateway Timeout.
 */
class ChatBudgetTest extends TestCase
{
    use MockeryPHPUnitIntegration;
    use RefreshDatabase;

    private const PROVIDER_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ai.provider' => 'nvidia',
            'ai.nvidia.api_key' => 'test-nvidia-key',
            'ai.nvidia.model' => 'nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b',
            'ai.nvidia.base_url' => 'https://integrate.api.nvidia.com/v1',
            'ai.chat.budget' => 40,
            'ai.chat.call_timeout' => 25,
            'ai.chat.max_rounds' => 2,
            'ai.chat.safety_margin' => 5,
        ]);

        // These tests exercise the AI tool loop, not the FAQ shortcut.
        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')->andReturnNull();
        $faqMatcher->shouldReceive('retrieveCandidates')->andReturn([]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);
    }

    /**
     * @return array<string, mixed>
     */
    private function chatPayload(string $question): array
    {
        return [
            'messages' => [
                ['role' => 'user', 'content' => $question],
            ],
            'page_context' => [
                'url' => 'https://gso.test/requests',
                'path' => '/requests',
                'route' => 'requests.index',
                'component' => 'requests/index',
                'title' => 'Requests - FRAI',
            ],
        ];
    }

    /**
     * A provider response that makes the model ask for another tool, so the
     * controller keeps looping.
     *
     * @return array<string, mixed>
     */
    private function toolCallResponse(string $callId, string $content): array
    {
        return [
            'id' => 'chatcmpl-budget',
            'choices' => [
                [
                    'index' => 0,
                    'message' => [
                        'role' => 'assistant',
                        'content' => $content,
                        'tool_calls' => [
                            [
                                'id' => $callId,
                                'type' => 'function',
                                'function' => ['name' => 'noop_tool', 'arguments' => '{}'],
                            ],
                        ],
                    ],
                    'finish_reason' => 'tool_calls',
                ],
            ],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function answerResponse(string $content): array
    {
        return [
            'id' => 'chatcmpl-budget',
            'choices' => [
                [
                    'index' => 0,
                    'message' => ['role' => 'assistant', 'content' => $content],
                    'finish_reason' => 'stop',
                ],
            ],
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5],
        ];
    }

    public function test_chat_turn_stops_at_the_configured_tool_round_cap_and_keeps_the_best_prose(): void
    {
        $user = User::factory()->create();

        // Every response asks for another tool, so only the round cap can end the
        // loop. max_rounds is 2, and the queue is deliberately longer than that.
        $queued = [
            $this->toolCallResponse('call_1', 'first'),
            $this->toolCallResponse('call_2', 'second'),
            $this->toolCallResponse('call_3', 'third'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('queue exhausted'), 200);
        });

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Which facilities are free tomorrow?'));

        $response->assertOk();

        // The loop stops after two rounds and hands back the last prose it saw
        // rather than discarding it and spending a third call on the fallback.
        // This is the regression guard for "I did not receive a response from the
        // AI provider": exhausting the rounds used to throw all of this away.
        $response->assertJsonPath('message.content', 'second');
        $response->assertJsonMissingPath('meta.budget_exceeded');
        Http::assertSentCount(2);
    }

    public function test_chat_fallback_forces_a_text_answer_when_the_tool_loop_only_returns_tool_calls(): void
    {
        $user = User::factory()->create();

        // Tool calls carrying no prose at all: the loop exhausts with nothing to
        // say, so the single fallback call has to produce the answer. That call
        // is deliberately tool-free, so the model cannot reply with yet another
        // tool call and empty content (the old 500 path).
        $queued = [
            $this->toolCallResponse('call_1', ''),
            $this->toolCallResponse('call_2', ''),
            $this->answerResponse('Here is the answer.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('queue exhausted'), 200);
        });

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Which facilities are free tomorrow?'));

        $response->assertOk();
        $response->assertJsonPath('message.content', 'Here is the answer.');
        $response->assertJsonMissingPath('meta.budget_exceeded');
        Http::assertSentCount(3);

        // The fallback must not advertise tools, otherwise the model can reply
        // with another tool call and empty content — the original 500 path.
        Http::assertSent(function ($request) {
            $body = json_decode($request->body(), true);

            return is_array($body) && ! array_key_exists('tools', $body);
        });
    }

    public function test_chat_returns_a_retry_prompt_instead_of_a_500_when_no_prose_is_produced(): void
    {
        $user = User::factory()->create();

        // Every provider response, fallback included, is a bare tool call.
        Http::fake(fn () => Http::response($this->toolCallResponse('call_x', ''), 200));

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Summarise every open request for me.'));

        // A turn that produced no prose is a soft failure, not a server error:
        // the conversation has to survive so the user can rephrase.
        $response->assertOk();
        $response->assertJsonMissingPath('error');
        $this->assertNotSame('', trim((string) $response->json('message.content')));
    }

    public function test_chat_answers_with_a_flagged_fallback_when_the_budget_is_spent(): void
    {
        $user = User::factory()->create();
        config(['ai.chat.budget' => 0]);

        Http::fake();

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Summarise every open request for me.'));

        $response->assertOk();
        $response->assertJsonPath('meta.budget_exceeded', true);
        $response->assertJsonPath('message.role', 'assistant');
        $this->assertNotSame('', trim((string) $response->json('message.content')));

        // Nothing was spent on the provider, and the caller still gets a usable
        // 200 instead of a gateway timeout.
        Http::assertNothingSent();
    }

    public function test_budget_fallback_keeps_the_question_but_not_a_fabricated_answer(): void
    {
        $user = User::factory()->create();
        config(['ai.chat.budget' => 0]);

        Http::fake();

        $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Why is my request still pending?'));

        $session = Cache::get('chat_session_v2_'.$user->id);

        $this->assertSame(
            [['role' => 'user', 'content' => 'Why is my request still pending?']],
            $session,
        );
    }

    public function test_successful_turn_is_unchanged_and_persisted(): void
    {
        $user = User::factory()->create();

        Http::fake([
            self::PROVIDER_URL => Http::response($this->answerResponse('Assembly Hall is free at 10am.'), 200),
        ]);

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat'), $this->chatPayload('Is Assembly Hall free at 10am?'));

        $response->assertOk();
        $response->assertJsonPath('message.content', 'Assembly Hall is free at 10am.');
        $response->assertJsonMissingPath('meta.budget_exceeded');

        Http::assertSentCount(1);

        $session = Cache::get('chat_session_v2_'.$user->id);

        $this->assertSame('user', $session[array_key_last($session) - 1]['role'] ?? null);
        $this->assertSame('assistant', $session[array_key_last($session)]['role'] ?? null);
        $this->assertSame('Assembly Hall is free at 10am.', $session[array_key_last($session)]['content'] ?? null);
    }
}
