<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\RAG\RuleIndexingService;

class IndexRules extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:index-rules';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle(RuleIndexingService $indexer): void
    {
        $this->info('Indexing rules...');
        $indexer->indexAll();
        $this->info('Done.');
    }
}
