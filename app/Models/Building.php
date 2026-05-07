<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Building extends Model
{
    use HasFactory;

    protected $fillable = [
        'campus_id',
        'name',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function facilities()
    {
        return $this->hasMany(Facility::class);
    }
}
