<?php

namespace App\Casts;

use App\Enums\AuditEvent;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

class AuditEventCast implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): AuditEvent
    {
        return AuditEvent::tryFrom($value) ?? AuditEvent::Unknown;
    }

    public function set($model, string $key, $value, array $attributes)
    {
        return [$key => $value instanceof AuditEvent ? $value->value : $value];
    }
}
