<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequestRescheduleSuggestion extends Model
{
    protected $fillable = [
        'request_id',
        'chosen_by_admin_id',
        'facility_id',
        'facility_name',
        'date',
        'time_start',
        'time_end',
        'type',
        'facility_capacity',
        'capacity_fit',
        'equipment_available',
    ];

    protected $casts = [
        'date' => 'date',
        'time_start' => 'datetime:H:i',
        'time_end' => 'datetime:H:i',
        'equipment_available' => 'boolean',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(Request::class);
    }

    public function chosenByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chosen_by_admin_id');
    }

    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class, 'facility_id');
    }
}