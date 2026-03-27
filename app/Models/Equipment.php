<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
            ->whereHas('facilities', function ($q) use ($date, $timeStart, $timeEnd) {
                $q->wherePivot('date_requested', $date)
                    ->wherePivot('time_start', '<', $timeEnd)
                    ->wherePivot('time_end', '>', $timeStart);
            })
            ->when($excludeRequestId, fn($q) => $q->where('requests.id', '!=', $excludeRequestId))
            ->sum('request_equipment.quantity_needed');
    }

    public function quantityAvailable(string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        return $this->quantity - $this->quantityAllocated($date, $timeStart, $timeEnd, $excludeRequestId);
    }

    public function quantityInFacility(int $facilityId): int
    {
        // Uses FacilityEquipment model directly — cleaner than going through the pivot
        return FacilityEquipment::where('facility_id', $facilityId)
            ->where('equipment_id', $this->id)
            ->value('quantity') ?? 0;
    }

    public function quantityAvailableInFacility(int $facilityId, string $date, string $timeStart, string $timeEnd, ?int $excludeRequestId = null): int
    {
        $facilityHolds  = $this->quantityInFacility($facilityId);
        $globalAvailable = $this->quantityAvailable($date, $timeStart, $timeEnd, $excludeRequestId);

        return min($facilityHolds, max(0, $globalAvailable));
    }
}
