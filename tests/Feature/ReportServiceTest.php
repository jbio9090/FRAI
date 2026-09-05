<?php

namespace Tests\Feature;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportServiceTest extends TestCase
{
    use RefreshDatabase;

    protected ReportService $reportService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->reportService = app(ReportService::class);
    }

    /**
     * Skip PostgreSQL-specific tests when using SQLite (testing database).
     */
    protected function skipIfSqlite(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->markTestSkipped('PostgreSQL-specific functions not available in SQLite');
        }
    }

    public function test_status_breakdown_sums_to_total_requests(): void
    {
        $this->skipIfSqlite();

        $user = User::factory()->create();
        $facility = Facility::factory()->create();

        $now = Carbon::now();

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::FOR_RESCHEDULE,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        $filters = [
            'start' => $now->copy()->subDay()->format('Y-m-d'),
            'end' => $now->copy()->addDay()->format('Y-m-d'),
            'granularity' => 'daily',
            'user_id' => $user->id,
        ];

        $approvalRateData = $this->reportService->getApprovalRateData($filters);

        $this->assertCount(1, $approvalRateData);

        $dayData = $approvalRateData[0];

        $statusKeys = [
            'pending',
            'approved',
            'conditionally_approved',
            'denied',
            'for_reschedule',
            'partially_approved',
        ];

        $sumStatuses = 0;
        foreach ($statusKeys as $key) {
            $sumStatuses += $dayData[$key] ?? 0;
        }

        $this->assertEquals($dayData['total'], $sumStatuses, 'Sum of status breakdown should equal total requests');
        $this->assertEquals(6, $dayData['total'], 'Should have 6 total requests');
    }

    public function test_event_types_sum_to_total_requests(): void
    {
        $this->skipIfSqlite();

        $user = User::factory()->create();

        $now = Carbon::now();

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'priority_level' => PriorityLevel::Organization,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'priority_level' => PriorityLevel::University,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'priority_level' => PriorityLevel::Government,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        $filters = [
            'start' => $now->copy()->subDay()->format('Y-m-d'),
            'end' => $now->copy()->addDay()->format('Y-m-d'),
            'granularity' => 'daily',
            'user_id' => $user->id,
        ];

        $priorityData = $this->reportService->getPriorityDistributionData($filters);

        $this->assertCount(1, $priorityData);

        $dayData = $priorityData[0];

        $sumPriorities = 0;
        foreach ($priorityData as $row) {
            $sumPriorities += $row['value'];
        }

        $volumeData = $this->reportService->getVolumeData($filters);
        $totalVolume = $volumeData[0]['value'] ?? 0;

        $this->assertEquals($totalVolume, $sumPriorities, 'Sum of event types should equal total requests');
        $this->assertEquals(5, $totalVolume, 'Should have 5 total requests');
    }

    public function test_approval_rate_calculation(): void
    {
        $this->skipIfSqlite();

        $user = User::factory()->create();

        $now = Carbon::now();

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
            'created_at' => $now,
            'processed_at' => null,
        ]);

        $filters = [
            'start' => $now->copy()->subDay()->format('Y-m-d'),
            'end' => $now->copy()->addDay()->format('Y-m-d'),
            'granularity' => 'daily',
            'user_id' => $user->id,
        ];

        $kpis = $this->reportService->getKpis($filters);

        $this->assertEquals(3, $kpis['total_requests'], 'Total requests should only count processed requests');
        $this->assertEquals(66.7, $kpis['approval_rate'], 'Approval rate should be (2/3) * 100 = 66.7%');
    }

    public function test_facility_usage_only_counts_approved_and_conditional(): void
    {
        $this->skipIfSqlite();

        $user = User::factory()->create();
        $facility = Facility::factory()->create();

        $now = Carbon::now();

        $request1 = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        RequestFacility::create([
            'request_id' => $request1->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::APPROVED,
            'date_requested' => $now->format('Y-m-d'),
            'time_start' => '08:00:00',
            'time_end' => '10:00:00',
        ]);

        $request2 = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        RequestFacility::create([
            'request_id' => $request2->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
            'date_requested' => $now->format('Y-m-d'),
            'time_start' => '10:00:00',
            'time_end' => '12:00:00',
        ]);

        $request3 = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'created_at' => $now,
            'processed_at' => $now,
        ]);

        RequestFacility::create([
            'request_id' => $request3->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::DENIED,
            'date_requested' => $now->format('Y-m-d'),
            'time_start' => '12:00:00',
            'time_end' => '14:00:00',
        ]);

        $filters = [
            'start' => $now->copy()->subDay()->format('Y-m-d'),
            'end' => $now->copy()->addDay()->format('Y-m-d'),
            'granularity' => 'daily',
            'user_id' => $user->id,
        ];

        $facilityUsageData = $this->reportService->getFacilityUsagePieData($filters);

        $this->assertCount(1, $facilityUsageData);
        $this->assertEquals(2, $facilityUsageData[0]['value'], 'Facility usage should only count Approved and Conditionally Approved');
    }

    public function test_get_methodology_returns_all_keys(): void
    {
        $methodology = $this->reportService->getMethodology();

        $expectedKeys = [
            'total_requests',
            'approval_rate',
            'avg_processing_days',
            'active_conflicts',
            'facility_usage',
            'event_types',
            'processing_time',
        ];

        foreach ($expectedKeys as $key) {
            $this->assertArrayHasKey($key, $methodology);
            $this->assertIsString($methodology[$key]);
            $this->assertNotEmpty($methodology[$key]);
        }
    }
}
