<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\Models\User;
use App\PriorityLevel;
use App\RequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Request extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'facility_id',
        'date',
        'start_time',
        'end_time',
        'participants',
        'priority_level',
        'recommended_action',
        'recommended_action_reason',
        'status',
        'overridden_by_request_id',
        'title',
        'description',
        'on_hold',
        'priority_reason',
        'held_by_request_id',
    ];

    protected $casts = [
        'status'         => RequestStatus::class,
        'on_hold'        => 'boolean',
        'priority_level' => PriorityLevel::class,
    ];

    /* =========================================
     | RELATIONSHIPS
     ========================================= */

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function requestFacilities()
    {
        return $this->hasMany(RequestFacility::class);
    }

    public function facilities()
    {
        return $this->belongsToMany(Facility::class, 'request_facilities')
            ->withPivot('date_requested', 'time_start', 'time_end')
            ->withTimestamps();
    }

    public function equipment()
    {
        return $this->belongsToMany(Equipment::class, 'request_equipment')
            ->withPivot('quantity_needed')
            ->withTimestamps();
    }

    public function overriddenBy()
    {
        return $this->belongsTo(Request::class, 'overridden_by_request_id');
    }

    /** The higher-priority request that caused this one to be put on hold */
    public function heldByRequest()
    {
        return $this->belongsTo(Request::class, 'held_by_request_id');
    }

    /** Requests that were put on hold because of this request */
    public function heldRequests()
    {
        return $this->hasMany(Request::class, 'held_by_request_id');
    }

    /* SCOPES */

    public function scopeConflicting(Builder $query, $facilityId, $date, $start, $end)
    {
        return $query->where('facility_id', $facilityId)
            ->where('date', $date)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('start_time', [$start, $end])
                  ->orWhereBetween('end_time', [$start, $end])
                  ->orWhere(function ($inner) use ($start, $end) {
                      $inner->where('start_time', '<=', $start)
                            ->where('end_time', '>=', $end);
                  });
            })
            ->whereIn('status', ['Pending', 'Approved']);
    }

    /* =========================================
     | PRIORITY OVERRIDE LOGIC
     ========================================= */

    public function handlePriorityConflict()
    {
        $conflicts = self::conflicting(
            $this->facility_id,
            $this->date,
            $this->start_time,
            $this->end_time
        )->get();

        foreach ($conflicts as $existing) {

            if ($this->priority_level > $existing->priority_level) {

                $existing->status = 'On Hold';
                $existing->overridden_by_request_id = $this->id;
                $existing->save();

            } elseif ($this->priority_level < $existing->priority_level) {

                $this->status = 'On Hold';
                $this->save();

                return false;
            } else {

                $this->status = 'Pending Review';
                $this->save();

                return false;
            }
        }

        return true;
    }
}