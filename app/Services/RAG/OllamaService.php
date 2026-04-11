<?php

namespace App\Services\RAG;

use Illuminate\Support\Facades\Http;

class OllamaService
{
    private string $baseUrl;
    private string $model;

    public function __construct()
    {
        $this->baseUrl = config('ollama.url', 'http://localhost:11434');
        $this->model = config("ollama-laravel.model", "FRAI");
    }

    public function embed(string $text): array
    {
        $response = Http::timeout(60)->post("{$this->baseUrl}/api/embeddings", [
            'model'  => 'nomic-embed-text',
            'prompt' => $text,
        ]);

        if (!$response->successful()) {
            \Log::warning('Ollama embed failed: ' . $response->body());
            return [];
        }

        return $response->json('embedding') ?? [];
    }

    public function generate(string $prompt): string
    {
        $response = Http::timeout(120)->post("{$this->baseUrl}/api/generate", [
            'model'  => $this->model,
            'prompt' => $prompt,
            'stream' => false,
        ]);

        if (!$response->successful()) {
            \Log::warning('Ollama generate failed: ' . $response->body());
            return '';
        }

        return $response->json('response') ?? '';
    }
}
