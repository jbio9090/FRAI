<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Request as RequestModel;
use App\RequestStatus;

class RequestFacility extends Model
{
    protected $fillable = [
        'request_id',
        'facility_id',
        'date_requested',
        'time_start',
        'time_end',
        'expected_capacity',
        'has_outsiders',
        'status',
    ];

    protected $casts = [
        'status' => RequestStatus::class,
    ];

    public function request()
    {
        return $this->belongsTo(RequestModel::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function externalEquipments()
    {
        return $this->hasMany(ExternalEquipment::class);
    }

    public function equipment()
    {
        return $this->belongsToMany(Equipment::class, 'request_equipment', 'request_facility_id', 'equipment_id')
            ->withPivot(['request_id', 'quantity_needed', 'is_borrowed', 'source_facility_id'])
            ->withTimestamps();
    }
}
