<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Pgvector\Laravel\Vector;

class RuleEmbedding extends Model
{
    protected $fillable = ['rule_id', 'content', 'embedding'];

    protected function casts(): array
    {
        $driver = config('database.default');

        return [
            'embedding' => $driver === 'pgsql' ? Vector::class : 'array',
        ];
    }

    public function rule()
    {
        return $this->belongsTo(Rule::class);
    }
}
