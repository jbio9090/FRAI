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
        'external_equipment',
    ];

    public function request()
    {
        return $this->belongsTo(RequestModel::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
}