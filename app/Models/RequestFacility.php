<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Request as RequestModel;

class RequestFacility extends Model
{
    protected $fillable = [
        'request_id',
        'facility_id',
        'date_requested',
        'time_start',
        'time_end',
        'expected_capacity',
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
}
