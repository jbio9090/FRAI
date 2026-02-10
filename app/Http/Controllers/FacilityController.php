<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\RequestFacility;
use App\RequestStatus;


class FacilityController extends Controller
{
    public function index()
    {
        return Inertia::render("facilities/index", ["facilities" => Facility::all()]);
    }

    public function detail(int $facility_id)
    {
        $facility = Facility::where("id", $facility_id)->firstOrFail();

        // Load initial month of events
        $start = now()->startOfMonth()->format('Y-m-d');
        $end = now()->endOfMonth()->format('Y-m-d');

        $initialEvents = RequestFacility::query()
            ->whereBetween('date_requested', [$start, $end])
            ->whereHas('request', function ($query) {
                $query->where('status', RequestStatus::APPROVED);
            })
            ->where('facility_id', $facility_id)
            ->with(['request:id,title', 'facility:id,name'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id' => $booking->id,
                    'title' => $booking->request->title,
                    'start' => $booking->date_requested . ' ' . $booking->time_start,
                    'end' => $booking->date_requested . ' ' . $booking->time_end,
                ];
            });

        return Inertia::render("facilities/detail", [
            "facility" => $facility,
            "initialEvents" => $initialEvents,
            "labeledBreadcrumb" => $facility->name
        ]);
    }

    public function schedule(Facility $facility, string $date)
    {
        // Query the pivot table directly
        $bookings = RequestFacility::where('facility_id', $facility->id)
            ->where('date_requested', $date)
            ->whereHas('request', function ($query) {
                $query->where('status', RequestStatus::APPROVED);
            })
            ->with('request:id,title,status')
            ->get()
            ->map(function ($booking) {
                return [
                    'request_title' => $booking->request->title,
                    'status' => $booking->request->status,
                    'time_start' => $booking->time_start,
                    'time_end' => $booking->time_end,
                ];
            });

        return response()->json([
            'bookings' => $bookings,
            'date' => $date,
        ]);
    }

    public function calculateAvailability(Facility $facility) {}

    public function getCalendarSchedule(Request $request, $facility_id)
    {
        $start = $request->input('start');
        $end = $request->input('end');

        $query = RequestFacility::query()
            ->whereBetween('date_requested', [$start, $end])
            ->whereHas('request', function ($query) {
                $query->where('status', RequestStatus::APPROVED);
            })
            ->where('facility_id', $facility_id);


        $events = $query->with(['request:id,title', 'facility:id,name'])
            ->get()
            ->map(function ($booking) {
                return [
                    'id' => $booking->id,
                    'title' => $booking->request->title . ' - ' . $booking->facility->name,
                    'start' => $booking->date_requested . 'T' . $booking->time_start,
                    'end' => $booking->date_requested . 'T' . $booking->time_end,
                ];
            });

        return response()->json($events);
    }
}
