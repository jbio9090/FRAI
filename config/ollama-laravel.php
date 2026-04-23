<?php

// Config for Cloudstudio/Ollama

return [
    'model' => env('OLLAMA_MODEL', 'FRAI'),
    'url' => env('OLLAMA_URL', 'http://127.0.0.1:11434'),
    'default_prompt' => env('OLLAMA_DEFAULT_PROMPT', 'Hello, how can I assist you today?'),
    "embed_model" => env("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
    'faq_similarity_threshold' => (float) env('OLLAMA_FAQ_SIMILARITY_THRESHOLD', 0.65),
    'faq_top_k' => (int) env('OLLAMA_FAQ_TOP_K', 3),
    'faq_mode_top_k' => (int) env('OLLAMA_FAQ_MODE_TOP_K', 5),
    'faq_lexical_threshold' => (float) env('OLLAMA_FAQ_LEXICAL_THRESHOLD', 0.5),
    'faq_near_match_ratio_min' => (float) env('OLLAMA_FAQ_NEAR_MATCH_RATIO_MIN', 0.8),
    'recommendation_rule_limit' => (int) env('OLLAMA_RECOMMENDATION_RULE_LIMIT', 3),

    /*
    |--------------------------------------------------------------------------
    | Keep Alive Duration
    |--------------------------------------------------------------------------
    |
    | Controls how long models stay loaded in memory after a request.
    | Set to null to use the Ollama server's default configuration.
    | Examples: '5m' (5 minutes), '1h' (1 hour), '30s' (30 seconds)
    |
    */
    'keep_alive' => env('OLLAMA_KEEP_ALIVE', null),

    'connection' => [
        'timeout' => env('OLLAMA_CONNECTION_TIMEOUT', 1200),
    ],
    'generate' => [
        'timeout' => (int) env('OLLAMA_GENERATE_TIMEOUT', 60),
        'temperature' => (float) env('OLLAMA_GENERATE_TEMPERATURE', 0.1),
        'num_predict' => (int) env('OLLAMA_GENERATE_NUM_PREDICT', 256),
    ],
    'headers' => [
        'Authorization' => 'Bearer ' . env('OLLAMA_API_KEY'),
    ],
];
