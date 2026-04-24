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
        $contentForEmbedding = $this->buildEmbeddingContent($rule);
        $embedding = $this->ollama->embed($contentForEmbedding);

        RuleEmbedding::updateOrCreate(
            ['rule_id' => $rule->id],
            [
                'content'   => $contentForEmbedding,
                'embedding' => $embedding,
            ]
        );
    }

    private function buildEmbeddingContent(Rule $rule): string
    {
        $question = trim((string) $rule->rule);

        if ((int) $rule->forPolicy !== 1) {
            return $question;
        }

        $answer = trim((string) $rule->faq_answer);
        if ($answer === '') {
            return $question;
        }

        return "FAQ Question: {$question}\nFAQ Answer: {$answer}";
    }

    public function deleteIndex(int $ruleId): void
    {
        RuleEmbedding::where('rule_id', $ruleId)->delete();
    }
}
