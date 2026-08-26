<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequestFile extends Model
{
    protected $fillable = [
        'request_id',
        'path',
        'original_name',
        'mime_type',
        'size',
    ];

    protected $appends = ['url'];

    public function request()
    {
        return $this->belongsTo(Request::class);
    }

    public function getUrlAttribute(): string
    {
        return route('files.stream', $this->id);
    }
}