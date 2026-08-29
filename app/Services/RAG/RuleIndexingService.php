<?php

namespace App\Services\RAG;

use App\Models\Rule;
use App\Models\RuleEmbedding;
use App\Services\AI\EmbeddingService;
use Pgvector\Laravel\Vector;

class RuleIndexingService
{
    public function __construct(protected EmbeddingService $embedder) {}

    public function indexAll(): void
    {
        Rule::all()->each(fn ($rule) => $this->indexRule($rule));
    }

    public function indexRule(Rule $rule): void
    {
        RuleEmbedding::where('rule_id', $rule->id)->delete();

        // Vector search is opt-in: when no embedding model is configured (or
        // we're not on a pgvector-capable driver) we stop here and the
        // recommendation engine falls back to priority ordering.
        if (! $this->useVectorSearch()) {
            return;
        }

        try {
            $content = (string) $rule->rule;
            $embedding = $this->embedder->embed($content);

            RuleEmbedding::create([
                'rule_id' => $rule->id,
                'content' => $content,
                'embedding' => new Vector($embedding),
            ]);
        } catch (\Throwable $e) {
            \Log::warning("RuleIndexingService: failed to embed rule #{$rule->id}: ".$e->getMessage());
        }
    }

    public function deleteIndex(int $ruleId): void
    {
        RuleEmbedding::where('rule_id', $ruleId)->delete();
    }

    private function useVectorSearch(): bool
    {
        return $this->embedder->isConfigured()
            && config('database.default') === 'pgsql';
    }
}
