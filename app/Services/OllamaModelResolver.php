<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class OllamaModelResolver
{
    public function resolve(string $baseUrl, string $configuredModel): string
    {
        $configuredModel = trim($configuredModel);

        if ($configuredModel === '') {
            return '';
        }

        $cacheKey = 'ollama_resolved_model_' . md5(rtrim($baseUrl, '/') . '|' . $configuredModel);

        return Cache::remember($cacheKey, now()->addMinute(), function () use ($baseUrl, $configuredModel) {
            $availableModels = $this->availableModelNames($baseUrl);

            if (empty($availableModels) || in_array($configuredModel, $availableModels, true)) {
                return $configuredModel;
            }

            $normalizedConfigured = $this->normalizeModelName($configuredModel);

            foreach ($availableModels as $modelName) {
                if ($this->normalizeModelName($modelName) === $normalizedConfigured) {
                    return $modelName;
                }
            }

            return $configuredModel;
        });
    }

    public function availableModelNames(string $baseUrl): array
    {
        try {
            $response = Http::timeout(5)->get(rtrim($baseUrl, '/') . '/api/tags');

            if (!$response->successful()) {
                return [];
            }

            return collect($response->json('models', []))
                ->pluck('name')
                ->filter(fn($name) => is_string($name) && trim($name) !== '')
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function normalizeModelName(string $modelName): string
    {
        $modelName = trim($modelName);
        $withoutNamespace = str_contains($modelName, '/')
            ? substr($modelName, strrpos($modelName, '/') + 1)
            : $modelName;

        return str_ends_with($withoutNamespace, ':latest')
            ? substr($withoutNamespace, 0, -7)
            : $withoutNamespace;
    }
}
