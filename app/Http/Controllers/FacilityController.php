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

        return Inertia::render("facilities/detail", ["facility" => $facility, "labeledBreadcrumb" => $facility->name]);
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
}
