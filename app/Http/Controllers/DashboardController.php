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
            'auditLogs' => AuditLog::with('user')
                ->where('created_at', '>=', now()->subDays(6)->startOfDay())
                ->latest()
                ->paginate(10),
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
        $offset = now()->format('P'); // e.g. '+08:00'

        if ($range === 'day') {
            $data = AuditLog::query()
                // PostgreSQL: Use TO_CHAR for padding and AT TIME ZONE for timezone conversion
                ->selectRaw("TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE ?, 'HH24') as hour, COUNT(*) as total", [$offset])
                ->whereBetween('created_at', [now()->startOfDay(), now()->endOfDay()])
                ->groupBy('hour')
                ->orderBy('hour')
                ->get()
                ->map(fn($row) => [
                    'date'  => $row->hour . ':00',
                    'total' => (int) $row->total,
                ])
                ->values();

            return response()->json($data);
        }

        [$start, $end] = match ($range) {
            'month'   => [now()->startOfMonth()->startOfDay(), now()->endOfMonth()->endOfDay()],
            '3months' => [now()->subMonths(3)->startOfDay(), now()->endOfDay()],
            default   => [now()->subDays(6)->startOfDay(), now()->endOfDay()],
        };

        $data = AuditLog::query()
            ->selectRaw("DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE ?) as date, COUNT(*) as total", [$offset])
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

    public function auditLogs(Request $request)
    {
        $range = $request->input('range', 'week');

        [$start, $end] = match ($range) {
            'day'     => [now()->startOfDay(), now()->endOfDay()],
            'month'   => [now()->startOfMonth()->startOfDay(), now()->endOfMonth()->endOfDay()],
            '3months' => [now()->subMonths(3)->startOfDay(), now()->endOfDay()],
            default   => [now()->subDays(6)->startOfDay(), now()->endOfDay()],
        };

        return response()->json(
            AuditLog::with('user')
                ->whereBetween('created_at', [$start, $end])
                ->latest()
                ->paginate(10) 
        );
    }
}
