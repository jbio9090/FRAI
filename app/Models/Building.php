<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Building extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'campus_id',
        'name',
    ];

    public function campus()
    {
        return $this->belongsTo(Campus::class)->withTrashed();
    }

    public function facilities()
    {
        return $this->hasMany(Facility::class);
    }
}
