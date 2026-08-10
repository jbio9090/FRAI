<?php

namespace App\Http\Controllers;

use App\Enums\AuditEvent;
use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Services\FacilityService;
use App\Services\RequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __construct(protected RequestService $requestService, protected FacilityService $facilityService) {}

    public function index(Request $request)
    {
        $user = Auth::user();
        $isAdmin = $user->hasRole(['admin', 'Super Admin']);
        $start = now()->startOfMonth()->format('Y-m-d');
        $end = now()->endOfMonth()->format('Y-m-d');
        $auditRange = [now()->subDays(6)->startOfDay(), now()->endOfDay()];

        $chartData = AuditLog::query()
            ->when(! $isAdmin, fn ($q) => $q->where('user_id', $user->id))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'total' => (int) $row->total,
            ])
            ->values();

        $pending = $this->requestService->get([RequestStatus::PENDING]);

        // ── KPI strip ────────────────────────────────────────────────────
        $since = now()->subDays(6)->startOfDay();

        $approvedThisWeek = FacilityRequest::query()
            ->when(! $isAdmin, fn ($q) => $q->where('user_id', $user->id))
            ->where('status', RequestStatus::APPROVED->value)
            ->where(fn ($q) => $q
                ->where('processed_at', '>=', $since)
                ->orWhere(fn ($q2) => $q2->whereNull('processed_at')->where('created_at', '>=', $since)))
            ->count();

        $eventsToday = $isAdmin
            ? $this->facilityService->getAllSchedule(now()->startOfDay()->format('Y-m-d'), now()->endOfDay()->format('Y-m-d'))->count()
            : RequestFacility::query()
                ->whereDate('date_requested', now()->toDateString())
                ->whereHas('request', fn ($q) => $q->where('user_id', $user->id))
                ->count();

        $conflictRequestIds = collect($pending->items())
            ->flatMap(function ($request) {
                $pending = collect($request->pending_conflicts ?? [])->all();
                $approved = collect($request->approved_conflicts ?? [])->all();

                return array_merge($pending, $approved);
            })
            ->pluck('request_id')
            ->filter()
            ->unique();

        $kpis = [
            'awaitingDecision' => $pending->total(),
            'needsAction' => $conflictRequestIds->count(),
            'approvedThisWeek' => $approvedThisWeek,
            'eventsToday' => $eventsToday,
        ];

        return Inertia::render('dashboard', [
            'labeledBreadcrumb' => 'Dashboard',
            'initialEvents' => $this->facilityService->getAllSchedule($start, $end),
            'buildings' => Facility::distinct()->pluck('building')->filter()->values(),
            // Filter recent logs list
            'auditLogs' => $this->auditLogQuery($request, $auditRange)->paginate(10),
            'auditEvents' => collect(AuditEvent::cases())
                ->filter(fn ($case) => $case !== AuditEvent::Unknown)
                ->map(fn ($case) => [
                'value' => $case->value,
                'label' => $case->label(),
            ])->values(),
            'breakdown' => $this->eventBreakdown($request, $auditRange),
            'chartData' => $chartData,
            'pending' => $pending,
            'kpis' => $kpis,
            'notifications' => $user->notifications()
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn ($notification) => [
                    'id' => $notification->id,
                    'title' => $notification->data['title'] ?? 'Notification',
                    'body' => $notification->data['body'] ?? '',
                    'url' => $notification->data['url'] ?? route('dashboard'),
                    'category' => $notification->data['category'] ?? null,
                    'status' => $notification->data['status'] ?? null,
                    'created_at' => $notification->created_at?->toISOString(),
                    'read_at' => $notification->read_at?->toISOString(),
                ]),
        ]);
    }

    public function markNotificationsRead()
    {
        Auth::user()?->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'unread_count' => 0,
        ]);
    }

    public function calendarEvents(Request $request)
    {
        $start = $request->input('start');
        $end = $request->input('end');

        if (! $start || ! $end) {
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

        $query = AuditLog::query()
            ->when(! $user->hasRole(['admin', 'Super Admin']), fn ($q) => $q->where('user_id', $user->id));

        if ($range === 'day' || $range === 'today') {
            $logs = $query
                ->selectRaw('EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as total')
                ->whereBetween('created_at', [now()->utc()->startOfDay(), now()->utc()->endOfDay()])
                ->groupBy('hour')
                ->pluck('total', 'hour');

            $data = collect(range(0, 23))->map(function ($hour) use ($logs) {
                $formattedHour = str_pad($hour, 2, '0', STR_PAD_LEFT);

                return [
                    'date' => $formattedHour.':00',
                    'total' => (int) ($logs[$hour] ?? 0),
                ];
            })->values();

            return response()->json($data);
        }

        [$start, $end] = match ($range) {
            'month' => [now()->utc()->startOfMonth()->startOfDay(), now()->utc()->endOfMonth()->endOfDay()],
            '3months' => [now()->utc()->subMonths(3)->startOfDay(), now()->utc()->endOfDay()],
            default => [now()->utc()->subDays(6)->startOfDay(), now()->utc()->endOfDay()],
        };

        return response()->json(
            $query->selectRaw('DATE(created_at) as date, COUNT(*) as total')
                ->whereBetween('created_at', [$start, $end])
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->map(fn ($row) => ['date' => $row->date, 'total' => (int) $row->total])
                ->values()
        );
    }

    public function auditLogs(Request $request)
    {
        $range = $this->resolveRange($request->input('range', 'week'));

        $logs = $this->auditLogQuery($request, $range)->paginate(10)->toArray();
        $logs['breakdown'] = $this->eventBreakdown($request, $range);

        return response()->json($logs);
    }

    private function resolveRange(string $range): array
    {
        return match ($range) {
            'day' => [now()->startOfDay(), now()->endOfDay()],
            'month' => [now()->startOfMonth()->startOfDay(), now()->endOfMonth()->endOfDay()],
            '3months' => [now()->subMonths(3)->startOfDay(), now()->endOfDay()],
            default => [now()->subDays(6)->startOfDay(), now()->endOfDay()],
        };
    }

    private function auditLogQuery(Request $request, array $range): Builder
    {
        $user = Auth::user();
        $event = $request->input('event');
        $sort = $request->input('sort', 'newest');

        $validEvents = array_column(AuditEvent::cases(), 'value');
        $event = $event && in_array($event, $validEvents, true) ? $event : null;

        return AuditLog::with('user')
            ->when(! $user->hasRole(['admin', 'Super Admin']), fn ($q) => $q->where('user_id', $user->id))
            ->when($event, fn ($q) => $q->where('event', $event))
            ->whereBetween('created_at', $range)
            ->orderBy('created_at', $sort === 'oldest' ? 'asc' : 'desc');
    }

    private function eventBreakdown(Request $request, array $range): Collection
    {
        $user = Auth::user();

        return AuditLog::query()
            ->when(! $user->hasRole(['admin', 'Super Admin']), fn ($q) => $q->where('user_id', $user->id))
            ->whereBetween('created_at', $range)
            ->selectRaw('event, COUNT(*) as count')
            ->groupBy('event')
            ->orderByDesc('count')
            ->get()
            ->map(function ($row) {
                $event = $row->event instanceof AuditEvent ? $row->event : AuditEvent::tryFrom($row->event);

                return [
                    'event' => $event?->value ?? (string) $row->event,
                    'label' => $event?->label() ?? (string) $row->event,
                    'count' => (int) $row->count,
                ];
            })
            ->values();
    }
}
