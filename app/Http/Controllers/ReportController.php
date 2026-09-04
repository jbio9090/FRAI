<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function __construct(protected ReportService $reportService) {}

    public function index(): Response
    {
        $meta = $this->reportService->getMeta();

        return Inertia::render('reports/index', [
            'labeledBreadcrumb' => 'Reports',
            'meta' => $meta,
            'defaultFilters' => [
                'start' => now()->subDays(30)->format('Y-m-d'),
                'end' => now()->addDays(90)->format('Y-m-d'),
                'granularity' => 'daily',
            ],
        ]);
    }

    public function getData(Request $request): JsonResponse
    {
        $type = $request->input('type');
        $filters = $this->parseFilters($request);

        $data = match ($type) {
            'volume' => $this->reportService->getVolumeData($filters),
            'approval-rate' => $this->reportService->getApprovalRateData($filters),
            'facility-utilization' => $this->reportService->getFacilityUtilizationData($filters),
            'facility-usage-pie' => $this->reportService->getFacilityUsagePieData($filters),
            'equipment-usage' => $this->reportService->getEquipmentUsageData($filters),
            'priority-distribution' => $this->reportService->getPriorityDistributionData($filters),
            'conflict-analysis' => $this->reportService->getConflictAnalysisData($filters),
            'user-activity' => $this->reportService->getUserActivityData($filters),
            'user-activity-over-time' => $this->reportService->getUserActivityOverTimeData($filters),
            'processing-time' => $this->reportService->getProcessingTimeData($filters),
            'kpis' => $this->reportService->getKpis($filters),
            default => [],
        };

        return response()->json([
            'data' => $data,
            'filters' => $filters,
        ]);
    }

    public function getMeta(): JsonResponse
    {
        return response()->json($this->reportService->getMeta());
    }

    private function parseFilters(Request $request): array
    {
        $facilityIds = $request->input('facility_ids');
        $buildingIds = $request->input('building_ids');
        $campusIds = $request->input('campus_ids');
        $statuses = $request->input('statuses');
        $priorityLevel = $request->input('priority_level');
        $userId = $request->input('user_id');
        $dateType = $request->input('date_type');

        return [
            'start' => $request->input('start'),
            'end' => $request->input('end'),
            'granularity' => $request->input('granularity', 'daily'),
            'date_type' => in_array($dateType, ['event_date', 'approval_date', 'submission_date']) ? $dateType : 'event_date',
            'facility_ids' => $facilityIds ? array_map('intval', (array) $facilityIds) : null,
            'building_ids' => $buildingIds ? array_map('intval', (array) $buildingIds) : null,
            'campus_ids' => $campusIds ? array_map('intval', (array) $campusIds) : null,
            'statuses' => $statuses ? (array) $statuses : null,
            'priority_level' => $priorityLevel !== null && $priorityLevel !== '' ? (int) $priorityLevel : null,
            'user_id' => $userId !== null && $userId !== '' ? (int) $userId : null,
        ];
    }
}
