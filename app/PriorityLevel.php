<?php

namespace App;

enum PriorityLevel: int
{
    case Normal     = 0;
    case School     = 1;
    case Government = 2;

    public function label(): string
    {
        return match ($this) {
            self::Normal     => 'Normal',
            self::School     => 'School Event',
            self::Government => 'Government / High Authority',
        };
    }
}
