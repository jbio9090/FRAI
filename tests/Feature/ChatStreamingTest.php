<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Request as RequestModel;
use App\Models\User;
use App\Services\RAG\FaqMatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Mockery;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Covers the SSE chat endpoint (POST /chat/stream).
 *
 * The browser previously got one opaque JSON blob from POST /chat and learned
 * nothing until the whole turn finished, which read as "it never responded".
 * These assertions pin the event sequence that fixes that: a progress event
 * immediately, a `tool` event per tool the agent runs, then the answer.
 */
class ChatStreamingTest extends TestCase
{
    use MockeryPHPUnitIntegration;
    use RefreshDatabase;

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
            'ai.chat.max_rounds' => 4,
            'ai.chat.safety_margin' => 5,
        ]);

        // These exercise the AI tool loop, not the FAQ shortcut.
        $faqMatcher = Mockery::mock(FaqMatchingService::class);
        $faqMatcher->shouldReceive('match')->andReturnNull();
        $faqMatcher->shouldReceive('retrieveCandidates')->andReturn([]);
        $this->app->instance(FaqMatchingService::class, $faqMatcher);
    }

    /**
     * @return array<string, mixed>
     */
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
     * Runs the chat turn and returns the tool result fed back to the model on the
     * round after the tool call, decoded.
     *
     * @return array<string, mixed>
     */
    private function toolResultFromRun(\App\Models\User $user, string $question, array $pageContext = []): array
    {
        $queued = [
            $this->toolCallResponse('call_1', '', '{"page":true}'),
            $this->answerResponse('done'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload($question, $pageContext))
            ->assertOk()
            ->streamedContent();

        $roundTwo = [];
        $round = 0;

        Http::assertSent(function ($request) use (&$roundTwo, &$round) {
            $round++;
            $body = json_decode($request->body(), true);

            if ($round === 2) {
                $roundTwo = $body['messages'] ?? [];
            }

            return true;
        });

        foreach ($roundTwo as $message) {
            if (is_array($message) && ($message['role'] ?? null) === 'tool') {
                $decoded = json_decode((string) $message['content'], true);

                return is_array($decoded) ? $decoded : [];
            }
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function toolCallResponse(string $callId, string $content = '', string $arguments = '{"page":true}', string $toolName = 'get_page_context'): array
    {
        return [
            'id' => 'chatcmpl-stream',
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
                                'function' => ['name' => $toolName, 'arguments' => $arguments],
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
            'id' => 'chatcmpl-stream',
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

    /**
     * Decodes an SSE body into the ordered list of emitted event payloads.
     *
     * @return array<int, array<string, mixed>>
     */
    private function sseEvents(string $body): array
    {
        $events = [];

        foreach (preg_split('/\n\n/', $body) as $chunk) {
            $chunk = trim($chunk);

            if ($chunk === '') {
                continue;
            }

            if (! str_starts_with($chunk, 'data: ')) {
                continue;
            }

            $decoded = json_decode(substr($chunk, 6), true);

            if (is_array($decoded)) {
                $events[] = $decoded;
            }
        }

        return $events;
    }

    /**
     * @param  array<int, array<string, mixed>>  $events
     * @return array<int, string>
     */
    private function eventKeys(array $events): array
    {
        return array_map(
            static fn (array $event): string => (string) (array_key_first($event) ?? ''),
            $events
        );
    }

    public function test_stream_emits_progress_then_a_tool_event_before_the_answer(): void
    {
        $user = User::factory()->create();

        $queued = [
            $this->toolCallResponse('call_1'),
            $this->answerResponse('MPH 6C is free tomorrow morning.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $response = $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Is MPH 6C free tomorrow?'));

        $response->assertOk();
        $response->assertHeader('X-Accel-Buffering', 'no');

        $events = $this->sseEvents($response->streamedContent());
        $keys = $this->eventKeys($events);

        // Progress first, so the UI reacts before the provider is even called.
        $this->assertSame('status', $keys[0]);
        $this->assertSame('thinking', $events[0]['status']);

        // The tool the agent is running must be reported, not swallowed.
        $this->assertContains('tool', $keys);
        $this->assertContains('get_page_context', array_column($events, 'tool'));

        $this->assertContains('token', $keys);
        $this->assertSame('done', $keys[array_key_last($keys)]);
    }

    public function test_stream_assembles_the_answer_from_the_token_events(): void
    {
        $user = User::factory()->create();

        Http::fake(fn () => Http::response($this->answerResponse('Yes, it is free.'), 200));

        $response = $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Is MPH 6C free tomorrow?'));

        $response->assertOk();

        $tokens = '';
        $sawDone = false;

        foreach ($this->sseEvents($response->streamedContent()) as $event) {
            if (isset($event['token'])) {
                $tokens .= $event['token'];
            }

            if (($event['done'] ?? false) === true) {
                $sawDone = true;
            }
        }

        $this->assertSame('Yes, it is free.', $tokens);
        $this->assertTrue($sawDone, 'The stream must terminate with a done event.');
    }

    public function test_stream_pins_the_first_round_to_the_page_context_tool(): void
    {
        $user = User::factory()->create();

        $queued = [
            $this->toolCallResponse('call_1'),
            $this->answerResponse('All done.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('What is on my dashboard?'))
            ->assertOk()
            // The stream callback only runs once the body is captured, so this is
            // what actually performs the provider calls.
            ->streamedContent();

        $first = null;
        $call = 0;

        Http::assertSent(function ($request) use (&$first, &$call) {
            $call++;
            $body = json_decode($request->body(), true);

            if ($call === 1) {
                $first = $body['tool_choice'] ?? null;
            }

            return true;
        });

        /*
         * Round 1 is pinned so the model cannot satisfy "call get_page_context
         * first" with prose like "let me check" and no tool call — that shipped
         * the preamble to the user as the answer.
         */
        $this->assertSame(
            ['type' => 'function', 'function' => ['name' => 'get_page_context']],
            $first
        );
    }

    public function test_stream_flags_a_spent_budget_instead_of_hanging(): void
    {
        $user = User::factory()->create();
        config(['ai.chat.budget' => 0]);

        Http::fake(fn () => Http::response($this->toolCallResponse('call_1'), 200));

        $response = $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Summarise my open requests.'));

        $response->assertOk();

        $keys = $this->eventKeys($this->sseEvents($response->streamedContent()));

        $this->assertContains('budget_exceeded', $keys);
        $this->assertSame('done', $keys[array_key_last($keys)]);
    }

    public function test_stream_strips_the_navigation_marker_out_of_the_visible_text(): void
    {
        $user = User::factory()->create();

        Http::fake(fn () => Http::response(
            $this->answerResponse("Here you go.\nNAVIGATE_SUGGESTION:route=requests.index:reason=that is the list"),
            200
        ));

        $response = $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Where are my requests?'));

        $response->assertOk();

        $events = $this->sseEvents($response->streamedContent());

        $tokens = '';
        foreach ($events as $event) {
            if (isset($event['token'])) {
                $tokens .= $event['token'];
            }
        }

        // Chunked streaming would otherwise split the marker across token
        // events and leak it into the answer as raw text.
        $this->assertStringNotContainsString('NAVIGATE_SUGGESTION', $tokens);

        $navEvents = array_values(array_filter($events, static fn (array $e): bool => isset($e['navigate'])));

        $this->assertCount(1, $navEvents);
        $this->assertSame('requests.index', $navEvents[0]['navigate']['route']);
    }

    public function test_page_context_resolves_the_route_the_user_is_actually_on(): void
    {
        $user = User::factory()->create();
        User::factory()->count(2)->create();

        /*
         * Regression guard. PageContextService::resolveRouteName() used to prefer
         * request()->route()->getName(), which on the chat endpoint is the chat
         * route itself rather than the page being viewed. Renaming the stream
         * route from an `api.`-prefixed name to a bare one therefore made every
         * page resolve to "chat.stream": PageCapabilityMap matched nothing,
         * getPageSpecificContext fell through, and the model was handed an empty
         * context on every page — which is how it ended up claiming the user had
         * no pending requests while sitting on the requests list.
         */
        $context = $this->toolResultFromRun($user, 'How many users are there?', [
            'url' => 'https://gso.test/accounts',
            'path' => '/accounts',
            'route' => 'accounts.index',
            'component' => 'accounts/index',
            'title' => 'Accounts - FRAI',
        ]);

        $this->assertSame(
            'accounts.index',
            $context['context']['page']['route'] ?? null,
            'The chat endpoint name leaked into the page route, so no page-specific context was ever loaded.'
        );
        $this->assertNotEmpty(
            $context['context']['users'] ?? [],
            'The accounts page context must contain users.'
        );
    }

    public function test_page_context_is_not_taken_from_the_chat_endpoint_name(): void
    {
        $user = User::factory()->create();
        RequestModel::factory()->count(3)->create(['user_id' => $user->id, 'status' => RequestStatus::PENDING]);

        $context = $this->toolResultFromRun($user, 'What do I have pending?');

        $this->assertSame('requests.index', $context['context']['page']['route'] ?? null);
        $this->assertNotEmpty(
            $context['context']['visible_requests'] ?? [],
            'The requests page context must contain the user\'s requests.'
        );
    }

    public function test_get_my_requests_returns_the_callers_own_requests(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $mine = RequestModel::factory()->create(['user_id' => $user->id, 'title' => 'Mine']);
        RequestModel::factory()->create(['user_id' => $other->id, 'title' => 'Someone elses']);

        $queued = [
            $this->toolCallResponse('call_1', '', '{}', 'get_my_requests'),
            $this->answerResponse('You have one request.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('What requests do I have?'))
            ->assertOk()
            ->streamedContent();

        $roundTwo = [];
        $round = 0;

        Http::assertSent(function ($request) use (&$roundTwo, &$round) {
            $round++;
            $body = json_decode($request->body(), true);

            if ($round === 2) {
                $roundTwo = $body['messages'] ?? [];
            }

            return true;
        });

        $result = [];
        foreach ($roundTwo as $message) {
            if (is_array($message) && ($message['role'] ?? null) === 'tool') {
                $result = json_decode((string) $message['content'], true) ?: [];
            }
        }

        $this->assertSame('own_requests', $result['scope'] ?? null);

        $titles = array_column($result['requests'] ?? [], 'title');
        $this->assertContains('Mine', $titles);
        $this->assertNotContains('Someone elses', $titles, 'A regular user must never see another user\'s requests.');

        // Counts share the same visibility scope as the list.
        $this->assertSame(1, array_sum($result['counts_by_status'] ?? []));
    }

    public function test_get_my_requests_scopes_admins_to_all_users(): void
    {
        $admin = User::factory()->create();
        Role::findOrCreate('Super Admin', 'web');
        $admin->assignRole('Super Admin');

        $other = User::factory()->create();
        RequestModel::factory()->create(['user_id' => $admin->id]);
        RequestModel::factory()->create(['user_id' => $other->id]);

        $queued = [
            $this->toolCallResponse('call_1', '', '{}', 'get_my_requests'),
            $this->answerResponse('There are two.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($admin)
            ->post(route('api.chat.stream'), $this->chatPayload('Show every request'))
            ->assertOk()
            ->streamedContent();

        $roundTwo = [];
        $round = 0;

        Http::assertSent(function ($request) use (&$roundTwo, &$round) {
            $round++;
            $body = json_decode($request->body(), true);

            if ($round === 2) {
                $roundTwo = $body['messages'] ?? [];
            }

            return true;
        });

        $result = [];
        foreach ($roundTwo as $message) {
            if (is_array($message) && ($message['role'] ?? null) === 'tool') {
                $result = json_decode((string) $message['content'], true) ?: [];
            }
        }

        $this->assertSame('all_users', $result['scope'] ?? null);
        $this->assertSame(2, array_sum($result['counts_by_status'] ?? []));
    }

    public function test_get_my_requests_honours_the_status_filter(): void
    {
        $user = User::factory()->create();

        RequestModel::factory()->create(['user_id' => $user->id, 'status' => RequestStatus::PENDING]);
        RequestModel::factory()->create(['user_id' => $user->id, 'status' => RequestStatus::APPROVED]);

        $queued = [
            // Deliberately the messy filter form; RequestStatus::tryFromFilter
            // accepts "pending" and "Pending" alike.
            $this->toolCallResponse('call_1', '', '{"status":"pending"}', 'get_my_requests'),
            $this->answerResponse('One pending.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Anything pending?'))
            ->assertOk()
            ->streamedContent();

        $roundTwo = [];
        $round = 0;

        Http::assertSent(function ($request) use (&$roundTwo, &$round) {
            $round++;
            $body = json_decode($request->body(), true);

            if ($round === 2) {
                $roundTwo = $body['messages'] ?? [];
            }

            return true;
        });

        $result = [];
        foreach ($roundTwo as $message) {
            if (is_array($message) && ($message['role'] ?? null) === 'tool') {
                $result = json_decode((string) $message['content'], true) ?: [];
            }
        }

        $this->assertSame('Pending', $result['status_filter'] ?? null);
        $this->assertSame(1, $result['total_in_scope'] ?? null);

        foreach ($result['requests'] ?? [] as $request_) {
            $this->assertSame('Pending', $request_['status'] ?? null);
        }
    }

    public function test_system_prompt_forbids_tables_and_declares_a_chat_window(): void
    {
        $user = User::factory()->create();

        Http::fake(fn () => Http::response($this->answerResponse('All done.'), 200));

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('What are my requests?'))
            ->assertOk()
            ->streamedContent();

        $systemPrompts = [];

        Http::assertSent(function ($request) use (&$systemPrompts) {
            $body = json_decode($request->body(), true);

            foreach ($body['messages'] ?? [] as $message) {
                if (($message['role'] ?? null) === 'system') {
                    $systemPrompts[] = (string) ($message['content'] ?? '');
                }
            }

            return true;
        });

        // Three system messages are prepended (visible browser context, server
        // context, then the main prompt), so the rules can land in any of them.
        $systemPrompt = implode("\n\n", $systemPrompts);

        $this->assertNotSame('', $systemPrompt);

        /*
         * The chat bubble renders markdown without remark-gfm, so a pipe table
         * degrades into literal "|" text with a visible "|---|" rule. The only
         * defence is the prompt, so assert the model is actually told.
         */
        $this->assertStringContainsString(
            'chat bubble',
            $systemPrompt,
            'The prompt must state that replies render inside a chat window.'
        );
        $this->assertStringContainsString(
            'NEVER produce tables',
            $systemPrompt,
            'The prompt must forbid tables, which do not render in the chat bubble.'
        );
    }

    public function test_system_prompt_marks_a_null_ai_recommendation_as_still_processing(): void
    {
        $user = User::factory()->create();

        Http::fake(fn () => Http::response($this->answerResponse('Still under review.'), 200));

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Why was my request approved?'))
            ->assertOk()
            ->streamedContent();

        $systemPrompts = [];

        Http::assertSent(function ($request) use (&$systemPrompts) {
            $body = json_decode($request->body(), true);

            foreach ($body['messages'] ?? [] as $message) {
                if (($message['role'] ?? null) === 'system') {
                    $systemPrompts[] = (string) ($message['content'] ?? '');
                }
            }

            return true;
        });

        $systemPrompt = implode("\n\n", $systemPrompts);

        /*
         * ProcessRequestRecommendation writes its AI fields only after the LLM
         * call returns, so page context legitimately shows nulls mid-flight.
         * Without this the model either invents a reason or tells the user there
         * is no recommendation at all.
         */
        $this->assertStringContainsString(
            'A Recommendation Is Not a Decision',
            $systemPrompt,
            'The prompt must tell the model an AI recommendation is not a decision.'
        );
        $this->assertStringContainsString(
            'still being processed',
            $systemPrompt,
            'The prompt must tell the model a null AI recommendation means the review is still running.'
        );
        $this->assertStringContainsString(
            'does NOT mean the request has no recommendation',
            $systemPrompt,
            'The prompt must stop the model concluding a null means no recommendation exists.'
        );
    }

    public function test_suggest_navigation_surfaces_a_link_to_the_user(): void
    {
        $user = User::factory()->create();

        $queued = [
            $this->toolCallResponse(
                'call_1',
                '',
                '{"route":"requests.index","reason":"your pending requests live on the requests page"}',
                'suggest_navigation'
            ),
            $this->answerResponse('Your pending requests are on the Requests page.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $response = $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('Where are my requests?'))
            ->assertOk();

        $events = $this->sseEvents($response->streamedContent());
        $navEvents = array_values(array_filter($events, static fn (array $e): bool => isset($e['navigate'])));

        /*
         * The tool result used to go back to the model as plain text and nothing
         * else, so the model would say "let me navigate you to the requests page"
         * and stop — prose with no link behind it.
         */
        $this->assertCount(1, $navEvents, 'suggest_navigation must reach the user as a clickable link.');
        $this->assertSame('requests.index', $navEvents[0]['navigate']['route']);
    }

    public function test_page_context_tool_returns_the_facilities_it_was_asked_to_load(): void
    {
        $user = User::factory()->create();
        $facility = \App\Models\Facility::factory()->create(['name' => 'MPH 6C']);

        // The model asks for facilities on a page whose context omits them.
        // These used to be fetched and then silently dropped: $toolResult was
        // built from $pageContext *before* the merge, and PHP copies on
        // assignment, so the model never received what it asked for and kept
        // re-calling the tool until the round cap ran out.
        $queued = [
            $this->toolCallResponse('call_1', '', '{"page":true,"include_facilities":true}'),
            $this->answerResponse('MPH 6C has 40 seats.'),
        ];
        $served = 0;

        Http::fake(function () use (&$queued, &$served) {
            $served++;

            return Http::response($queued[$served - 1] ?? $this->answerResponse('exhausted'), 200);
        });

        $this
            ->actingAs($user)
            ->post(route('api.chat.stream'), $this->chatPayload('How big is MPH 6C?'))
            ->assertOk()
            ->streamedContent();

        $roundTwoMessages = [];
        $round = 0;

        Http::assertSent(function ($request) use (&$roundTwoMessages, &$round) {
            $round++;
            $body = json_decode($request->body(), true);

            // Round 2 carries the tool result produced by round 1.
            if ($round === 2) {
                $roundTwoMessages = $body['messages'] ?? [];
            }

            return true;
        });

        $toolMessage = null;

        foreach ($roundTwoMessages as $message) {
            if (is_array($message) && ($message['role'] ?? null) === 'tool') {
                $toolMessage = $message;

                break;
            }
        }

        $this->assertNotNull($toolMessage, 'Expected a tool result to be fed back to the model.');
        $this->assertSame('get_page_context', $toolMessage['name']);

        $context = json_decode((string) $toolMessage['content'], true);

        $this->assertIsArray($context, 'The tool result must be valid JSON.');

        $facilities = $context['context']['facilities'] ?? null;

        $this->assertIsArray(
            $facilities,
            'The facilities the model explicitly asked for must be present in the tool payload.'
        );
        $this->assertNotEmpty(
            $facilities,
            'The facilities were fetched but never serialised — this is the copy-on-assignment snapshot bug.'
        );
        $this->assertSame(
            'MPH 6C',
            $facilities[0]['name'] ?? $facilities[0]['facility_name'] ?? null,
            'The facility the model asked about must reach it.'
        );
    }

    public function test_stream_rejects_a_request_without_page_context(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->postJson(route('api.chat.stream'), [
                'messages' => [['role' => 'user', 'content' => 'Hello']],
            ]);

        $response->assertStatus(422);

        $errors = array_column($this->sseEvents($response->streamedContent()), 'error');

        $this->assertNotEmpty($errors);
    }
}
