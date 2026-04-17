<?php

namespace App\Services\RAG;

use Illuminate\Support\Facades\Http;

class OllamaService
{
    private string $baseUrl;
    private string $model;
    private string $embed_model;

    public function __construct()
    {
        $this->baseUrl = config('ollama-laravel.url', 'http://localhost:11434');
        $this->model = config("ollama-laravel.model", "FRAI");
        $this->embed_model = config("ollama-laravel.embed_model", 'nomic-embed-text');
    }

    public function embed(string $text): array
    {
        $response = Http::timeout(60)->post("{$this->baseUrl}/api/embeddings", [
            'model'  => $this->embed_model,
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
