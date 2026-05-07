<?php

namespace App\Services\RAG;

use App\Models\Rule;
use App\Models\RuleEmbedding;

class RuleIndexingService
{
    public function indexAll(): void
    {
        Rule::all()->each(fn ($rule) => $this->indexRule($rule));
    }

    public function indexRule(Rule $rule): void
    {
        RuleEmbedding::where('rule_id', $rule->id)->delete();
    }

    public function deleteIndex(int $ruleId): void
    {
        RuleEmbedding::where('rule_id', $ruleId)->delete();
    }
}
