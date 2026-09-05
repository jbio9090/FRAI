<?php

namespace App\Services;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Building;
use App\Models\Campus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function __construct(protected RequestService $requestService) {}

    public function getMeta(): array
    {
        return [
            'facilities' => Facility::select('id', 'name', 'building_id')->orderBy('name')->get(),
            'buildings' => Building::select('id', 'name', 'campus_id')->orderBy('name')->get(),
            'campuses' => Campus::select('id', 'name')->orderBy('name')->get(),
            'users' => User::select('id', 'name')->where('is_active', true)->orderBy('name')->get(),
            'statuses' => collect(RequestStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->value])->values(),
            'priorities' => collect(PriorityLevel::cases())->map(fn ($p) => ['value' => $p->value, 'label' => $p->label()])->values(),
        ];
    }

    public function getVolumeData(array $filters): array
    {
        $query = $this->baseRequestQuery($filters);

        $granularity = $filters['granularity'] ?? 'daily';
        $dateColumn = 'requests.created_at';

        return $this->aggregateByDate($query, $dateColumn, $granularity, 'total');
    }

    public function getApprovalRateData(array $filters): array
    {
        $query = FacilityRequest::query()
            ->when($filters['start'] ?? null, fn ($q) => $q->where('created_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('created_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['priority_level'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v));

        $granularity = $filters['granularity'] ?? 'daily';
        $dateColumn = 'requests.created_at';

        $statuses = [
            RequestStatus::PENDING->value,
            RequestStatus::APPROVED->value,
            RequestStatus::CONDITIONALLY_APPROVED->value,
            RequestStatus::DENIED->value,
            RequestStatus::FOR_RESCHEDULE->value,
            RequestStatus::PARTIALLY_APPROVED->value,
        ];

        $selectParts = [
            "DATE_TRUNC('{$this->granularityToSql($granularity)}', {$dateColumn}) as date",
        ];

        foreach ($statuses as $status) {
            $colName = strtolower(str_replace(' ', '_', $status));
            $selectParts[] = "COUNT(*) FILTER (WHERE status = '{$status}') as {$colName}";
        }
        $selectParts[] = 'COUNT(*) as total';

        $results = $query->selectRaw(implode(', ', $selectParts))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $results->map(function ($row) use ($filters, $statuses) {
            $data = [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'total' => (int) $row->total,
            ];

            foreach ($statuses as $status) {
                $colName = strtolower(str_replace(' ', '_', $status));
                $data[$colName] = (int) $row->$colName;
            }

            return $data;
        })->values()->toArray();
    }

    public function getFacilityUtilizationData(array $filters): array
    {
        $dateColumn = $this->getDateColumnForFacilityQuery($filters);
        $whereColumn = $this->getDateWhereColumn($filters);

        $query = RequestFacility::query()
            ->join('requests', 'request_facilities.request_id', '=', 'requests.id')
            ->join('facilities', 'request_facilities.facility_id', '=', 'facilities.id')
            ->whereIn('request_facilities.status', [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->when($filters['start'] ?? null, fn ($q) => $q->where($whereColumn, '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where($whereColumn, '<=', $filters['end']))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereIn('request_facilities.facility_id', $v))
            ->when($filters['building_ids'] ?? null, fn ($q, $v) => $q->whereIn('facilities.building_id', $v))
            ->when($filters['campus_ids'] ?? null, fn ($q, $v) => $q->whereIn('facilities.campus_id', $v))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('requests.user_id', $v));

        $granularity = $filters['granularity'] ?? 'daily';

        if ($granularity === 'daily') {
            $results = $query->selectRaw("
                    {$dateColumn} as date,
                    facilities.name as category,
                    COUNT(*) as value
                ")
                ->groupBy($dateColumn, 'facilities.name')
                ->orderBy($dateColumn)
                ->get();
        } else {
            $results = $query->selectRaw("
                    DATE_TRUNC('{$this->granularityToSql($granularity)}', {$dateColumn}) as date,
                    facilities.name as category,
                    COUNT(*) as value
                ")
                ->groupBy('date', 'facilities.name')
                ->orderBy('date')
                ->get();
        }

        return $results->map(function ($row) use ($filters) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'category' => $row->category,
                'value' => (int) $row->value,
            ];
        })->values()->toArray();
    }

    public function getFacilityUsagePieData(array $filters): array
    {
        $whereColumn = $this->getDateWhereColumn($filters);

        $query = RequestFacility::query()
            ->join('requests', 'request_facilities.request_id', '=', 'requests.id')
            ->join('facilities', 'request_facilities.facility_id', '=', 'facilities.id')
            ->whereIn('request_facilities.status', [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->when($filters['start'] ?? null, fn ($q) => $q->where($whereColumn, '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where($whereColumn, '<=', $filters['end']))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereIn('request_facilities.facility_id', $v))
            ->when($filters['building_ids'] ?? null, fn ($q, $v) => $q->whereIn('facilities.building_id', $v))
            ->when($filters['campus_ids'] ?? null, fn ($q, $v) => $q->whereIn('facilities.campus_id', $v))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('requests.user_id', $v));

        $results = $query->selectRaw('
                facilities.name as category,
                COUNT(*) as value
            ')
            ->groupBy('facilities.name')
            ->orderByDesc('value')
            ->get();

        return $results->map(function ($row) {
            return [
                'category' => $row->category,
                'value' => (int) $row->value,
            ];
        })->values()->toArray();
    }

    public function getEquipmentUsageData(array $filters): array
    {
        $dateColumn = $this->getDateColumnForFacilityQuery($filters);
        $whereColumn = $this->getDateWhereColumn($filters);

        $query = DB::table('request_equipment')
            ->join('request_facilities', 'request_equipment.request_facility_id', '=', 'request_facilities.id')
            ->join('requests', 'request_facilities.request_id', '=', 'requests.id')
            ->join('equipments', 'request_equipment.equipment_id', '=', 'equipments.id')
            ->whereIn('request_facilities.status', [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->when($filters['start'] ?? null, fn ($q) => $q->where($whereColumn, '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where($whereColumn, '<=', $filters['end']))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereIn('request_facilities.facility_id', $v))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('requests.user_id', $v));

        $granularity = $filters['granularity'] ?? 'daily';

        if ($granularity === 'daily') {
            $results = $query->selectRaw("
                    {$dateColumn} as date,
                    equipments.name as category,
                    SUM(request_equipment.quantity_needed) as value
                ")
                ->groupBy($dateColumn, 'equipments.name')
                ->orderBy($dateColumn)
                ->get();
        } else {
            $results = $query->selectRaw("
                    DATE_TRUNC('{$this->granularityToSql($granularity)}', {$dateColumn}) as date,
                    equipments.name as category,
                    SUM(request_equipment.quantity_needed) as value
                ")
                ->groupBy('date', 'equipments.name')
                ->orderBy('date')
                ->get();
        }

        return $results->map(function ($row) use ($filters) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'category' => $row->category,
                'value' => (int) $row->value,
            ];
        })->values()->toArray();
    }

    public function getPriorityDistributionData(array $filters): array
    {
        $query = FacilityRequest::query()
            ->when($filters['start'] ?? null, fn ($q) => $q->where('created_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('created_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v));

        $granularity = $filters['granularity'] ?? 'daily';

        $results = $query->selectRaw("
                DATE_TRUNC('{$this->granularityToSql($granularity)}', created_at) as date,
                priority_level,
                COUNT(*) as value
            ")
            ->groupBy('date', 'priority_level')
            ->orderBy('date')
            ->get();

        return $results->map(function ($row) use ($filters) {
            $priorityValue = $row->priority_level instanceof PriorityLevel ? $row->priority_level->value : $row->priority_level;
            $priority = PriorityLevel::tryFrom($priorityValue);

            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'category' => $priority?->label() ?? 'Unknown',
                'value' => (int) $row->value,
            ];
        })->values()->toArray();
    }

    public function getConflictAnalysisData(array $filters): array
    {
        $timeConflicts = $this->getTimeConflictData($filters);
        $equipmentConflicts = $this->getEquipmentConflictData($filters);

        $merged = collect($timeConflicts)
            ->merge($equipmentConflicts)
            ->groupBy('date')
            ->map(function ($items, $date) {
                $time = $items->firstWhere('type', 'time_conflict')?->value ?? 0;
                $equipment = $items->firstWhere('type', 'equipment_conflict')?->value ?? 0;

                return [
                    'date' => $date,
                    'time_conflicts' => $time,
                    'equipment_conflicts' => $equipment,
                    'total' => $time + $equipment,
                ];
            })
            ->values();

        return $merged->toArray();
    }

    private function getTimeConflictData(array $filters): array
    {
        $query = DB::table('requests as r1')
            ->join('request_facilities as rf1', 'r1.id', '=', 'rf1.request_id')
            ->join('request_facilities as rf2', function ($join) {
                $join->on('rf1.facility_id', '=', 'rf2.facility_id')
                    ->on('rf1.date_requested', '=', 'rf2.date_requested')
                    ->whereRaw('rf1.id < rf2.id');
            })
            ->join('requests as r2', 'rf2.request_id', '=', 'r2.id')
            ->whereIn('rf1.status', [RequestStatus::PENDING->value, RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->whereIn('rf2.status', [RequestStatus::PENDING->value, RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->where('r1.on_hold', false)
            ->where('r2.on_hold', false)
            ->whereRaw('rf1.time_start < rf2.time_end AND rf1.time_end > rf2.time_start')
            ->when($filters['start'] ?? null, fn ($q) => $q->where('rf1.date_requested', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('rf1.date_requested', '<=', $filters['end']))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereIn('rf1.facility_id', $v));

        $granularity = $filters['granularity'] ?? 'daily';

        $results = $query->selectRaw("
                DATE_TRUNC('{$this->granularityToSql($granularity)}', rf1.date_requested) as date,
                COUNT(DISTINCT rf1.id) as value
            ")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $results->map(function ($row) use ($filters) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'type' => 'time_conflict',
                'value' => (int) $row->value,
            ];
        })->toArray();
    }

    private function getEquipmentConflictData(array $filters): array
    {
        $query = DB::table('request_equipment as re1')
            ->join('request_facilities as rf1', 're1.request_facility_id', '=', 'rf1.id')
            ->join('requests as r1', 'rf1.request_id', '=', 'r1.id')
            ->join('request_equipment as re2', function ($join) {
                $join->on('re1.equipment_id', '=', 're2.equipment_id')
                    ->whereRaw('re1.request_facility_id < re2.request_facility_id');
            })
            ->join('request_facilities as rf2', 're2.request_facility_id', '=', 'rf2.id')
            ->join('requests as r2', 'rf2.request_id', '=', 'r2.id')
            ->whereIn('rf1.status', [RequestStatus::PENDING->value, RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->whereIn('rf2.status', [RequestStatus::PENDING->value, RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->where('r1.on_hold', false)
            ->where('r2.on_hold', false)
            ->whereRaw('rf1.date_requested = rf2.date_requested')
            ->whereRaw('rf1.time_start < rf2.time_end AND rf1.time_end > rf2.time_start')
            ->when($filters['start'] ?? null, fn ($q) => $q->where('rf1.date_requested', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('rf1.date_requested', '<=', $filters['end']));

        $granularity = $filters['granularity'] ?? 'daily';

        $results = $query->selectRaw("
                DATE_TRUNC('{$this->granularityToSql($granularity)}', rf1.date_requested) as date,
                COUNT(DISTINCT re1.id) as value
            ")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $results->map(function ($row) use ($filters) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'type' => 'equipment_conflict',
                'value' => (int) $row->value,
            ];
        })->toArray();
    }

    public function getUserActivityData(array $filters): array
    {
        $query = FacilityRequest::query()
            ->select('user_id')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("COUNT(*) FILTER (WHERE status IN ('".RequestStatus::APPROVED->value."','".RequestStatus::CONDITIONALLY_APPROVED->value."')) as approved")
            ->when($filters['start'] ?? null, fn ($q) => $q->where('created_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('created_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
            ->when($filters['priority_level'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->groupBy('user_id')
            ->orderByDesc('total')
            ->limit(20)
            ->get();

        $userIds = $query->pluck('user_id')->toArray();
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        return $query->map(function ($row) use ($users) {
            $user = $users->get($row->user_id);
            $total = (int) $row->total;
            $approved = (int) $row->approved;

            return [
                'user_id' => $row->user_id,
                'user_name' => $user?->name ?? 'Unknown',
                'total_requests' => $total,
                'approved_requests' => $approved,
                'approval_rate' => $total > 0 ? round($approved / $total * 100, 1) : 0,
            ];
        })->values()->toArray();
    }

    public function getUserActivityOverTimeData(array $filters): array
    {
        $query = FacilityRequest::query()
            ->when($filters['start'] ?? null, fn ($q) => $q->where('created_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('created_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
            ->when($filters['priority_level'] ?? null, fn ($q, $v) => $q->where('priority_level', $v));

        return $this->aggregateByDate($query, 'created_at', $filters['granularity'] ?? 'daily', 'total', $filters);
    }

    public function getProcessingTimeData(array $filters): array
    {
        $query = FacilityRequest::query()
            ->whereNotNull('processed_at')
            ->when($filters['start'] ?? null, fn ($q) => $q->where('processed_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('processed_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->when($filters['priority_level'] ?? null, fn ($q, $v) => $q->where('priority_level', $v));

        $granularity = $filters['granularity'] ?? 'daily';

        $results = $query->selectRaw("
                DATE_TRUNC('{$this->granularityToSql($granularity)}', processed_at) as date,
                AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) / 86400) as avg_days
            ")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $results->map(function ($row) use ($filters) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $filters['granularity'] ?? 'daily'),
                'value' => round((float) $row->avg_days, 1),
            ];
        })->values()->toArray();
    }

    public function getKpis(array $filters): array
    {
        $start = $filters['start'] ?? Carbon::now()->subDays(30)->format('Y-m-d');
        $end = $filters['end'] ?? Carbon::now()->format('Y-m-d');

        $totalRequests = FacilityRequest::query()
            ->when($start, fn ($q) => $q->where('created_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('created_at', '<=', $end.' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->count();

        $approvedCount = FacilityRequest::query()
            ->whereIn('status', [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value])
            ->when($start, fn ($q) => $q->where('processed_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('processed_at', '<=', $end.' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->count();

        $processedCount = FacilityRequest::query()
            ->whereNotNull('processed_at')
            ->when($start, fn ($q) => $q->where('processed_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('processed_at', '<=', $end.' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->count();

        $avgProcessingDays = FacilityRequest::query()
            ->whereNotNull('processed_at')
            ->when($start, fn ($q) => $q->where('processed_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('processed_at', '<=', $end.' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) / 86400) as avg_days')
            ->value('avg_days');

        $activeConflicts = FacilityRequest::query()
            ->whereJsonLength('pending_conflict_rf_ids', '>', 0)
            ->orWhereJsonLength('approved_conflict_rf_ids', '>', 0)
            ->when($start, fn ($q) => $q->where('created_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('created_at', '<=', $end.' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)))
            ->count();

        return [
            'total_requests' => $totalRequests,
            'approval_rate' => $processedCount > 0 ? round($approvedCount / $processedCount * 100, 1) : 0,
            'avg_processing_days' => $avgProcessingDays ? round((float) $avgProcessingDays, 1) : 0,
            'active_conflicts' => $activeConflicts,
        ];
    }

    private function baseRequestQuery(array $filters): Builder
    {
        return FacilityRequest::query()
            ->when($filters['start'] ?? null, fn ($q) => $q->where('created_at', '>=', $filters['start']))
            ->when($filters['end'] ?? null, fn ($q) => $q->where('created_at', '<=', $filters['end'].' 23:59:59'))
            ->when($filters['user_id'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
            ->when($filters['priority_level'] ?? null, fn ($q, $v) => $q->where('priority_level', $v))
            ->when($filters['facility_ids'] ?? null, fn ($q, $v) => $q->whereHas('requestFacilities', fn ($q2) => $q2->whereIn('facility_id', $v)));
    }

    private function getDateColumn(array $filters): string
    {
        return match ($filters['date_type'] ?? 'event_date') {
            'approval_date' => 'requests.processed_at',
            'submission_date' => 'requests.created_at',
            default => 'request_facilities.date_requested',
        };
    }

    private function getDateColumnForFacilityQuery(array $filters): string
    {
        return match ($filters['date_type'] ?? 'event_date') {
            'approval_date' => 'requests.processed_at',
            'submission_date' => 'requests.created_at',
            default => 'request_facilities.date_requested',
        };
    }

    private function getDateWhereColumn(array $filters): string
    {
        return match ($filters['date_type'] ?? 'event_date') {
            'approval_date' => 'requests.processed_at',
            'submission_date' => 'requests.created_at',
            default => 'request_facilities.date_requested',
        };
    }

    private function aggregateByDate(Builder $query, string $dateColumn, string $granularity, string $valueColumn, array $filters = []): array
    {
        $results = $query->selectRaw("
                DATE_TRUNC('{$this->granularityToSql($granularity)}', {$dateColumn}) as date,
                COUNT(*) as {$valueColumn}
            ")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $data = $results->map(function ($row) use ($granularity, $valueColumn) {
            return [
                'date' => $this->formatDateForGranularity($row->date, $granularity),
                'value' => (int) $row->{$valueColumn},
            ];
        })->keyBy('date');

        // Fill missing dates with 0
        $start = $filters['start'] ?? now()->subDays(30)->format('Y-m-d');
        $end = $filters['end'] ?? now()->format('Y-m-d');

        $allDates = $this->generateDateRange($start, $end, $granularity);

        return $allDates->map(function ($dateStr) use ($data) {
            return [
                'date' => $dateStr,
                'value' => $data->has($dateStr) ? $data[$dateStr]['value'] : 0,
            ];
        })->values()->toArray();
    }

    private function generateDateRange(string $start, string $end, string $granularity): \Illuminate\Support\Collection
    {
        $startCarbon = Carbon::parse($start);
        $endCarbon = Carbon::parse($end);
        $dates = collect();

        switch ($granularity) {
            case 'daily':
                $current = $startCarbon->copy();
                while ($current <= $endCarbon) {
                    $dates->push($current->format('Y-m-d'));
                    $current->addDay();
                }
                break;
            case 'weekly':
                $current = $startCarbon->copy()->startOfWeek();
                while ($current <= $endCarbon) {
                    $dates->push($current->format('Y-\\WW'));
                    $current->addWeek();
                }
                break;
            case 'monthly':
                $current = $startCarbon->copy()->startOfMonth();
                while ($current <= $endCarbon) {
                    $dates->push($current->format('Y-m'));
                    $current->addMonth();
                }
                break;
            default:
                $current = $startCarbon->copy();
                while ($current <= $endCarbon) {
                    $dates->push($current->format('Y-m-d'));
                    $current->addDay();
                }
        }

        return $dates;
    }

    private function granularityToSql(string $granularity): string
    {
        return match ($granularity) {
            'daily' => 'day',
            'weekly' => 'week',
            'monthly' => 'month',
            default => 'day',
        };
    }

    private function formatDateForGranularity(string $date, string $granularity): string
    {
        $carbon = Carbon::parse($date);

        return match ($granularity) {
            'daily' => $carbon->format('Y-m-d'),
            'weekly' => $carbon->format('Y-\\WW'),
            'monthly' => $carbon->format('Y-m'),
            default => $carbon->format('Y-m-d'),
        };
    }
}
