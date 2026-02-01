<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequestFacility extends Model
{
    protected $fillable = [
        'request_id',
        'facility_id',
        'date_requested',
        'time_start',
        'time_end',
    ];

    public function request()
    {
        return $this->belongsTo(Request::class);
    }

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
}