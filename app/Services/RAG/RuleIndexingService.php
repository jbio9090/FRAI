<?php

namespace App\Services\RAG;

use App\Models\Rule;
use App\Models\RuleEmbedding;
use App\Services\RAG\OllamaService;

class RuleIndexingService
{
    public function __construct(private OllamaService $ollama) {}

    public function indexAll(): void
    {
        Rule::all()->each(fn($rule) => $this->indexRule($rule));
    }

    public function indexRule(Rule $rule): void
    {
        $embedding = $this->ollama->embed($rule->rule);

        RuleEmbedding::updateOrCreate(
            ['rule_id' => $rule->id],
            [
                'content'   => $rule->rule,
                'embedding' => $embedding,
            ]
        );
    }

    public function deleteIndex(int $ruleId): void
    {
        RuleEmbedding::where('rule_id', $ruleId)->delete();
    }
}
