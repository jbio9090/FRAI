<?php

namespace App\Http\Controllers;

use App\AuditEvent;
use App\Models\AuditLog;
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
        $start = now()->startOfMonth()->format('Y-m-d');
        $end   = now()->endOfMonth()->format('Y-m-d');

        $chartData = AuditLog::query()
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'  => $row->date,
                'total' => $row->total,
            ])
            ->values();

        return Inertia::render("dashboard", [
            'labeledBreadcrumb' => "Dashboard",
            'initialEvents' => $this->facilityService->getAllSchedule($start, $end),
            'buildings'     => Facility::distinct()->pluck('building')->filter()->values(),
            'auditLogs'     => AuditLog::latest()->take(50)->get(),
            'chartData'     => $chartData,
            'pending' => $this->requestService->get([RequestStatus::PENDING]),
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

    public function chartData(Request $request)
    {
        $range = $request->input('range', 'week');

        [$start, $end] = match ($range) {
            'month'   => [now()->startOfMonth()->format('Y-m-d'), now()->endOfMonth()->format('Y-m-d')],
            '3months' => [now()->subMonths(3)->startOfDay()->format('Y-m-d'), now()->format('Y-m-d')],
            default   => [now()->subDays(6)->startOfDay()->format('Y-m-d'), now()->format('Y-m-d')], // week
        };

        $data = AuditLog::query()
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'  => $row->date,
                'total' => (int) $row->total,
            ])
            ->values();

        return response()->json($data);
    }
}
