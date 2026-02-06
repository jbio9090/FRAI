<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Equipment;
use App\Models\Request;

class Facility extends Model
{
    /** @use HasFactory<\Database\Factories\FacilityFactory> */
    use HasFactory;


    protected $fillable = [
        'name',
        'building',
        'capacity',
    ];

    public function equipments() {
        return $this->hasMany(Equipment::class);
    }

    public function requests()
    {
        return $this->belongsToMany(Request::class, "request_facilities")
            ->withPivot("date_requested", "time_start", "time_end")
            ->withTimestamps();
    }
}
