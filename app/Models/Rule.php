<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Rule extends Model
{
    /** @use HasFactory<\Database\Factories\RulesFactory> */
    use HasFactory;

    protected $fillable = ["rule", "priority", "forPolicy", "faq_answer"];

    protected $casts = [
        'forPolicy' => 'integer',
    ];

    public function scopePolicy($query)
    {
        return $query->where('forPolicy', 0);
    }

    public function scopeFaq($query)
    {
        return $query->where('forPolicy', 1);
    }
}
