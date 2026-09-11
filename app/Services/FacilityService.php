<?php

namespace App\Services;

use App\Enums\FacilityStatus;
use App\Enums\RequestStatus;
use App\Models\RequestFacility;
use Illuminate\Support\Collection;

class FacilityService
{
    public function getSchedule(int $facility_id, string $start, string $end): Collection
    {
        $events = RequestFacility::query()
            ->whereBetween('date_requested', [$start, $end])
            // Row-level visibility: per-facility decisions leave approved
            // rows under non-approved parents (e.g. Partially Approved), so
            // the row status decides visibility, not the parent status.
            // Held (on hold) parents are included: their approved rows still
            // occupy the slot until rescheduled. This is display-only —
            // approve-time conflict scans in RequestService still exclude
            // on-hold requests.
            ->whereIn('status', [
                RequestStatus::APPROVED,
                RequestStatus::CONDITIONALLY_APPROVED,
            ])
            ->where('facility_id', $facility_id)
            ->whereHas('facility', function ($query) {
                $query->where('status', FacilityStatus::ACTIVE);
            })
            ->with(['request:id,title', 'facility:id,name'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id' => $booking->id,
                    'title' => $booking->request->title,
                    'start' => $booking->date_requested.'T'.$booking->time_start,
                    'end' => $booking->date_requested.'T'.$booking->time_end,
                    'request_id' => $booking->request->id,
                ];
            });

        return $events;
    }

    public function getDaySchedule(int $facility_id, string $date)
    {
        $eventsThisDay = RequestFacility::where('facility_id', $facility_id)
            ->where('date_requested', $date)
            // Row-level visibility, same as getSchedule(): the row status
            // decides, and held (on hold) parents are included. Display-only.
            ->whereIn('status', [
                RequestStatus::APPROVED,
                RequestStatus::CONDITIONALLY_APPROVED,
            ])
            ->whereHas('facility', function ($query) {
                $query->where('status', FacilityStatus::ACTIVE);
            })
            ->with('request:id,title,status')
            ->get()
            ->map(function ($booking) {
                return [
                    'request_title' => $booking->request->title,
                    'status' => $booking->status,
                    'time_start' => $booking->time_start,
                    'time_end' => $booking->time_end,
                    'request_id' => $booking->request->id,
                ];
            });

        return $eventsThisDay;
    }

    public function getAllSchedule(string $start, string $end): Collection
    {
        return RequestFacility::query()
            ->whereBetween('date_requested', [$start, $end])
            // Row-level visibility, same as getSchedule(): per-facility
            // decisions leave approved rows under non-approved parents
            // (e.g. Partially Approved), and held (on hold) parents are
            // included. Display-only.
            ->whereIn('status', [
                RequestStatus::APPROVED,
                RequestStatus::CONDITIONALLY_APPROVED,
            ])
            ->whereHas('facility', function ($query) {
                $query->where('status', FacilityStatus::ACTIVE);
            })
            ->with(['request:id,title', 'facility:id,name,building'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id' => $booking->id,
                    'title' => $booking->facility->name.' — '.$booking->request->title,
                    'start' => $booking->date_requested.'T'.$booking->time_start,
                    'end' => $booking->date_requested.'T'.$booking->time_end,
                    'request_id' => $booking->request->id,
                    'building' => $booking->facility->building,
                ];
            });
    }
}
