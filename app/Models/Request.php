<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\Models\User;
use App\RequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Request extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'title',
        'description',
        'status',
        'priority_level',
        'on_hold',
        'priority_reason',
        'held_by_request_id',
    ];

    protected $casts = [
        'status'         => RequestStatus::class,
        'on_hold'        => 'boolean',
        'priority_level' => 'integer',
    ];

    /**
     * Priority level labels
     * 0 = Normal
     * 1 = School Event (department heads, school-wide events)
     * 2 = Government / High Authority (government officials, external high-priority)
     */
    public const PRIORITY_NORMAL     = 0;
    public const PRIORITY_SCHOOL     = 1;
    public const PRIORITY_GOVERNMENT = 2;

    public static function priorityLabel(int $level): string
    {
        return match ($level) {
            self::PRIORITY_SCHOOL     => 'School Event',
            self::PRIORITY_GOVERNMENT => 'Government / High Authority',
            default                   => 'Normal',
        };
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
}
