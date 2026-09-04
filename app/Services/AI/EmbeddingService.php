<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class EmbeddingService
{
    public function isConfigured(): bool
    {
        return trim((string) config('ai.embedding.model', '')) !== ''
            && $this->apiKey() !== '';
    }

    /**
     * Generate an embedding vector for the given text using the configured
     * NVIDIA embedding model. Returns a flat list of floats.
     *
     * @return array<int, float>
     *
     * @throws RuntimeException
     */
    public function embed(string $text): array
    {
        $model = trim((string) config('ai.embedding.model', ''));
        $apiKey = $this->apiKey();
        $baseUrl = rtrim($this->baseUrl(), '/');

        if ($model === '' || $apiKey === '') {
            throw new RuntimeException('Embedding model is not configured.');
        }

        $response = Http::timeout(60)
            ->withToken($apiKey)
            ->post($baseUrl.'/embeddings', [
                'model' => $model,
                'input' => $text,
            ]);

        if (! $response->successful()) {
            Log::warning('Embedding request failed', [
                'model' => $model,
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 1000),
            ]);

            throw new RuntimeException('Embedding request failed with status '.$response->status().'.');
        }

        $embedding = $response->json('data.0.embedding');

        if (! is_array($embedding) || $embedding === []) {
            throw new RuntimeException('Embedding response did not contain an embedding vector.');
        }

        return array_map('floatval', $embedding);
    }

    private function apiKey(): string
    {
        return trim((string) config('ai.nvidia.api_key', config('ai.openrouter.api_key', '')));
    }

    private function baseUrl(): string
    {
        return (string) config('ai.nvidia.base_url', config('ai.openrouter.base_url', 'https://integrate.api.nvidia.com/v1'));
    }
}
