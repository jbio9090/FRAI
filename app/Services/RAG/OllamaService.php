<?php

namespace App\Services\RAG;

use App\Services\OllamaModelResolver;
use Cloudstudio\Ollama\Facades\Ollama;
use Illuminate\Support\Facades\Http;

class OllamaService
{
    private string $baseUrl;
    private string $model;
    private string $embedModel;
    private ?string $keepAlive;
    private int $generateTimeout;
    private float $generateTemperature;
    private int $generateNumPredict;

    public function __construct(protected OllamaModelResolver $ollamaModelResolver)
    {
        $this->baseUrl    = config('ollama-laravel.url', 'http://localhost:11434');
        $this->model      = config('ollama-laravel.model', 'qwen2.5:3b');
        $this->embedModel = config('ollama-laravel.embed_model', 'nomic-embed-text');
        $this->keepAlive = config('ollama-laravel.keep_alive');
        $this->generateTimeout = (int) config('ollama-laravel.generate.timeout', 60);
        $this->generateTemperature = (float) config('ollama-laravel.generate.temperature', 0.1);
        $this->generateNumPredict = (int) config('ollama-laravel.generate.num_predict', 256);
    }

    private function chatModel(): string
    {
        return $this->ollamaModelResolver->resolve($this->baseUrl, $this->model);
    }

    public function embed(string $text): array
    {
        $response = Ollama::model($this->ollamaModelResolver->resolve($this->baseUrl, $this->embedModel))->embeddings($text);

        if (empty($response['embedding'])) {
            \Log::warning('Ollama embed failed', ['response' => $response]);
            return [];
        }

        return $response['embedding'];
    }

    public function generate(string $prompt): string
    {
        $payload = [
            'model'  => $this->chatModel(),
            'stream' => false,
            'think'  => false,
            'options' => [
                'temperature' => $this->generateTemperature,
                'num_predict' => $this->generateNumPredict,
            ],
            'messages' => [
                [
                    'role'    => 'system',
                    'content' => 'You are a JSON-only response bot. You must output a single valid JSON object and absolutely nothing else. No thinking, no explanation, no markdown, no preamble. Only the JSON object.',
                ],
                [
                    'role'    => 'user',
                    'content' => $prompt,
                ],
            ],
        ];

        if (!empty($this->keepAlive)) {
            $payload['keep_alive'] = $this->keepAlive;
        }

        $response = Http::timeout($this->generateTimeout)->post("{$this->baseUrl}/api/chat", $payload);

        \Log::debug('Ollama generate response', [
            'status' => $response->status(),
            'body'   => substr($response->body(), 0, 500),
        ]);

        if (!$response->successful()) {
            \Log::warning('Ollama generate failed: ' . $response->body());
            return '';
        }

        $content = $response->json('message.content') ?? '';

        if (empty($content)) {
            $thinking = $response->json('message.thinking') ?? '';
            if (preg_match('/\{.*?"status".*?"reason".*?\}/s', $thinking, $m)) {
                \Log::warning('Ollama: extracted JSON from thinking field');
                return $m[0];
            }

            \Log::warning('Ollama generate: empty content', ['body' => $response->body()]);
            return '';
        }

        return $content;
    }
}
