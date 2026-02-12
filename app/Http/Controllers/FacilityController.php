<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Services\FacilityService;


class FacilityController extends Controller
{
    public function __construct(
        protected FacilityService $service
    ) {}

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

        $initialEvents = $this->service->getSchedule($facility_id, $start, $end);

        return Inertia::render("facilities/detail", [
            "facility" => $facility,
            "initialEvents" => $initialEvents,
            "labeledBreadcrumb" => $facility->name
        ]);
    }

    public function getDayScheduleJson(Facility $facility, string $date)
    {
        $eventsThisDay = $this->service->getDaySchedule($facility->id, $date);

        return response()->json([
            'bookings' => $eventsThisDay,
            'date' => $date,
        ]);
    }

    public function getCalendarSchedule(Request $request, $facility_id)
    {
        $start = $request->input('start');
        $end = $request->input('end');

        $events = $this->service->getSchedule($facility_id, $start, $end);

        return response()->json($events);
    }
}
