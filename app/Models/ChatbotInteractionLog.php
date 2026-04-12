<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotInteractionLog extends Model
{
    protected $fillable = [
        'user_id',
        'facility_request_id',
        'session_id',
        'interaction_type',
        'intent',
        'user_message',
        'assistant_message',
        'context_data',
        'generated_payload',
        'validation_result',
        'status',
    ];

    protected $casts = [
        'context_data' => 'array',
        'generated_payload' => 'array',
        'validation_result' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function facilityRequest(): BelongsTo
    {
        return $this->belongsTo(Request::class, 'facility_request_id');
    }
}
