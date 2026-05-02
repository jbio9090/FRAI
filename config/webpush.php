<?php

return [

    /*
    |--------------------------------------------------------------------------
    | VAPID keys
    |--------------------------------------------------------------------------
    */

    'vapid' => [
        'subject' => env('VAPID_SUBJECT'),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'pem_file' => env('VAPID_PEM_FILE'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Push subscriptions
    |--------------------------------------------------------------------------
    */

    'model' => NotificationChannels\WebPush\PushSubscription::class,

    'table_name' => env('WEBPUSH_DB_TABLE', 'push_subscriptions'),

    'database_connection' => env('WEBPUSH_DB_CONNECTION', env('DB_CONNECTION', 'mysql')),

    /*
    |--------------------------------------------------------------------------
    | WebPush HTTP client
    |--------------------------------------------------------------------------
    |
    | Guzzle reads HTTP_PROXY / HTTPS_PROXY from the environment by default.
    | Keep WebPush delivery direct so a stale local proxy cannot swallow
    | browser notifications.
    |
    */

    'client_options' => [
        'proxy' => '',
        'curl' => [
            CURLOPT_PROXY => '',
        ],
    ],

    'automatic_padding' => env('WEBPUSH_AUTOMATIC_PADDING', true),

];
