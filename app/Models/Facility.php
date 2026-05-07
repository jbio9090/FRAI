<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Facility extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'building',
        'campus_id',
        'building_id',
        'capacity',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function buildingRecord()
    {
        return $this->belongsTo(Building::class, 'building_id');
    }

    public function equipment()
    {
        return $this->belongsToMany(Equipment::class, 'facility_equipment')
            ->withPivot('quantity')
            ->withTimestamps()
            ->using(FacilityEquipment::class);
    }

    public function facilityEquipments()
    {
        return $this->hasMany(FacilityEquipment::class);
    }

    public function requests()
    {
        return $this->belongsToMany(Request::class, 'request_facilities')
            ->withPivot('date_requested', 'time_start', 'time_end')
            ->withTimestamps();
    }
}
