<?php

namespace App\Services\RAG;

use Cloudstudio\Ollama\Facades\Ollama;
use Illuminate\Support\Facades\Http;

class OllamaService
{
    private string $baseUrl;
    private string $model;
    private string $embedModel;

    public function __construct()
    {
        $this->baseUrl    = config('ollama-laravel.url', 'http://localhost:11434');
        $this->model      = config('ollama-laravel.model', 'FRAI');
        $this->embedModel = config('ollama-laravel.embed_model', 'nomic-embed-text');
    }

    public function embed(string $text): array
    {
        $response = Ollama::model($this->embedModel)->embeddings($text);

        if (empty($response['embedding'])) {
            \Log::warning('Ollama embed failed', ['response' => $response]);
            return [];
        }

        return $response['embedding'];
    }

    public function generate(string $prompt): string
    {
        $response = Http::timeout(300)->post("{$this->baseUrl}/api/chat", [
            'model'  => $this->model,
            'stream' => false,
            'think'  => false,
            'options' => [
                'temperature' => 0.1,
                'num_predict' => 1024,
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
        ]);

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
