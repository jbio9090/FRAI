<?php

namespace App\Services\AI;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class OpenRouterClient
{
    public function chat(array $messages, array $options = []): string
    {
        $apiKey = (string) config('ai.openrouter.api_key', '');
        $model = $this->model();

        if (trim($apiKey) === '') {
            throw new RuntimeException('OpenRouter API key is not configured.');
        }

        if (trim($model) === '') {
            throw new RuntimeException('OpenRouter model is not configured.');
        }

        $timeout = (int) ($options['timeout'] ?? config('ai.generate.timeout', 60));
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => false,
            'temperature' => (float) ($options['temperature'] ?? config('ai.generate.temperature', 0.1)),
            'max_tokens' => (int) ($options['max_tokens'] ?? config('ai.generate.max_tokens', 512)),
        ];

        $response = Http::timeout($timeout)
            ->withToken($apiKey)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'HTTP-Referer' => (string) config('app.url'),
                'X-Title' => (string) config('app.name', 'FRAI'),
            ])
            ->post($this->endpoint('/chat/completions'), $payload);

        Log::debug('OpenRouter chat response', [
            'status' => $response->status(),
            'body' => substr($response->body(), 0, 500),
        ]);

        if (! $response->successful()) {
            Log::warning('OpenRouter chat failed', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 1000),
            ]);

            throw new RuntimeException('OpenRouter chat request failed with status '.$response->status().'.');
        }

        $content = trim((string) $response->json('choices.0.message.content', ''));
        if ($content === '') {
            Log::warning('OpenRouter chat returned empty content', [
                'body' => substr($response->body(), 0, 1000),
            ]);
        }

        return $content;
    }

    public function chatResponse(array $messages, array $options = []): array
    {
        return [
            'message' => [
                'role' => 'assistant',
                'content' => $this->chat($messages, $options),
            ],
            'model' => $this->model(),
        ];
    }

    public function streamChat(array $messages, callable $onToken, array $options = []): string
    {
        $apiKey = (string) config('ai.openrouter.api_key', '');
        $model = $this->model();

        if (trim($apiKey) === '') {
            throw new RuntimeException('OpenRouter API key is not configured.');
        }

        if (trim($model) === '') {
            throw new RuntimeException('OpenRouter model is not configured.');
        }

        $timeout = (int) ($options['timeout'] ?? config('ai.generate.timeout', 60));
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => true,
            'temperature' => (float) ($options['temperature'] ?? config('ai.generate.temperature', 0.1)),
            'max_tokens' => (int) ($options['max_tokens'] ?? config('ai.generate.max_tokens', 512)),
        ];

        $client = new Client([
            'timeout' => $timeout,
            'connect_timeout' => 15,
        ]);

        $response = $client->post($this->endpoint('/chat/completions'), [
            'headers' => [
                'Authorization' => 'Bearer '.$apiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'text/event-stream',
                'HTTP-Referer' => (string) config('app.url'),
                'X-Title' => (string) config('app.name', 'FRAI'),
            ],
            'http_errors' => false,
            'json' => $payload,
            'stream' => true,
        ]);

        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            $body = substr((string) $response->getBody(), 0, 1000);
            Log::warning('OpenRouter streaming chat failed', [
                'status' => $status,
                'body' => $body,
            ]);

            throw new RuntimeException('OpenRouter streaming chat request failed with status '.$status.'.');
        }

        $body = $response->getBody();
        $buffer = '';
        $content = '';

        while (! $body->eof()) {
            $buffer .= $body->read(8192);

            while (($lineEnd = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $lineEnd));
                $buffer = substr($buffer, $lineEnd + 1);

                if ($line === '' || ! str_starts_with($line, 'data:')) {
                    continue;
                }

                $data = trim(substr($line, 5));
                if ($data === '' || $data === '[DONE]') {
                    continue;
                }

                $decoded = json_decode($data, true);
                if (! is_array($decoded)) {
                    continue;
                }

                $token = (string) ($decoded['choices'][0]['delta']['content']
                    ?? $decoded['choices'][0]['message']['content']
                    ?? '');

                if ($token === '') {
                    continue;
                }

                $content .= $token;
                $onToken($token);
            }
        }

        if ($content === '') {
            Log::warning('OpenRouter streaming chat returned empty content');
        }

        return trim($content);
    }

    public function model(): string
    {
        return (string) config('ai.openrouter.model', '');
    }

    public function baseUrl(): string
    {
        return rtrim((string) config('ai.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');
    }

    public function isConfigured(): bool
    {
        return trim((string) config('ai.openrouter.api_key', '')) !== ''
            && trim($this->model()) !== '';
    }

    private function endpoint(string $path): string
    {
        return $this->baseUrl().'/'.ltrim($path, '/');
    }
}
