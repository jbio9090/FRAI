<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ChatSessionStore;
use App\Services\RAG\FaqMatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Tests\TestCase;

/**
 * Covers the two session boundaries around the chatbot.
 *
 * Transcript scope: the transcript used to be keyed by user id, so the history
 * followed the account across every tab and device for the length of the TTL, and
 * closing one tab wiped a conversation another tab was still showing. It is now
 * keyed by the browser session.
 *
 * CSRF recovery: the browser could only source a CSRF token from the
 * <meta name="csrf-token"> tag, which Inertia never re-renders, so every chatbot
 * POST 419'd straight after login until a full page refresh. GET /api/csrf hands
 * back a live token and a re-issued cookie so the client can recover.
 */
class ChatSessionLifecycleTest extends TestCase
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

        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')->andReturnNull();
        $faqMatcher->shouldReceive('retrieveCandidates')->andReturn([]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);
    }

    public function test_transcript_is_scoped_to_the_browser_session_not_the_account(): void
    {
        $user = User::factory()->create();

        Http::fake([
            self::PROVIDER_URL => Http::response($this->answerResponse('Assembly Hall is free at 10am.'), 200),
        ]);

        $this->actingAs($user)->postJson(route('api.chat'), $this->chatPayload('Is Assembly Hall free at 10am?'))
            ->assertOk();

        $transcript = Cache::get(app(ChatSessionStore::class)->transcriptKey());

        $this->assertIsArray($transcript);
        $this->assertSame('Assembly Hall is free at 10am.', $transcript[array_key_last($transcript)]['content']);

        // The regression guard: nothing may be left behind under a user-scoped
        // key, or the transcript leaks back across sessions and devices.
        $this->assertNull(Cache::get('chat_session_v2_'.$user->id));
    }

    public function test_clearing_the_session_removes_the_transcript(): void
    {
        $user = User::factory()->create();

        Http::fake([
            self::PROVIDER_URL => Http::response($this->answerResponse('Yes.'), 200),
        ]);

        $this->actingAs($user)->postJson(route('api.chat'), $this->chatPayload('Is it free?'))
            ->assertOk();

        $this->assertNotEmpty(Cache::get(app(ChatSessionStore::class)->transcriptKey()));

        $this->actingAs($user)->deleteJson(route('chat.session.clear'))
            ->assertOk()
            ->assertJsonPath('message', 'Session cleared.');

        $this->assertNull(Cache::get(app(ChatSessionStore::class)->transcriptKey()));
    }

    public function test_the_transcript_round_trips_through_the_session_scoped_key(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $store = $this->app->make(ChatSessionStore::class);
        $transcript = [
            ['role' => 'user', 'content' => 'Is it free?'],
            ['role' => 'assistant', 'content' => 'Yes.'],
        ];

        $store->saveTranscript($transcript);

        $this->assertSame($transcript, $store->loadTranscript());
        $this->assertStringStartsWith('chat_session_v2_', $store->transcriptKey());
    }

    public function test_the_csrf_endpoint_hands_back_a_live_token_and_reissues_the_cookie(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(route('api.csrf'));

        $response->assertOk();
        $response->assertCookie('XSRF-TOKEN');

        // The cookie — not the response body — is what the client actually reads
        // back, and it only validates under the X-XSRF-TOKEN header name.
        //
        // There is no test here for a stale token producing a 419:
        // VerifyCsrfToken::handle() short-circuits on runningUnitTests(), so
        // Laravel disables CSRF for its own feature tests. This endpoint is the
        // mechanism the client-side 419 recovery depends on, so it is what is
        // worth pinning.
        $this->assertSame(session()->token(), $response->json('token'));
    }

    public function test_a_signed_out_user_cannot_read_the_transcript(): void
    {
        User::factory()->create();

        $this->getJson(route('chat.session.get'))->assertUnauthorized();
        $this->deleteJson(route('chat.session.clear'))->assertUnauthorized();
        $this->getJson(route('api.csrf'))->assertUnauthorized();
    }

    /**
     * @param  array<string, string>  $pageContext
     * @return array<string, mixed>
     */
    private function chatPayload(string $question, array $pageContext = []): array
    {
        return [
            'messages' => [
                ['role' => 'user', 'content' => $question],
            ],
            'page_context' => $pageContext !== [] ? $pageContext : [
                'url' => 'https://gso.test/requests',
                'path' => '/requests',
                'route' => 'requests.index',
                'component' => 'requests/index',
                'title' => 'Requests - FRAI',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function answerResponse(string $content): array
    {
        return [
            'id' => 'chatcmpl-test',
            'choices' => [
                [
                    'index' => 0,
                    'message' => ['role' => 'assistant', 'content' => $content],
                    'finish_reason' => 'stop',
                ],
            ],
            'created' => 1791094551,
            'model' => 'nvidia/nemotron-3.5-lightning-30b-a3b',
        ];
    }
}
