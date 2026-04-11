<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\RequestStatus;

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
            ->using(FacilityEquipment::class); // use our model for the pivot
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

    public function quantityAllocated(string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        return $this->requests()
            ->whereIn('requests.status', [
                RequestStatus::APPROVED,
                RequestStatus::CONDITIONALLY_APPROVED,
            ])
            ->where('requests.on_hold', false)
            ->whereHas('facilities', function ($q) use ($date, $timeStart, $timeEnd) {
                $q->where('request_facilities.date_requested', $date)
                    ->where('request_facilities.time_start', '<', $timeEnd)
                    ->where('request_facilities.time_end', '>', $timeStart);
            })
            ->when($excludeRequestId, fn($q) => $q->where('requests.id', '!=', $excludeRequestId))
            ->sum('request_equipment.quantity_needed');
    }

    public function quantityAvailableInFacility(int $facilityId, string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        $facilityHolds   = $this->quantityInFacility($facilityId);
        $globalAvailable = $this->quantityAvailable($date, $timeStart, $timeEnd, $excludeRequestId);

        return min($facilityHolds, max(0, $globalAvailable));
    }

    public function quantityAvailableToBorrowFrom(int $sourceFacilityId, string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        return $this->quantityAvailableInFacility(
            $sourceFacilityId,
            $date,
            $timeStart,
            $timeEnd,
            $excludeRequestId
        );
    }

    public function quantityAvailable(string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        return $this->quantity - $this->quantityAllocated($date, $timeStart, $timeEnd, $excludeRequestId);
    }

    public function quantityInFacility(int $facilityId): int
    {
        return FacilityEquipment::where('facility_id', $facilityId)
            ->where('equipment_id', $this->id)
            ->value('quantity') ?? 0;
    }
}
