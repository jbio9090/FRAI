<?php

namespace App\Services\RAG;

use Illuminate\Support\Facades\DB;

class FaqMatchingService
{
    public function __construct(protected OllamaService $ollama) {}

    public function match(?string $question): ?array
    {
        $normalizedQuestion = trim((string) $question);
        if ($normalizedQuestion === '') {
            return null;
        }

        $embedding = $this->ollama->embed($normalizedQuestion);
        if (empty($embedding)) {
            return null;
        }

        $vectorLiteral = '[' . implode(',', $embedding) . ']';
        $threshold = (float) config('ollama-laravel.faq_similarity_threshold', 0.72);

        try {
            $row = DB::table('rule_embeddings')
                ->join('rules', 'rules.id', '=', 'rule_embeddings.rule_id')
                ->where('rules.forPolicy', 1)
                ->whereNotNull('rules.faq_answer')
                ->whereRaw("TRIM(rules.faq_answer) <> ''")
                ->selectRaw(
                    'rules.id as rule_id, rules.rule as faq_question, rules.faq_answer, 1 - (rule_embeddings.embedding <=> ?) AS similarity',
                    [$vectorLiteral]
                )
                ->orderByRaw('rule_embeddings.embedding <=> ?', [$vectorLiteral])
                ->limit(1)
                ->first();
        } catch (\Throwable $exception) {
            \Log::warning('FAQ semantic match failed: ' . $exception->getMessage());
            return null;
        }

        if (!$row) {
            return null;
        }

        $similarity = (float) ($row->similarity ?? 0);
        if ($similarity < $threshold) {
            return null;
        }

        return [
            'rule_id' => (int) $row->rule_id,
            'question' => (string) $row->faq_question,
            'answer' => (string) $row->faq_answer,
            'similarity' => $similarity,
        ];
    }
}

