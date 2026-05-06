<?php

namespace App\Models;

use App\Enums\AuditEvent; // <-- Added the Enum import
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'event',
        'subject_type',
        'subject_id',
        'description',
        'properties',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'properties' => 'array',
        'event' => AuditEvent::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeForEvent($query, string|AuditEvent $event)
    {
        return $query->where('event', $event);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForSubject($query, Model $subject)
    {
        return $query
            ->where('subject_type', get_class($subject))
            ->where('subject_id', $subject->getKey());
    }
}
