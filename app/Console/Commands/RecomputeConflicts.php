<?php

namespace App\Console\Commands;

use App\Models\Request as FacilityRequest;
use App\Services\RequestService;
use Illuminate\Console\Command;

class RecomputeConflicts extends Command
{
    protected $signature = 'app:recompute-conflicts';

    protected $description = 'Recompute time conflicts for all blocking requests, purging stale cross-date RF ids.';

    public function handle(RequestService $service): void
    {
        $statuses = collect(RequestService::BLOCKING_STATUSES)
            ->map(fn ($s) => $s instanceof \BackedEnum ? $s->value : $s)
            ->all();

        $ids = FacilityRequest::where('on_hold', false)
            ->whereIn('status', $statuses)
            ->orderBy('id')
            ->pluck('id');

        if ($ids->isEmpty()) {
            $this->info('No blocking requests to recompute.');

            return;
        }

        $this->info("Recomputing conflicts for {$ids->count()} request(s)...");

        foreach ($ids as $id) {
            $request = FacilityRequest::with('requestFacilities')->find($id);
            if (! $request) {
                continue;
            }

            $service->detectAndStoreConflicts($request);
        }

        $this->info('Done.');
    }
}
