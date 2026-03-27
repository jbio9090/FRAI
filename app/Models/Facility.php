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
        'capacity',
    ];

    public function equipment()
    {
        return $this->belongsToMany(Equipment::class, 'facility_equipment')
            ->withPivot('quantity')
            ->withTimestamps()
            ->using(FacilityEquipment::class); // use our model for the pivot
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
