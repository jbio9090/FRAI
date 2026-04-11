<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Pgvector\Laravel\Vector;

class RuleEmbedding extends Model
{
    protected $fillable = ['rule_id', 'content', 'embedding'];

    protected $casts = [
        'embedding' => Vector::class,
    ];

    public function rule()
    {
        return $this->belongsTo(Rule::class);
    }
}