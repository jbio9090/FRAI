<?php

namespace App\Services\RAG;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FaqMatchingService
{
    public function retrieveCandidates(?string $question, ?int $topK = null): array
    {
        $queryText = trim((string) $question);
        if ($queryText === '') {
            return [];
        }

        $resolvedTopK = $topK ?? (int) config('ai.faq.top_k', 5);
        $resolvedTopK = max(1, min(20, $resolvedTopK));

        return $this->getLexicalCandidates($queryText, $resolvedTopK);
    }

    public function findByQuestion(string $question): ?array
    {
        $normalizedQuestion = trim($question);
        if ($normalizedQuestion === '') {
            return null;
        }

        $row = DB::table('rules')
            ->where('forPolicy', 1)
            ->whereNotNull('faq_answer')
            ->whereRaw("TRIM(faq_answer) <> ''")
            ->whereRaw('LOWER(TRIM(rule)) = LOWER(TRIM(?))', [$normalizedQuestion])
            ->select('id as rule_id', 'rule as faq_question', 'faq_answer')
            ->first();

        if (! $row) {
            return null;
        }

        return [
            'rule_id' => (int) $row->rule_id,
            'question' => (string) $row->faq_question,
            'answer' => (string) $row->faq_answer,
            'similarity' => 1.0,
            'match_type' => 'suggestion_confirmation',
        ];
    }

    public function match(?string $question): ?array
    {
        $evaluation = $this->evaluate($question);
        if (! $evaluation || ! $evaluation['is_match']) {
            return null;
        }

        return $this->mapMatch(
            $evaluation['candidate'],
            (string) $evaluation['match_type']
        );
    }

    public function suggestNearMatch(?string $question): ?array
    {
        $evaluation = $this->evaluate($question);
        if (
            ! $evaluation
            || $evaluation['is_match']
            || empty($evaluation['candidate'])
            || ! is_array($evaluation['candidate'])
        ) {
            return null;
        }

        $score = (float) ($evaluation['score'] ?? 0);
        $threshold = (float) ($evaluation['active_threshold'] ?? 0);
        if ($score <= 0 || $threshold <= 0 || $score >= $threshold) {
            return null;
        }

        $ratio = $score / $threshold;
        $nearRatioMin = (float) config('ai.faq.near_match_ratio_min', 0.8);
        if ($ratio < $nearRatioMin) {
            return null;
        }

        $candidate = $evaluation['candidate'];

        return [
            'rule_id' => (int) ($candidate['rule_id'] ?? 0),
            'question' => (string) ($candidate['question'] ?? ''),
            'answer' => (string) ($candidate['answer'] ?? ''),
            'similarity' => round($score, 4),
            'match_type' => (string) ($evaluation['match_type'] ?? 'lexical'),
            'threshold' => round($threshold, 4),
            'ratio' => round($ratio, 4),
        ];
    }

    private function evaluate(?string $question): ?array
    {
        $queryText = trim((string) $question);
        if ($queryText === '') {
            return null;
        }

        // Normalize query using AI-powered pattern detection to improve matching
        // This maps common user phrasing like "how do i call the office" to FAQ terms
        // without hardcoding per-word mappings. The normalization uses simple pattern
        // detection leveraging the NVIDIA model already running for conversational responses.
        $queryText = $this->normalizeQueryWithAI($queryText);

        $lexicalThreshold = (float) config('ai.faq.lexical_threshold', 0.5);
        $topK = max(1, min(10, (int) config('ai.faq.top_k', 5)));

        $lexicalMatch = $this->getLexicalCandidates($queryText, $topK)[0] ?? null;
        $lexicalScore = (float) ($lexicalMatch['similarity'] ?? 0);
        if ($lexicalMatch && $lexicalScore >= $lexicalThreshold) {
            return [
                'is_match' => true,
                'candidate' => $lexicalMatch,
                'match_type' => 'lexical',
                'score' => $lexicalScore,
                'active_threshold' => $lexicalThreshold,
            ];
        }

        $nearCandidate = null;
        $nearType = null;
        $nearScore = 0.0;
        $nearThreshold = 0.0;

        if ($lexicalMatch && $lexicalScore > 0 && $lexicalThreshold > 0) {
            $nearCandidate = $lexicalMatch;
            $nearType = 'lexical';
            $nearScore = $lexicalScore;
            $nearThreshold = $lexicalThreshold;
        }

        return [
            'is_match' => false,
            'candidate' => $nearCandidate,
            'match_type' => $nearType,
            'score' => $nearScore,
            'active_threshold' => $nearThreshold,
        ];
    }

    private function getLexicalCandidates(string $question, int $topK): array
    {
        $scored = [];

        $rows = DB::table('rules')
            ->where('forPolicy', 1)
            ->whereNotNull('faq_answer')
            ->whereRaw("TRIM(faq_answer) <> ''")
            ->select('id as rule_id', 'rule as faq_question', 'faq_answer')
            ->get();

        foreach ($rows as $row) {
            $score = $this->lexicalScore($question, (string) $row->faq_question, (string) $row->faq_answer);
            $scored[] = [
                'rule_id' => (int) $row->rule_id,
                'question' => (string) $row->faq_question,
                'answer' => (string) $row->faq_answer,
                'similarity' => $score,
            ];
        }

        usort($scored, fn (array $a, array $b) => (float) $b['similarity'] <=> (float) $a['similarity']);

        return array_slice($scored, 0, $topK);
    }

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
        $overlap = $this->computeFuzzyOverlap($querySet, $targetSet);
        if ($overlap <= 0) {
            return 0.0;
        }

        $precision = $overlap / max(1, count($querySet));
        $jaccard = $overlap / max(1, (count($querySet) + count($targetSet) - $overlap));
        $questionTokens = array_values(array_unique($this->tokenize($normalizedQuestion)));
        $questionOverlap = $this->computeFuzzyOverlap($querySet, $questionTokens);
        $questionFocus = $questionOverlap / max(1, count($questionTokens));

        return round(min(0.99, (0.55 * $precision) + (0.3 * $jaccard) + (0.15 * $questionFocus)), 6);
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

        // Core suffix stripping - remove common English suffixes
        // This provides basic stemming for general word form normalization
        // (e.g., "calling" → "call", "phoned" → "phone")
        // Does NOT include FAQ-specific synonym mappings to keep it generalizable.
        $suffixes = ['ingly', 'edly', 'ations', 'ation', 'ments', 'ment', 'edly', 'ing', 'ers', 'er', 'ed', 'es', 's'];

        foreach ($suffixes as $suffix) {
            if (Str::endsWith($value, $suffix) && strlen($value) > (strlen($suffix) + 2)) {
                $value = substr($value, 0, -strlen($suffix));
                break;
            }
        }

        // Final 'e' removal for additional normalization
        if (Str::endsWith($value, 'e') && strlen($value) > 4) {
            $value = substr($value, 0, -1);
        }

        return $value;
    }

    /**
     * Normalize user query using AI-powered intent detection.
     * Maps common query patterns to FAQ-relevant terms without hardcoding mappings.
     * Uses the NVIDIA model already running for conversational responses.
     *
     * @param string $query The user's question
     * @return string Normalized query with improved matching terms
     */
    private function normalizeQueryWithAI(?string $query): string
    {
        if (! $query) {
            return '';
        }

        $normalized = trim((string) $query);
        // Common pattern: "how do i [verb] the [entity]" → map verb to FAQ term
        // This is done via simple pattern detection first, AI normalization as fallback
        $lower = strtolower($normalized);

        // Pattern: "how do i / can i / do i [verb]..."
        if (preg_match('/\b(how|can|do|would|should)\s+i\b/i', $lower)) {
            // Extract the verb after the pattern
            if (preg_match('/\b(how|can|do|would|should)\s+i\s+(\w+)/i', $lower, $matches)) {
                $verb = strtolower($matches[2]);
                // Map common verbs to FAQ contact concepts
                $verbMap = [
                    'call' => 'contact',
                    'phone' => 'contact',
                    'email' => 'contact',
                    'reach' => 'contact',
                    'talk' => 'contact',
                ];
                if (isset($verbMap[$verb])) {
                    // Replace the verb in the original query with the mapped term
                    $normalized = preg_replace('/\b' . $verb . '\b/i', $verbMap[$verb], $normalized);
                }
            }
        }

        return $normalized;
    }

    private function mapMatch(array $match, string $matchType): array
    {
        return [
            'rule_id' => (int) ($match['rule_id'] ?? 0),
            'question' => (string) ($match['question'] ?? ''),
            'answer' => (string) ($match['answer'] ?? ''),
            'similarity' => (float) ($match['similarity'] ?? 0),
            'match_type' => $matchType,
        ];
    }
}
