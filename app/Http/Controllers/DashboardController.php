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
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    public function __construct(protected RequestService $requestService, protected FacilityService $facilityService) {}

    public function index()
    {
        $user = Auth::user();
        $start = now()->startOfMonth()->format('Y-m-d');
        $end   = now()->endOfMonth()->format('Y-m-d');

        $tz = config('app.timezone');

        $chartData = AuditLog::query()
            ->when(!$user->hasRole('admin'), fn($q) => $q->where('user_id', $user->id))
            ->selectRaw(
                "DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE ?) as date, COUNT(*) as total",
                [$tz]
            )
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'  => $row->date,
                'total' => (int) $row->total, 
            ])
            ->values();

        return Inertia::render("dashboard", [
            'labeledBreadcrumb' => "Dashboard",
            'initialEvents' => $this->facilityService->getAllSchedule($start, $end),
            'buildings'     => Facility::distinct()->pluck('building')->filter()->values(),
            // Filter recent logs list
            'auditLogs' => AuditLog::with('user')
                ->when(!$user->hasRole('admin'), fn($q) => $q->where('user_id', $user->id))
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
        $user = Auth::user();
        $range = $request->input('range', 'week');
        $tz = config('app.timezone'); // ← always 'Asia/Manila' from .env

        $query = AuditLog::query()
            ->when(!$user->hasRole('admin'), fn($q) => $q->where('user_id', $user->id));

        if ($range === 'day' || $range === 'today') {
            $logs = $query
                ->selectRaw("TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE ?, 'HH24') as hour, COUNT(*) as total", [$tz])
                ->whereBetween('created_at', [now()->startOfDay(), now()->endOfDay()])
                ->groupBy('hour')
                ->pluck('total', 'hour');

            $data = collect(range(0, 23))->map(function ($hour) use ($logs) {
                $formattedHour = str_pad($hour, 2, '0', STR_PAD_LEFT);
                return [
                    'date'  => $formattedHour . ':00',
                    'total' => (int) ($logs[$formattedHour] ?? 0),
                ];
            })->values();

            return response()->json($data);
        }

        [$start, $end] = match ($range) {
            'month'   => [now()->startOfMonth()->startOfDay(), now()->endOfMonth()->endOfDay()],
            '3months' => [now()->subMonths(3)->startOfDay(), now()->endOfDay()],
            default   => [now()->subDays(6)->startOfDay(), now()->endOfDay()],
        };

        return response()->json(
            $query->selectRaw("DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE ?) as date, COUNT(*) as total", [$tz])
                ->whereBetween('created_at', [$start, $end])
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->map(fn($row) => ['date' => $row->date, 'total' => (int) $row->total])
                ->values()
        );
    }

    public function auditLogs(Request $request)
    {
        $user = Auth::user();
        $range = $request->input('range', 'week');

        [$start, $end] = match ($range) {
            'day'     => [now()->startOfDay(), now()->endOfDay()],
            'month'   => [now()->startOfMonth()->startOfDay(), now()->endOfMonth()->endOfDay()],
            '3months' => [now()->subMonths(3)->startOfDay(), now()->endOfDay()],
            default   => [now()->subDays(6)->startOfDay(), now()->endOfDay()],
        };

        return response()->json(
            AuditLog::with('user')
                ->when(!$user->hasRole('admin'), fn($q) => $q->where('user_id', $user->id))
                ->whereBetween('created_at', [$start, $end])
                ->latest()
                ->paginate(10)
        );
    }
}
