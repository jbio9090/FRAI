<?php

namespace Tests\Unit\Services\RAG;

use App\Services\RAG\AIRecommendationService;
use Tests\TestCase;

class AIRecommendationServiceTest extends TestCase
{
    public function test_to_concise_paragraph_collapses_bullets_and_line_breaks(): void
    {
        $input = "- First point about approval.\n- Second point about schedule.\n- Third point about equipment.";

        $result = AIRecommendationService::toConciseParagraph($input);

        $this->assertStringNotContainsString("\n", $result);
        $this->assertStringNotContainsString('- ', $result);
        $this->assertSame('First point about approval. Second point about schedule. Third point about equipment.', $result);
    }

    public function test_to_concise_paragraph_caps_at_three_sentences(): void
    {
        $input = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.';

        $result = AIRecommendationService::toConciseParagraph($input);

        $this->assertSame('Sentence one. Sentence two. Sentence three.', $result);
    }

    public function test_to_concise_paragraph_caps_long_wordy_reason(): void
    {
        $input = implode(' ', array_fill(0, 100, 'word'));

        $result = AIRecommendationService::toConciseParagraph($input);

        $this->assertLessThanOrEqual(70, str_word_count($result));
        $this->assertStringNotContainsString("\n", $result);
    }
}
