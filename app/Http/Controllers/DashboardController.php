<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\RequestStatus;
use App\Services\FacilityService;
use App\Services\RequestService;
use Inertia\Inertia;
use Illuminate\Http\Request;


class DashboardController extends Controller
{
    public function __construct(protected RequestService $requestService, protected FacilityService $facilityService) {}

    public function index()
    {
        $pending  = $this->requestService->get([RequestStatus::PENDING]);
        $approved = $this->requestService->get([RequestStatus::APPROVED]);
        $denied   = $this->requestService->get([RequestStatus::DENIED]);

        $start = now()->startOfMonth()->format('Y-m-d');
        $end   = now()->endOfMonth()->format('Y-m-d');

        return Inertia::render("dashboard", [
            'labeledBreadcrumb' => "Dashboard",
            'pending' => $pending,
            'approved' => $approved,
            'denied' => $denied,
            'initialEvents' => $this->facilityService->getAllSchedule($start, $end),
            'buildings' => Facility::distinct()->pluck('building')->filter()->values(),
        ]);
    }

    public function calendarEvents(Request $request)
    {
        $start = $request->input('start');
        $end   = $request->input('end');

        if (!$start || !$end) {
            return response()->json([]);
        }

        return response()->json(
            $this->facilityService->getAllSchedule($start, $end)
        );
    }
}
