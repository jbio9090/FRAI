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

    protected static function boot(): void
    {
        parent::boot();

        // Automatically remove the vector embedding whenever a rule is deleted,
        // keeping the rule_embeddings table in sync without any manual cleanup.
        static::deleting(function (Rule $rule): void {
            $rule->embedding()->delete();
        });
    }

    public function embedding()
    {
        return $this->hasOne(RuleEmbedding::class);
    }

    public function scopePolicy($query)
    {
        return $query->where('forPolicy', 0);
    }

    public function scopeFaq($query)
    {
        return $query->where('forPolicy', 1);
    }
}