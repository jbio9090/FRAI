<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FaqSearchTool
{
    /**
     * Search the FAQ database for matching rules.
     *
     * This tool allows the LLM to query the rules table directly,
     * retrieving FAQ entries that can ground its answers and prevent hallucination.
     *
     * @param string $question The user's question to search for
     * @param int $topK Number of top results to return (default: 5)
     * @return array['matches' => [...], 'query' => string, 'count' => int]
     */
    public function search(string $question, int $topK = 5): array
    {
        $queryText = trim((string) $question);
        if ($queryText === '') {
            return [
                'matches' => [],
                'query' => '',
                'count' => 0,
            ];
        }

        $resolvedTopK = max(1, min(20, $topK));

        // Search rules that have FAQ answers
        $scored = [];

        $rows = DB::table('rules')
            ->where('faq_answer', '!=', null)
            ->whereNotNull('faq_answer')
            ->whereRaw("TRIM(faq_answer) <> ''")
            ->select('id', 'rule as faq_question', 'faq_answer')
            ->get();

        foreach ($rows as $row) {
            $score = $this->lexicalScore($queryText, (string) $row->faq_question, (string) $row->faq_answer);
            $scored[] = [
                'id' => (int) $row->id,
                'question' => (string) $row->faq_question,
                'answer' => (string) $row->faq_answer,
                'similarity' => $score,
            ];
        }

        usort($scored, fn (array $a, array $b) => (float) $b['similarity'] <=> (float) $a['similarity']);

        $topMatches = array_slice($scored, 0, $resolvedTopK);

        return [
            'matches' => $topMatches,
            'query' => $queryText,
            'count' => count($topMatches),
        ];
    }

    /**
     * Calculate lexical similarity between query and FAQ question+answer.
     */
    private function lexicalScore(string $query, string $faqQuestion, string $faqAnswer): float
    {
        $normalizedQuery = $this->normalizeText($query);
        if ($normalizedQuery === '') {
            return 0.0;
        }

        $normalizedQuestion = $this->normalizeText($faqQuestion);
        $normalizedAnswer = $this->normalizeText($faqAnswer);
        $combined = trim($normalizedQuestion.' '.$normalizedAnswer);

        if ($combined !== '' && Str::contains($combined, $normalizedQuery)) {
            return 1.0;
        }

        $queryTokens = $this->tokenize($normalizedQuery);
        $targetTokens = $this->tokenize($combined);
        if (empty($queryTokens) || empty($targetTokens)) {
            return 0.0;
        }

        $querySet = array_values(array_unique($queryTokens));
        $targetSet = array_values(array_unique($targetTokens));
        $overlap = 0.0;

        foreach ($querySet as $queryToken) {
            $bestScore = 0.0;
            foreach ($targetSet as $targetToken) {
                $score = $this->tokenSimilarity((string) $queryToken, (string) $targetToken);
                if ($score > $bestScore) {
                    $bestScore = $score;
                }
            }
            if ($bestScore > 0) {
                $overlap += $bestScore;
            }
        }

        $precision = $overlap / max(1, count($querySet));
        $jaccard = $overlap / max(1, (count($querySet) + count($targetSet) - $overlap));

        $questionTokens = array_values(array_unique($this->tokenize($normalizedQuestion)));
        $questionOverlap = $this->computeFuzzyOverlap($querySet, $questionTokens);
        $questionFocus = $questionOverlap / max(1, count($questionTokens));

        return round(min(0.99, (0.55 * $precision) + (0.3 * $jaccard) + (0.15 * $questionFocus)), 6);
    }

    private function normalizeText(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9\s]+/', ' ', $normalized) ?? '';

        return trim((string) preg_replace('/\s+/', ' ', $normalized));
    }

    private function tokenize(string $value): array
    {
        $stopWords = [
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for', 'from',
            'have', 'how', 'i', 'if', 'in', 'is', 'it', 'its', 'just', 'me', 'my', 'of', 'on',
            'or', 'so', 'that', 'the', 'their', 'there', 'these', 'this', 'to', 'what', 'when',
            'where', 'which', 'who', 'will', 'with', 'you', 'your',
        ];

        $tokens = array_filter(explode(' ', $value), fn (string $token) => $token !== '');
        $filtered = array_values(array_filter($tokens, fn (string $token) => ! in_array($token, $stopWords, true)));

        return array_values(array_filter(
            array_map(fn (string $token) => $this->stemToken($token), $filtered),
            fn (string $token) => $token !== ''
        ));
    }

    private function stemToken(string $token): string
    {
        $value = strtolower(trim($token));
        if ($value === '' || strlen($value) <= 2) {
            return $value;
        }

        $suffixes = ['ingly', 'edly', 'ations', 'ation', 'ments', 'ment', 'ingly', 'edly', 'ing', 'ers', 'er', 'ed', 'es', 's'];
        foreach ($suffixes as $suffix) {
            if (Str::endsWith($value, $suffix) && strlen($value) > (strlen($suffix) + 2)) {
                $value = substr($value, 0, -strlen($suffix));
                break;
            }
        }

        if (Str::endsWith($value, 'e') && strlen($value) > 4) {
            $value = substr($value, 0, -1);
        }

        return $value;
    }

    private function computeFuzzyOverlap(array $queryTokens, array $targetTokens): float
    {
        if (empty($queryTokens) || empty($targetTokens)) {
            return 0.0;
        }

        $usedTargetIndexes = [];
        $overlap = 0.0;

        foreach ($queryTokens as $queryToken) {
            $bestScore = 0.0;
            $bestIndex = null;

            foreach ($targetTokens as $index => $targetToken) {
                if (isset($usedTargetIndexes[$index])) {
                    continue;
                }

                $score = $this->tokenSimilarity((string) $queryToken, (string) $targetToken);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestIndex = $index;
                }
            }

            if ($bestScore > 0 && $bestIndex !== null) {
                $usedTargetIndexes[$bestIndex] = true;
                $overlap += $bestScore;
            }
        }

        return $overlap;
    }

    private function tokenSimilarity(string $left, string $right): float
    {
        if ($left === '' || $right === '') {
            return 0.0;
        }

        if ($left === $right) {
            return 1.0;
        }

        $leftStem = $this->stemToken($left);
        $rightStem = $this->stemToken($right);

        if ($leftStem === $rightStem && $leftStem !== '') {
            return 0.96;
        }

        $leftLength = strlen($leftStem);
        $rightLength = strlen($rightStem);
        $maxLength = max($leftLength, $rightLength);

        if ($maxLength === 0) {
            return 0.0;
        }

        $distance = levenshtein($leftStem, $rightStem);
        $ratio = 1 - ($distance / $maxLength);

        $allowedDistance = $maxLength >= 8 ? 2 : 1;
        $minimumRatio = $maxLength <= 4 ? 0.74 : 0.8;

        if ($distance <= $allowedDistance && $ratio >= $minimumRatio) {
            return round($ratio, 4);
        }

        return 0.0;
    }
}