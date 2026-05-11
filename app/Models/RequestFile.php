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

    protected $appends = ['url'];

    public function request()
    {
        return $this->belongsTo(Request::class);
    }

    public function getUrlAttribute(): string
    {
        // Prefer asking the StorageService for the public URL so we get the
        // exact `secure_url` that Cloudinary reports (includes version etc).
        if (is_string($this->path) && str_starts_with($this->path, 'cloudinary://')) {
            try {
                $url = app(\App\Services\StorageService::class)->getPublicUrl($this->path);
                if (is_string($url) && $url !== '') {
                    return $url;
                }
            } catch (\Throwable $e) {
                // fall back to previous behavior below if admin lookup fails
            }
        }

        return Storage::url($this->path);
    }
}
