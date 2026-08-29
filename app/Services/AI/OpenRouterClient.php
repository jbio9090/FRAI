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
        $apiKey = $this->apiKey();
        $model = $this->model();

        if (trim($apiKey) === '') {
            throw new RuntimeException('AI API key is not configured.');
        }

        if (trim($model) === '') {
            throw new RuntimeException('AI model is not configured.');
        }

        $timeout = (int) ($options['timeout'] ?? config('ai.generate.timeout', 60));
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => false,
            'temperature' => (float) ($options['temperature'] ?? config('ai.generate.temperature', 0.1)),
            'max_tokens' => (int) ($options['max_tokens'] ?? config('ai.generate.max_tokens', 512)),
        ];

        if ($this->providerName() === 'nvidia') {
            $payload['chat_template_kwargs'] = ['enable_thinking' => false];
        }

        $request = Http::timeout($timeout)
            ->withToken($apiKey)
            ->withHeaders(array_filter([
                'Content-Type' => 'application/json',
                'HTTP-Referer' => $this->providerName() === 'openrouter' ? (string) config('app.url') : null,
                'X-Title' => $this->providerName() === 'openrouter' ? (string) config('app.name', 'FRAI') : null,
            ], fn ($value) => $value !== null && $value !== ''));

        $response = $request->post($this->endpoint('/chat/completions'), $payload);

        Log::debug('AI chat response', [
            'provider' => $this->providerName(),
            'status' => $response->status(),
            'body' => substr($response->body(), 0, 500),
        ]);

        if (! $response->successful()) {
            Log::warning('AI chat failed', [
                'provider' => $this->providerName(),
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 1000),
            ]);

            throw new RuntimeException('AI chat request failed with status '.$response->status().'.');
        }

        $content = trim((string) $response->json('choices.0.message.content', ''));
        if ($content === '') {
            Log::warning('AI chat returned empty content', [
                'provider' => $this->providerName(),
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
        $apiKey = $this->apiKey();
        $model = $this->model();

        if (trim($apiKey) === '') {
            throw new RuntimeException('AI API key is not configured.');
        }

        if (trim($model) === '') {
            throw new RuntimeException('AI model is not configured.');
        }

        $timeout = (int) ($options['timeout'] ?? config('ai.generate.timeout', 60));
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => true,
            'temperature' => (float) ($options['temperature'] ?? config('ai.generate.temperature', 0.1)),
            'max_tokens' => (int) ($options['max_tokens'] ?? config('ai.generate.max_tokens', 512)),
        ];

        if ($this->providerName() === 'nvidia') {
            $payload['chat_template_kwargs'] = ['enable_thinking' => false];
        }

        $client = new Client([
            'timeout' => $timeout,
            'connect_timeout' => 15,
        ]);

        $headers = [
            'Authorization' => 'Bearer '.$apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'text/event-stream',
        ];

        if ($this->providerName() === 'openrouter') {
            $headers['HTTP-Referer'] = (string) config('app.url');
            $headers['X-Title'] = (string) config('app.name', 'FRAI');
        }

        $response = $client->post($this->endpoint('/chat/completions'), [
            'headers' => $headers,
            'http_errors' => false,
            'json' => $payload,
            'stream' => true,
        ]);

        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300) {
            $body = substr((string) $response->getBody(), 0, 1000);
            Log::warning('AI streaming chat failed', [
                'provider' => $this->providerName(),
                'status' => $status,
                'body' => $body,
            ]);

            throw new RuntimeException('AI streaming chat request failed with status '.$status.'.');
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
            Log::warning('AI streaming chat returned empty content', [
                'provider' => $this->providerName(),
            ]);
        }

        return trim($content);
    }

    public function providerName(): string
    {
        return strtolower((string) config('ai.provider', 'nvidia')) ?: 'nvidia';
    }

    public function model(): string
    {
        $providerConfig = $this->providerConfig();

        return trim((string) ($providerConfig['model'] ?? config('ai.openrouter.model', 'nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b')));
    }

    public function baseUrl(): string
    {
        $providerConfig = $this->providerConfig();

        return rtrim((string) ($providerConfig['base_url'] ?? config('ai.openrouter.base_url', 'https://integrate.api.nvidia.com/v1')), '/');
    }

    public function apiKey(): string
    {
        $providerConfig = $this->providerConfig();

        return trim((string) ($providerConfig['api_key'] ?? config('ai.openrouter.api_key', '')));
    }

    public function isConfigured(): bool
    {
        return $this->apiKey() !== ''
            && trim($this->model()) !== '';
    }

    private function providerConfig(): array
    {
        $provider = $this->providerName();
        $config = config('ai.'.$provider, []);

        if (is_array($config) && $provider !== 'nvidia') {
            return $config;
        }

        $nvidiaApiKey = trim((string) ($config['api_key'] ?? ''));
        if ($nvidiaApiKey !== '') {
            return $config;
        }

        $openrouterConfig = is_array(config('ai.openrouter')) ? config('ai.openrouter') : [];
        $openrouterApiKey = trim((string) ($openrouterConfig['api_key'] ?? ''));

        if ($openrouterApiKey !== '') {
            return $openrouterConfig;
        }

        return $config;
    }

    private function endpoint(string $path): string
    {
        return $this->baseUrl().'/'.ltrim($path, '/');
    }
}
