<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Campus extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
    ];

    public function buildings()
    {
        return $this->hasMany(Building::class);
    }

    public function facilities()
    {
        return $this->hasMany(Facility::class);
    }
}
