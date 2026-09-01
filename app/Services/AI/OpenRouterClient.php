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
        $response = $this->doChatRequest($messages, false, $options);

        $toolCalls = $this->extractToolCalls($response);
        if (! empty($toolCalls)) {
            Log::debug('AI chat returned tool calls', [
                'provider' => $this->providerName(),
                'tool_calls' => $toolCalls,
            ]);
        }

        $content = trim((string) ($response['choices'][0]['message']['content'] ?? ''));
        if ($content === '') {
            Log::warning('AI chat returned empty content', [
                'provider' => $this->providerName(),
                'body' => substr(json_encode($response), 0, 1000),
            ]);
        }

        return $content;
    }

    public function chatWithTools(array $messages, array $tools, array $options = []): array
    {
        $payloadOptions = $options;
        $payloadOptions['tools'] = $tools;
        $response = $this->doChatRequest($messages, false, $payloadOptions);

        $message = $response['choices'][0]['message'] ?? [];

        return [
            'content' => (string) ($message['content'] ?? ''),
            'tool_calls' => $this->extractToolCalls($response),
            'raw' => $response,
        ];
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
        $payload = $this->buildChatPayload($messages, true, $options);

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

                $message = $decoded['choices'][0]['delta'] ?? $decoded['choices'][0]['message'] ?? [];
                $toolCalls = $this->extractToolCalls($decoded);
                if (! empty($toolCalls)) {
                    Log::debug('AI stream returned tool calls', [
                        'provider' => $this->providerName(),
                        'tool_calls' => $toolCalls,
                    ]);
                }

                $token = (string) ($message['content'] ?? '');

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

        return trim((string) ($providerConfig['model'] ?? 'nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b'));
    }

    public function baseUrl(): string
    {
        $providerConfig = $this->providerConfig();

        return rtrim((string) ($providerConfig['base_url'] ?? 'https://integrate.api.nvidia.com/v1'), '/');
    }

    public function apiKey(): string
    {
        $providerConfig = $this->providerConfig();

        return trim((string) ($providerConfig['api_key'] ?? ''));
    }

    public function isConfigured(): bool
    {
        return $this->apiKey() !== ''
            && trim($this->model()) !== '';
    }

    private function doChatRequest(array $messages, bool $stream, array $options = []): array
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
        $payload = $this->buildChatPayload($messages, $stream, $options);

        $request = Http::timeout($timeout)
            ->withToken($apiKey)
            ->withHeaders([
                'Content-Type' => 'application/json',
            ]);

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

        $decoded = $response->json();
        if (! is_array($decoded)) {
            throw new RuntimeException('AI chat response was not valid JSON.');
        }

        return $decoded;
    }

    private function buildChatPayload(array $messages, bool $stream, array $options = []): array
    {
        $payload = [
            'model' => $this->model(),
            'messages' => $messages,
            'stream' => $stream,
            'temperature' => (float) ($options['temperature'] ?? config('ai.generate.temperature', 0.1)),
            'max_tokens' => (int) ($options['max_tokens'] ?? config('ai.generate.max_tokens', 512)),
        ];

        if (array_key_exists('tools', $options) && is_array($options['tools']) && $options['tools'] !== []) {
            $payload['tools'] = $options['tools'];
        }

        if (array_key_exists('tool_choice', $options)) {
            $payload['tool_choice'] = $options['tool_choice'];
        }

        return $payload;
    }

    private function extractToolCalls(array $response): array
    {
        $message = $response['choices'][0]['message'] ?? $response['choices'][0]['delta'] ?? [];
        if (! is_array($message)) {
            return [];
        }

        $toolCalls = $message['tool_calls'] ?? null;
        if (is_array($toolCalls) && $toolCalls !== []) {
            return $toolCalls;
        }

        $legacyFunctionCall = $message['function_call'] ?? null;
        if (is_array($legacyFunctionCall) && ($legacyFunctionCall['name'] ?? null) !== null) {
            return [[
                'type' => 'function',
                'function' => [
                    'name' => (string) ($legacyFunctionCall['name'] ?? ''),
                    'arguments' => is_array($legacyFunctionCall['arguments'] ?? null)
                        ? json_encode($legacyFunctionCall['arguments'])
                        : (string) ($legacyFunctionCall['arguments'] ?? '{}'),
                ],
            ]];
        }

        return [];
    }

    private function providerConfig(): array
    {
        $provider = $this->providerName();
        $config = config('ai.'.$provider, []);

        if (is_array($config)) {
            return $config;
        }

        return [];
    }

    private function endpoint(string $path): string
    {
        return $this->baseUrl().'/'.ltrim($path, '/');
    }
}
