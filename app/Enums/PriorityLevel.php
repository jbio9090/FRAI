<?php

namespace App\Enums;

enum PriorityLevel: int
{
    case Academic = 0;
    case Organization = 1;
    case University = 2;
    case Government = 3;

    public function label(): string
    {
        return match ($this) {
            self::Academic => 'Academic',
            self::Organization => 'Organization',
            self::University => 'University',
            self::Government => 'Government',
        };
    }

    public function icon(): ?string
    {
        return match ($this) {
            self::Academic => 'BookMarked',
            self::Organization => 'UsersRound',
            self::University => 'GraduationCap',
            self::Government => 'Landmark',
        };
    }
}
