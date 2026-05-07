<?php

return [
    'provider' => env('AI_PROVIDER', 'openrouter'),

    'openrouter' => [
        'api_key' => env('OPENROUTER_API_KEY'),
        'model' => env('OPENROUTER_MODEL', ''),
        'base_url' => rtrim(env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'), '/'),
    ],

    'generate' => [
        'timeout' => (int) env('AI_GENERATE_TIMEOUT', 60),
        'temperature' => (float) env('AI_GENERATE_TEMPERATURE', 0.1),
        'max_tokens' => (int) env('AI_GENERATE_MAX_TOKENS', 512),
    ],

    'faq' => [
        'top_k' => (int) env('AI_FAQ_TOP_K', 5),
        'lexical_threshold' => (float) env('AI_FAQ_LEXICAL_THRESHOLD', 0.5),
        'near_match_ratio_min' => (float) env('AI_FAQ_NEAR_MATCH_RATIO_MIN', 0.8),
    ],

    'recommendation' => [
        'rule_limit' => (int) env('AI_RECOMMENDATION_RULE_LIMIT', 10),
    ],
];
