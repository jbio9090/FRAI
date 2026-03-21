<?php

namespace App\Services;

use App\Models\RequestFacility;
use App\RequestStatus;
use Illuminate\Support\Collection;

class FacilityService
{
    public function getSchedule(int $facility_id, string $start, string $end,): Collection
    {
        $events = RequestFacility::query()
            ->whereBetween('date_requested', [$start, $end])
            ->whereHas('request', function ($query) {
                $query->whereIn('status', [
                    RequestStatus::APPROVED,
                    RequestStatus::CONDITIONALLY_APPROVED,
                ]);
            })
            ->where('facility_id', $facility_id)
            ->with(['request:id,title', 'facility:id,name'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id' => $booking->id,
                    'title' => $booking->request->title,
                    'start' => $booking->date_requested . 'T' . $booking->time_start,
                    'end' => $booking->date_requested . 'T' . $booking->time_end,
                    'request_id' => $booking->request->id,
                ];
            });

        return $events;
    }


    public function getDaySchedule(int $facility_id, string $date)
    {
        $eventsThisDay = RequestFacility::where('facility_id', $facility_id)
            ->where('date_requested', $date)
            ->whereHas('request', function ($query) {
                $query->whereIn('status', [
                    RequestStatus::APPROVED,
                    RequestStatus::CONDITIONALLY_APPROVED,
                ]);
            })
            ->with('request:id,title,status')
            ->get()
            ->map(function ($booking) {
                return [
                    'request_title' => $booking->request->title,
                    'status' => $booking->request->status,
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
            ->whereHas('request', function ($query) {
                $query->whereIn('status', [
                    RequestStatus::APPROVED,
                    RequestStatus::CONDITIONALLY_APPROVED,
                ]);
            })
            ->with(['request:id,title', 'facility:id,name,building'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id'         => $booking->id,
                    'title'      => $booking->facility->name . ' — ' . $booking->request->title,
                    'start'      => $booking->date_requested . 'T' . $booking->time_start,
                    'end'        => $booking->date_requested . 'T' . $booking->time_end,
                    'request_id' => $booking->request->id,
                    'building'   => $booking->facility->building,
                ];
            });
    }
}
