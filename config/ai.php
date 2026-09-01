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
        'temperature' => (float) env('AI_GENERATE_TEMPERATURE', 0.1),
        'max_tokens' => (int) env('AI_GENERATE_MAX_TOKENS', 2048),
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
];
