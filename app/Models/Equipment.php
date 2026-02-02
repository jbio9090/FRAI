<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Facility;
use App\Models\Request;

class Equipment extends Model
{
    /** @use HasFactory<\Database\Factories\EquipmentFactory> */
    use HasFactory;

    protected $table = "equipments";

    protected $fillable = [
        "name",
        "quantity",
        "facility_id",
    ];

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function requests()
    {
        return $this->belongsToMany(Request::class, 'request_equipment')
            ->withPivot('quantity_needed')
            ->withTimestamps();
    }
}
