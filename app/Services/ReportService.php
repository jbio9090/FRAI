<?php

namespace App\Services;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Statuses shown in the Request Status breakdown, in template order.
     *
     * @var array<int, RequestStatus>
     */
    private const STATUSES = [
        RequestStatus::PENDING,
        RequestStatus::APPROVED,
        RequestStatus::CONDITIONALLY_APPROVED,
        RequestStatus::PARTIALLY_APPROVED,
        RequestStatus::FOR_RESCHEDULE,
        RequestStatus::DENIED,
    ];

    /**
     * Build the full monthly activity report.
     *
     * The reporting period is defined by the submission date
     * (requests.created_at), and every metric is counted at the request level.
     */
    public function getMonthlyReport(int $year, int $month, bool $withComparison = false): array
    {
        $start = Carbon::create($year, $month, 1)->startOfDay();
        $end = $start->copy()->endOfMonth();

        $startDate = $start->format('Y-m-d');
        $endDate = $end->format('Y-m-d');

        $report = [
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
                'label' => $start->format('M j').'-'.$end->format('j, Y'),
            ],
            'kpis' => $this->getKpis($startDate, $endDate),
            'volume' => $this->getVolume($startDate, $endDate),
            'status' => $this->getStatusBreakdown($startDate, $endDate),
            'event_types' => $this->getEventTypes($startDate, $endDate),
            'facility_usage' => $this->getFacilityUsage($startDate, $endDate),
            'building_usage' => $this->getBuildingUsage($startDate, $endDate),
        ];

        if ($withComparison) {
            $report['previous_kpis'] = $this->getPreviousMonthKpis($year, $month);
            $report['kpi_deltas'] = $this->getKpiDeltas($report['kpis'], $report['previous_kpis']);
        }

        return $report;
    }

    /**
     * Requests submitted within the period.
     */
    private function requestSetQuery(string $start, string $end): Builder
    {
        return DB::table('requests')
            ->whereBetween('requests.created_at', [$start, $end]);
    }

    private function getKpis(string $start, string $end): array
    {
        $base = $this->requestSetQuery($start, $end);

        $total = (clone $base)->count();

        $approved = (clone $base)
            ->whereIn('status', [
                RequestStatus::APPROVED->value,
                RequestStatus::CONDITIONALLY_APPROVED->value,
            ])
            ->count();

        $requesters = (clone $base)->distinct()->count('user_id');

        // Compute in PHP so the metric works across database drivers.
        $avgDays = (clone $base)
            ->whereNotNull('processed_at')
            ->select('created_at', 'processed_at')
            ->get()
            ->map(fn ($row) => Carbon::parse($row->created_at)->diffInSeconds(Carbon::parse($row->processed_at)) / 86400)
            ->average();

        return [
            'requests_received' => $total,
            'approval_rate' => $total > 0 ? round($approved / $total * 100, 1) : 0,
            'total_requesters' => $requesters,
            'avg_processing_days' => $avgDays ? round((float) $avgDays, 1) : 0,
        ];
    }

    /**
     * KPIs for the month immediately preceding the given year/month.
     * Handles the January -> December year boundary.
     */
    private function getPreviousMonthKpis(int $year, int $month): array
    {
        $previous = Carbon::create($year, $month, 1)->subMonthNoOverflow();

        $start = $previous->copy()->startOfDay()->format('Y-m-d');
        $end = $previous->copy()->endOfMonth()->format('Y-m-d');

        return $this->getKpis($start, $end);
    }

    /**
     * Compute absolute and percentage deltas between current and previous KPIs.
     * delta_percent is null when the previous value is 0 (no basis for comparison).
     *
     * @param  array<string, float|int>  $current
     * @param  array<string, float|int>  $previous
     * @return array<string, array{delta: float|int, delta_percent: float|null}>
     */
    private function getKpiDeltas(array $current, array $previous): array
    {
        $keys = ['requests_received', 'approval_rate', 'total_requesters', 'avg_processing_days'];
        $deltas = [];

        foreach ($keys as $key) {
            $currentValue = (float) ($current[$key] ?? 0);
            $previousValue = (float) ($previous[$key] ?? 0);
            $delta = $currentValue - $previousValue;
            $deltaPercent = $previousValue > 0 ? round($delta / $previousValue * 100, 1) : null;

            $deltas[$key] = [
                'delta' => $delta,
                'delta_percent' => $deltaPercent,
            ];
        }

        return $deltas;
    }

    /**
     * Distinct requests per submission date across the whole month (zero-filled).
     */
    private function getVolume(string $start, string $end): array
    {
        $rows = DB::table('requests')
            ->whereBetween('requests.created_at', [$start, $end])
            ->selectRaw('DATE(requests.created_at) as date, COUNT(*) as value')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy(fn ($row) => Carbon::parse($row->date)->format('Y-m-d'));

        $result = [];
        $cursor = Carbon::parse($start);
        $endCursor = Carbon::parse($end);

        while ($cursor <= $endCursor) {
            $key = $cursor->format('Y-m-d');
            $result[] = [
                'date' => $key,
                'value' => (int) ($rows->get($key)->value ?? 0),
            ];
            $cursor->addDay();
        }

        return $result;
    }

    private function getStatusBreakdown(string $start, string $end): array
    {
        $counts = $this->requestSetQuery($start, $end)
            ->whereIn('status', array_map(fn (RequestStatus $status) => $status->value, self::STATUSES))
            ->selectRaw('status, COUNT(*) as value')
            ->groupBy('status')
            ->pluck('value', 'status');

        return array_map(fn (RequestStatus $status) => [
            'status' => $status->value,
            'value' => (int) ($counts[$status->value] ?? 0),
        ], self::STATUSES);
    }

    private function getEventTypes(string $start, string $end): array
    {
        $counts = $this->requestSetQuery($start, $end)
            ->selectRaw('priority_level, COUNT(*) as value')
            ->groupBy('priority_level')
            ->pluck('value', 'priority_level');

        return array_map(fn (PriorityLevel $priority) => [
            'category' => $priority->label(),
            'value' => (int) ($counts[$priority->value] ?? 0),
        ], PriorityLevel::cases());
    }

    private function getFacilityUsage(string $start, string $end): array
    {
        $rows = DB::table('request_facilities')
            ->join('requests', 'request_facilities.request_id', '=', 'requests.id')
            ->join('facilities', 'request_facilities.facility_id', '=', 'facilities.id')
            ->whereBetween('requests.created_at', [$start, $end])
            ->selectRaw('facilities.name as name, COUNT(DISTINCT request_facilities.request_id) as amount')
            ->groupBy('facilities.name')
            ->orderByDesc('amount')
            ->get();

        return $this->withPercentages($rows);
    }

    private function getBuildingUsage(string $start, string $end): array
    {
        $rows = DB::table('request_facilities')
            ->join('requests', 'request_facilities.request_id', '=', 'requests.id')
            ->join('facilities', 'request_facilities.facility_id', '=', 'facilities.id')
            ->leftJoin('buildings', 'facilities.building_id', '=', 'buildings.id')
            ->whereBetween('requests.created_at', [$start, $end])
            ->selectRaw('COALESCE(buildings.name, facilities.building) as name, COUNT(DISTINCT request_facilities.request_id) as amount')
            ->groupByRaw('COALESCE(buildings.name, facilities.building)')
            ->orderByDesc('amount')
            ->get();

        return $this->withPercentages($rows);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $rows
     */
    private function withPercentages($rows): array
    {
        $total = (int) $rows->sum('amount');

        return $rows->map(fn ($row) => [
            'name' => $row->name,
            'amount' => (int) $row->amount,
            'percentage' => $total > 0 ? round($row->amount / $total * 100, 1) : 0,
        ])->values()->toArray();
    }
}
