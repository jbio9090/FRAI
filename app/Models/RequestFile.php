<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class RequestFile extends Model
{
    protected $fillable = [
        'request_id',
        'path',
        'original_name',
        'mime_type',
        'size',
    ];

    public function request()
    {
        return $this->belongsTo(Request::class);
    }

    public function getUrlAttribute(): string
    {
        return Storage::url($this->path);
    }
}
