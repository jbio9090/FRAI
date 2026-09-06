<?php

namespace App\Jobs;

use App\Models\Rule;
use App\Services\RAG\RuleIndexingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class IndexRuleEmbedding implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public Rule $rule) {}

    public function handle(RuleIndexingService $indexer): void
    {
        $indexer->indexRule($this->rule);
    }

    public function failed(\Throwable $e): void
    {
        \Log::warning("Failed to index rule #{$this->rule->id}: {$e->getMessage()}");
    }
}
