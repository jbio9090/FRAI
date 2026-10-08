<?php

namespace App\Services;

use App\Models\Equipment;
use App\Models\Facility;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Checks a submission's equipment demand against what each facility actually
 * has free in the overlapping slot.
 *
 * Availability is defined by Equipment::quantityReservedInFacility(): a facility
 * owns `facility_equipment.quantity` units, and only requests whose BOOKING row
 * is Approved or Conditionally Approved take them out of circulation. Pending
 * requests are a soft signal (the amber "also requested by" note), not a hold.
 *
 * Demand must be aggregated across the whole submission rather than validated
 * booking-by-booking: two bookings for the same facility, date and overlapping
 * time that each ask for half the stock are individually fine and jointly
 * impossible.
 */
class EquipmentAvailabilityService
{
    /**
     * Serialises concurrent submissions by locking the facilities' stock rows.
     * Callers run this inside the write transaction, then re-check, so two
     * simultaneous requests cannot both pass a check made against the same
     * pre-commit numbers.
     *
     * @param  array<int, int>  $facilityIds
     */
    public function lockFacilityEquipmentRows(array $facilityIds): void
    {
        $facilityIds = array_values(array_unique(array_filter($facilityIds)));

        if ($facilityIds === []) {
            return;
        }

        DB::table('facility_equipment')
            ->whereIn('facility_id', $facilityIds)
            ->orderBy('facility_id')
            ->orderBy('equipment_id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * Every facility and equipment the submission touches, for locking.
     *
     * @param  array<int, array<string, mixed>>  $bookings
     * @return array<int, int>
     */
    public function involvedFacilityIds(array $bookings): array
    {
        return collect($bookings)
            ->flatMap(fn ($booking) => collect([
                $booking['facility_id'] ?? null,
                collect($booking['borrowed_equipment'] ?? [])
                    ->pluck('source_facility_id')
                    ->all(),
            ])->flatten()->all())
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Every equipment row for one facility on one date, with what is free.
     *
     * @return array<int, array<string, mixed>>
     */
    public function availabilityForFacilityDate(
        Facility $facility,
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): array {
        $facilityId = (int) $facility->id;

        return $facility->equipment
            ->map(function (Equipment $equipment) use ($facilityId, $date, $timeStart, $timeEnd, $excludeRequestId) {
                $slot = $equipment->slotAvailabilityInFacility(
                    $facilityId,
                    $date,
                    $timeStart,
                    $timeEnd,
                    $excludeRequestId
                );

                return [
                    'equipment_id' => $equipment->id,
                    'equipment_name' => $equipment->name,
                    'total_quantity' => $slot['total_quantity'],
                    'reserved_quantity' => $slot['reserved_quantity'],
                    'available_quantity' => $slot['remaining_quantity'],
                    'is_limited' => $slot['remaining_quantity'] < $slot['total_quantity'],
                    'is_empty' => $slot['remaining_quantity'] <= 0,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $bookings
     * @return array<int, array<string, mixed>> Violation messages keyed by field path.
     */
    public function violations(array $bookings, ?int $excludeRequestId = null): array
    {
        $demands = $this->collectDemand($bookings);

        if ($demands === []) {
            return [];
        }

        // Group per facility + equipment + date, then demand within a group is
        // only cumulative for entries whose windows actually intersect.
        $grouped = [];
        foreach ($demands as $demand) {
            $grouped[$demand['facility_id'].'|'.$demand['equipment_id'].'|'.$demand['date']][] = $demand;
        }

        $equipmentById = Equipment::whereIn('id', array_values(array_unique(array_column($demands, 'equipment_id'))))
            ->get()
            ->keyBy('id');

        $violations = [];

        foreach ($grouped as $group) {
            foreach ($group as $demand) {
                $concurrentDemand = 0;
                foreach ($group as $other) {
                    if ($this->overlaps($demand, $other)) {
                        $concurrentDemand += $other['quantity'];
                    }
                }

                $equipment = $equipmentById->get($demand['equipment_id']);

                if (! $equipment) {
                    continue;
                }

                $remaining = $equipment->slotAvailabilityInFacility(
                    $demand['facility_id'],
                    $demand['date'],
                    $demand['time_start'],
                    $demand['time_end'],
                    $excludeRequestId
                )['remaining_quantity'];

                if ($concurrentDemand <= $remaining) {
                    continue;
                }

                $violations[$demand['field']] = $this->message(
                    $equipment->name,
                    $concurrentDemand,
                    $remaining,
                    $demand['facility_id'],
                    $demand['is_borrowed']
                );
            }
        }

        return $violations;
    }

    /**
     * @param  array<int, array<string, mixed>>  $bookings
     * @return array<int, array<string, mixed>>
     */
    private function collectDemand(array $bookings): array
    {
        $demands = [];

        foreach ($bookings as $bookingIndex => $booking) {
            $date = Carbon::parse($booking['date'] ?? 'now')->format('Y-m-d');
            $timeStart = substr((string) ($booking['time_start'] ?? ''), 0, 5);
            $timeEnd = substr((string) ($booking['time_end'] ?? ''), 0, 5);

            foreach ($booking['equipment'] ?? [] as $itemIndex => $item) {
                $demands[] = [
                    'facility_id' => (int) $booking['facility_id'],
                    'equipment_id' => (int) ($item['equipment_id'] ?? 0),
                    'date' => $date,
                    'time_start' => $timeStart,
                    'time_end' => $timeEnd,
                    'quantity' => (int) ($item['quantity_needed'] ?? 0),
                    'is_borrowed' => false,
                    'field' => "facility_bookings.{$bookingIndex}.equipment.{$itemIndex}.quantity_needed",
                ];
            }

            foreach ($booking['borrowed_equipment'] ?? [] as $itemIndex => $item) {
                $sourceFacilityId = $item['source_facility_id'] ?? null;

                if ($sourceFacilityId === null) {
                    continue;
                }

                // Borrowed stock belongs to the source facility's pool, so that
                // is the facility the check has to be made against.
                $demands[] = [
                    'facility_id' => (int) $sourceFacilityId,
                    'equipment_id' => (int) ($item['equipment_id'] ?? 0),
                    'date' => $date,
                    'time_start' => $timeStart,
                    'time_end' => $timeEnd,
                    'quantity' => (int) ($item['quantity_needed'] ?? 0),
                    'is_borrowed' => true,
                    'field' => "facility_bookings.{$bookingIndex}.borrowed_equipment.{$itemIndex}.quantity_needed",
                ];
            }
        }

        return $demands;
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private function overlaps(array $a, array $b): bool
    {
        if ($a['facility_id'] !== $b['facility_id'] || $a['equipment_id'] !== $b['equipment_id'] || $a['date'] !== $b['date']) {
            return false;
        }

        return $a['time_start'] < $b['time_end'] && $a['time_end'] > $b['time_start'];
    }

    private function message(string $name, int $requested, int $remaining, int $facilityId, bool $isBorrowed): string
    {
        // Same wording as the chatbot path so both entry points read identically.
        return $isBorrowed
            ? "{$name}: requested {$requested} borrowed unit(s), but only {$remaining} remaining from facility ID {$facilityId} for the selected time slot."
            : "{$name}: requested {$requested} unit(s), but only {$remaining} remaining in this facility for the selected time slot.";
    }
}
