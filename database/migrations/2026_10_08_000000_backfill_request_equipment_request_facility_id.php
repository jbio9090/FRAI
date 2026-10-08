<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * request_equipment.request_facility_id was added after the table, so rows
 * created before it can sit NULL. Equipment availability is computed by
 * joining that column straight to the booking row, which means an orphaned
 * row silently stops reserving anything — a facility would look fully stocked
 * while an approved booking still holds the units.
 *
 * Attach each orphan to the booking that actually consumed it: the same
 * request's slot, at a facility that holds that equipment (for in-house use)
 * or at any facility other than the source (for borrowed use), preferring a
 * slot on the same date with an overlapping window.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('request_equipment') || ! Schema::hasColumn('request_equipment', 'request_facility_id')) {
            return;
        }

        DB::table('request_equipment')
            ->whereNull('request_facility_id')
            ->orderBy('id')
            ->chunkById(200, function ($orphans) {
                foreach ($orphans as $orphan) {
                    $facilityId = $this->resolveFacilityId($orphan);

                    if ($facilityId !== null) {
                        DB::table('request_equipment')
                            ->where('id', $orphan->id)
                            ->update(['request_facility_id' => $facilityId]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Nothing to undo: only NULLs were filled in, and an already-correct
        // booking link is indistinguishable from a backfilled one.
    }

    /**
     * @param  object{id:int, request_id:int, equipment_id:int, is_borrowed:bool|int, source_facility_id:int|null}  $orphan
     */
    private function resolveFacilityId(object $orphan): ?int
    {
        $holdingFacilities = DB::table('facility_equipment')
            ->where('equipment_id', $orphan->equipment_id)
            ->pluck('facility_id')
            ->all();

        $query = DB::table('request_facilities')
            ->where('request_id', $orphan->request_id)
            ->select('id', 'facility_id', 'date_requested');

        if ((bool) $orphan->is_borrowed) {
            // Borrowed equipment is consumed at the borrowing facility, which
            // is by definition not the facility it was borrowed from.
            $query->where('facility_id', '!=', $orphan->source_facility_id);
        } else {
            $query->whereIn('facility_id', $holdingFacilities);
        }

        $candidates = $query->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        // Prefer the latest-dated slot: an orphan row has no reliable pointer
        // to its date, and later bookings are the ones that still conflict.
        $best = $candidates->sortByDesc('date_requested')->first();

        return $best?->id;
    }
};
