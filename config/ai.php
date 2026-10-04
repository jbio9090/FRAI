<?php

return [
    'provider' => env('AI_PROVIDER', 'nvidia'),

    'nvidia' => [
        'api_key' => env('NVIDIA_API_KEY'),
        'model' => env('NVIDIA_MODEL', 'nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b'),
        'base_url' => rtrim(env('NVIDIA_BASE_URL', 'https://integrate.api.nvidia.com/v1'), '/'),
    ],

    'generate' => [
        'timeout' => (int) env('AI_GENERATE_TIMEOUT', 60),
        'connect_timeout' => (int) env('AI_CONNECT_TIMEOUT', 10),
        'temperature' => (float) env('AI_GENERATE_TEMPERATURE', 0.1),
        'max_tokens' => (int) env('AI_GENERATE_MAX_TOKENS', 2048),
    ],

    /*
     * Wall-clock budget for one interactive chat turn.
     *
     * A turn is a single synchronous HTTP request that can run several AI calls
     * back to back (the tool loop plus a fallback call). nginx gives up on a
     * request after 60s by default (no fastcgi_read_timeout is configured, on
     * Herd locally or in the repo's nginx.conf), so a slow provider used to
     * surface as a 504 Gateway Timeout while PHP kept working until
     * set_time_limit(120). Budget is the total time a turn may consume; every
     * individual AI call is clamped to what is left, and the turn degrades to a
     * friendly message instead of a gateway timeout when it runs out.
     */
    'chat' => [
        'budget' => (int) env('AI_CHAT_BUDGET', 40),
        'call_timeout' => (int) env('AI_CHAT_CALL_TIMEOUT', 25),
        // 4, not less: the tool loop needs enough rounds for get_page_context
        // plus the follow-up the model asks for. Lowering it makes the loop run
        // out before the model answers, which is its own failure mode.
        'max_rounds' => (int) env('AI_CHAT_MAX_ROUNDS', 4),
        'safety_margin' => (int) env('AI_CHAT_SAFETY_MARGIN', 5),
        'slow_call_ms' => (int) env('AI_CHAT_SLOW_CALL_MS', 8000),
    ],

    'faq' => [
        'top_k' => (int) env('AI_FAQ_TOP_K', 5),
        'lexical_threshold' => (float) env('AI_FAQ_LEXICAL_THRESHOLD', 0.5),
        'near_match_ratio_min' => (float) env('AI_FAQ_NEAR_MATCH_RATIO_MIN', 0.8),
    ],

    'recommendation' => [
        'rule_limit' => (int) env('AI_RECOMMENDATION_RULE_LIMIT', 10),
        'timeout' => (int) env('AI_RECOMMENDATION_TIMEOUT', 180),
    ],

    'embedding' => [
        // When empty, vector search is disabled and the app keeps the
        // priority-ordered rule selection it used before pgvector support.
        'model' => env('NVIDIA_EMBED_MODEL', ''),
        'dimensions' => (int) env('EMBED_DIMENSIONS', 2048),
    ],
];
