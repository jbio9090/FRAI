<?php

namespace App\Models;

use App\Enums\RequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Equipment extends Model
{
    use HasFactory;

    protected $table = 'equipments';

    protected $fillable = [
        'name',
        'quantity',
    ];

    public function facilities()
    {
        return $this->belongsToMany(Facility::class, 'facility_equipment')
            ->withPivot('quantity')
            ->withTimestamps()
            ->using(FacilityEquipment::class);
    }

    public function requests()
    {
        return $this->belongsToMany(Request::class, 'request_equipment')
            ->withPivot('quantity_needed')
            ->withTimestamps();
    }

    public function facilityEquipments()
    {
        return $this->hasMany(FacilityEquipment::class);
    }

    public function quantityInFacility(int $facilityId): int
    {
        return FacilityEquipment::where('facility_id', $facilityId)
            ->where('equipment_id', $this->id)
            ->value('quantity') ?? 0;
    }

    /**
     * Total quantity consumed globally in an approved/conditionally-approved
     * request that overlaps the given window. Counts both in-house usage and
     * borrowed equipment (each row in request_equipment is real consumption).
     */
    public function quantityAllocated(
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): int {
        return $this->requests()
            ->whereIn('requests.status', [
                RequestStatus::APPROVED,
                RequestStatus::CONDITIONALLY_APPROVED,
            ])
            ->where('requests.on_hold', false)
            ->whereHas('requestFacilities', function ($q) use ($date, $timeStart, $timeEnd) {
                $q->where('date_requested', $date)
                    ->where('time_start', '<', $timeEnd)
                    ->where('time_end', '>', $timeStart);
            })
            ->when($excludeRequestId, fn ($q) => $q->where('requests.id', '!=', $excludeRequestId))
            ->sum('request_equipment.quantity_needed');
    }

    public function quantityAvailable(
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): int {
        return $this->quantity - $this->quantityAllocated($date, $timeStart, $timeEnd, $excludeRequestId);
    }

    /**
     * Available quantity specifically within a facility, accounting for:
     *   1. In-house use  — approved requests that use this equipment AT this facility
     *   2. Borrowed away — approved requests that borrowed this equipment FROM this facility
     */
    public function quantityAvailableInFacility(
        int $facilityId,
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): int {
        return $this->slotAvailabilityInFacility(
            $facilityId,
            $date,
            $timeStart,
            $timeEnd,
            $excludeRequestId
        )['remaining_quantity'];
    }

    /**
     * Deterministic slot-aware summary for one facility.
     *
     * `reserved_quantity` includes:
     * 1) In-house usage in the same facility
     * 2) Borrowed rows sourced from the same facility
     */
    public function slotAvailabilityInFacility(
        int $facilityId,
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): array {
        $total = $this->quantityInFacility($facilityId);
        $reserved = $this->quantityReservedInFacility(
            $facilityId,
            $date,
            $timeStart,
            $timeEnd,
            $excludeRequestId
        );
        $remaining = max(0, $total - $reserved);

        return [
            'total_quantity' => $total,
            'reserved_quantity' => $reserved,
            'remaining_quantity' => $remaining,
        ];
    }

    /**
     * Units of this equipment committed by requests whose booking slot overlaps
     * the given window at the given facility.
     *
     * Two things this deliberately keys off `request_facilities`:
     *
     * 1. Reservation status is read from the BOOKING row (`rf.status`), never
     *    the parent request. `approveFacility()` sets the slot's status and
     *    only then reconciles the parent, so a facility-level approval leaves a
     *    `Partially Approved` parent over an `Approved` slot. Filtering on the
     *    parent hid that stock; filtering on the slot also stops `Denied` and
     *    `For Reschedule` slots under a Partially Approved parent from
     *    reserving stock. This matches how `checkForConflicts()` classifies.
     *
     * 2. `request_equipment` is joined to `request_facilities` on its own
     *    foreign key rather than via a `whereExists` correlated only on
     *    `request_id`. Without the row-level link, one request holding this
     *    equipment on two non-overlapping bookings at the same facility
     *    double-counted both rows against any single window.
     *
     * A row is reserved when it is either used in-house at `$facilityId`, or
     * borrowed away *from* `$facilityId` (the borrow happens at the borrowing
     * facility, so the slot's own facility is irrelevant there).
     */
    public function quantityReservedInFacility(
        int $facilityId,
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): int {
        $reserved = DB::table('request_equipment as re')
            ->join('request_facilities as rf', 'rf.id', '=', 're.request_facility_id')
            ->join('requests as r', 'r.id', '=', 'rf.request_id')
            ->where('re.equipment_id', $this->id)
            ->whereIn('rf.status', [
                RequestStatus::APPROVED->value,
                RequestStatus::CONDITIONALLY_APPROVED->value,
            ])
            ->where('r.on_hold', false)
            ->when($excludeRequestId, fn ($q) => $q->where('r.id', '!=', $excludeRequestId))
            ->where('rf.date_requested', $date)
            ->where('rf.time_start', '<', $timeEnd)
            ->where('rf.time_end', '>', $timeStart)
            ->where(function ($q) use ($facilityId) {
                $q->where(function ($inHouse) use ($facilityId) {
                    $inHouse
                        ->where('re.is_borrowed', false)
                        ->where('rf.facility_id', $facilityId);
                })->orWhere(function ($borrowedAway) use ($facilityId) {
                    $borrowedAway
                        ->where('re.is_borrowed', true)
                        ->where('re.source_facility_id', $facilityId);
                });
            })
            ->sum('re.quantity_needed');

        return max(0, (int) $reserved);
    }

    public function quantityAvailableToBorrowFrom(
        int $sourceFacilityId,
        string $date,
        string $timeStart,
        string $timeEnd,
        ?int $excludeRequestId = null
    ): int {
        return $this->quantityAvailableInFacility(
            $sourceFacilityId,
            $date,
            $timeStart,
            $timeEnd,
            $excludeRequestId
        );
    }
}
