<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\Pivot; 

class FacilityEquipment extends Pivot
{
    use HasFactory;

    protected $table = 'facility_equipment';

    protected $fillable = [
        'facility_id',
        'equipment_id',
        'quantity',
    ];

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function equipment()
    {
        return $this->belongsTo(Equipment::class);
    }
}
