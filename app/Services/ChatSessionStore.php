<?php

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

/**
 * Owns every cache key the chatbot writes.
 *
 * The transcript is keyed by the *browser session*, not the user account. Keying
 * it by user id made the history follow the account across tabs and devices for
 * the length of the TTL, so one tab closing wiped a transcript another tab was
 * still showing. Session-scoped keys mean each tab owns its own history, and the
 * entry becomes unreachable the moment that session ends — including on logout,
 * where LoginController invalidates the session, so no logout-specific clearing
 * is needed.
 *
 * The page-context and FAQ-state keys stay user-scoped: they cache server-derived
 * facts, not conversation content, and are safe to share between that user's own
 * tabs.
 */
class ChatSessionStore
{
    /**
     * Bump this when a deploy changes the system prompt, tool names or tool
     * definitions — it invalidates every existing transcript without waiting out
     * the TTL or touching the cache by hand.
     */
    private const PROMPT_VERSION = 'v2';

    private const TTL_MINUTES = 15;

    private const MAX_MESSAGES = 10;

    public function transcriptKey(): string
    {
        return 'chat_session_'.self::PROMPT_VERSION.'_'.session()->getId();
    }

    public function pageContextKey(): string
    {
        return 'chat_page_context_'.Auth::id();
    }

    public function faqStateKey(): string
    {
        return 'chat_faq_state_'.self::PROMPT_VERSION.'_'.Auth::id();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function loadTranscript(): array
    {
        $messages = Cache::get($this->transcriptKey(), []);

        return is_array($messages) ? array_slice($messages, -self::MAX_MESSAGES) : [];
    }

    /**
     * @param  array<int, array<string, mixed>>  $messages
     */
    public function saveTranscript(array $messages): void
    {
        Cache::put(
            $this->transcriptKey(),
            array_slice($messages, -self::MAX_MESSAGES),
            now()->addMinutes(self::TTL_MINUTES)
        );
    }

    /**
     * Forget everything the current browser session cached for the chatbot.
     */
    public function forget(): void
    {
        Cache::forget($this->transcriptKey());
        Cache::forget($this->pageContextKey());
        Cache::forget($this->faqStateKey());
    }

    /**
     * Resolve the page context for a fingerprint, reusing the cached copy while
     * the user stays on the same screen.
     *
     * @param  Closure(): array<string, mixed>  $resolve
     * @return array<string, mixed>
     */
    public function rememberPageContext(string $fingerprint, Closure $resolve): array
    {
        $cached = Cache::get($this->pageContextKey());

        if (is_array($cached)
            && ($cached['fingerprint'] ?? null) === $fingerprint
            && is_array($cached['context'] ?? null)) {
            return $cached['context'];
        }

        $context = $resolve();

        Cache::put(
            $this->pageContextKey(),
            ['fingerprint' => $fingerprint, 'context' => $context],
            now()->addMinutes(self::TTL_MINUTES)
        );

        return $context;
    }

    /**
     * @return array<string, mixed>
     */
    public function getFaqState(): array
    {
        $state = Cache::get($this->faqStateKey(), []);

        return is_array($state) ? $state : [];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    public function saveFaqState(array $state): void
    {
        Cache::put($this->faqStateKey(), $state, now()->addMinutes(self::TTL_MINUTES));
    }
}
