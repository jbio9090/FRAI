<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExternalEquipment extends Model
{
    /** @use HasFactory<\Database\Factories\ExternalEquipmentFactory> */
    use HasFactory;

    protected $fillable = ['request_facility_id', 'name'];

    public function requestFacility()
    {
        return $this->belongsTo(RequestFacility::class);
    }
}
