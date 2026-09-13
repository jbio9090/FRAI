<?php

namespace App\Enums;

enum RequestStatus: string
{
    case PENDING = 'Pending';
    case APPROVED = 'Approved';
    case DENIED = 'Denied';
    case CONDITIONALLY_APPROVED = 'Conditionally Approved';
    case ON_HOLD = 'On Hold';
    case FOR_RESCHEDULE = 'For Reschedule';

    case PARTIALLY_APPROVED = 'Partially Approved';

    /**
     * Resolve a status from a filter string, accepting either the enum
     * name (e.g. partially_approved) or the stored value
     * (e.g. Partially Approved), case-insensitively.
     */
    public static function tryFromFilter(string $value): ?self
    {
        $normalized = strtolower(trim($value));
        $normalized = str_replace(['-', ' '], '_', $normalized);

        foreach (self::cases() as $case) {
            if (strtolower($case->name) === $normalized) {
                return $case;
            }

            $valueNormalized = strtolower($case->value);
            $valueNormalized = str_replace(['-', ' '], '_', $valueNormalized);

            if ($valueNormalized === $normalized) {
                return $case;
            }
        }

        return null;
    }
}
