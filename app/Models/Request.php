<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\Models\User;
use App\RequestStatus;

class Request extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'description',
        'status',
    ];

    protected $casts = [
        'status' => RequestStatus::class
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function requestFacilities()
    {
        return $this->hasMany(RequestFacility::class);
    }

    public function facilities()
    {
        return $this->belongsToMany(Facility::class, 'request_facilities')
            ->withPivot('date_requested', 'time_start', 'time_end')
            ->withTimestamps();
    }
}