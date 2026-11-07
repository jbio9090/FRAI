<?php

namespace Tests\Feature;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_monthly_report_counts_requests_by_event_date(): void
    {
        $service = app(ReportService::class);

        $user = User::factory()->create();
        $firstFacility = Facility::factory()->create(['name' => 'COED AVR']);
        $secondFacility = Facility::factory()->create(['name' => 'Main Auditorium']);

        $approved = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-11-20 08:00:00',
            'processed_at' => '2026-11-22 08:00:00',
        ]);

        $denied = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'priority_level' => PriorityLevel::Organization,
            'created_at' => '2026-11-25 08:00:00',
            'processed_at' => '2026-11-27 08:00:00',
        ]);

        RequestFacility::create([
            'request_id' => $approved->id,
            'facility_id' => $firstFacility->id,
            'date_requested' => '2026-11-05',
            'time_start' => '08:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $denied->id,
            'facility_id' => $secondFacility->id,
            'date_requested' => '2026-11-06',
            'time_start' => '13:00:00',
            'time_end' => '15:00:00',
            'status' => RequestStatus::DENIED,
        ]);

        $report = $service->getMonthlyReport(2026, 11);

        $this->assertSame('Nov 1-30, 2026', $report['period']['label']);

        $this->assertSame(2, $report['kpis']['requests_received']);
        $this->assertSame(1, $report['kpis']['total_requesters']);
        $this->assertSame(50.0, (float) $report['kpis']['approval_rate']);
        $this->assertSame(2.0, (float) $report['kpis']['avg_processing_days']);

        $activeDays = array_values(array_filter($report['volume'], fn ($point) => $point['value'] > 0));
        $this->assertCount(2, $activeDays);

        $status = collect($report['status'])->keyBy('status');
        $this->assertSame(1, $status['Approved']['value']);
        $this->assertSame(1, $status['Denied']['value']);
        $this->assertSame(0, $status['Pending']['value']);

        $eventTypes = collect($report['event_types'])->keyBy('category');
        $this->assertSame(1, $eventTypes['Academic']['value']);
        $this->assertSame(1, $eventTypes['Organization']['value']);

        $this->assertCount(2, $report['facility_usage']);
        $this->assertSame(2, array_sum(array_column($report['facility_usage'], 'amount')));
        $this->assertSame(2, array_sum(array_column($report['building_usage'], 'amount')));
    }

    public function test_previous_month_kpis_and_deltas(): void
    {
        $service = app(ReportService::class);

        $user = User::factory()->create();

        // Previous month (October 2026): 1 approved request, 1 day processing
        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-10-10 08:00:00',
            'processed_at' => '2026-10-11 08:00:00',
        ]);

        // Current month (November 2026): 2 requests (1 approved, 1 denied), 2 days processing each
        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-11-20 08:00:00',
            'processed_at' => '2026-11-22 08:00:00',
        ]);

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::DENIED,
            'priority_level' => PriorityLevel::Organization,
            'created_at' => '2026-11-25 08:00:00',
            'processed_at' => '2026-11-27 08:00:00',
        ]);

        $report = $service->getMonthlyReport(2026, 11, true);

        $this->assertSame(2, $report['kpis']['requests_received']);
        $this->assertSame(50.0, (float) $report['kpis']['approval_rate']);
        $this->assertSame(1, $report['kpis']['total_requesters']);
        $this->assertSame(2.0, (float) $report['kpis']['avg_processing_days']);

        $this->assertSame(1, $report['previous_kpis']['requests_received']);
        $this->assertSame(100.0, (float) $report['previous_kpis']['approval_rate']);
        $this->assertSame(1, $report['previous_kpis']['total_requesters']);
        $this->assertSame(1.0, (float) $report['previous_kpis']['avg_processing_days']);

        $this->assertEquals(1.0, $report['kpi_deltas']['requests_received']['delta']);
        $this->assertSame(100.0, (float) $report['kpi_deltas']['requests_received']['delta_percent']);
        $this->assertEquals(-50.0, $report['kpi_deltas']['approval_rate']['delta']);
        $this->assertSame(-50.0, (float) $report['kpi_deltas']['approval_rate']['delta_percent']);
        $this->assertEquals(0.0, $report['kpi_deltas']['total_requesters']['delta']);
        $this->assertSame(0.0, (float) $report['kpi_deltas']['total_requesters']['delta_percent']);
        $this->assertEquals(1.0, $report['kpi_deltas']['avg_processing_days']['delta']);
        $this->assertSame(100.0, (float) $report['kpi_deltas']['avg_processing_days']['delta_percent']);
    }

    public function test_kpi_deltas_are_null_when_previous_month_has_no_data(): void
    {
        $service = app(ReportService::class);

        $user = User::factory()->create();

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2026-11-20 08:00:00',
            'processed_at' => '2026-11-22 08:00:00',
        ]);

        $report = $service->getMonthlyReport(2026, 11, true);

        $this->assertSame(0, $report['previous_kpis']['requests_received']);
        $this->assertSame(0, $report['previous_kpis']['approval_rate']);
        $this->assertSame(0, $report['previous_kpis']['total_requesters']);
        $this->assertSame(0, $report['previous_kpis']['avg_processing_days']);

        $this->assertNull($report['kpi_deltas']['requests_received']['delta_percent']);
        $this->assertNull($report['kpi_deltas']['approval_rate']['delta_percent']);
        $this->assertNull($report['kpi_deltas']['total_requesters']['delta_percent']);
        $this->assertNull($report['kpi_deltas']['avg_processing_days']['delta_percent']);
    }

    public function test_previous_month_january_boundary_uses_december(): void
    {
        $service = app(ReportService::class);

        $user = User::factory()->create();

        FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'priority_level' => PriorityLevel::Academic,
            'created_at' => '2025-12-15 08:00:00',
            'processed_at' => '2025-12-16 08:00:00',
        ]);

        $report = $service->getMonthlyReport(2026, 1, true);

        $this->assertSame(1, $report['previous_kpis']['requests_received']);
        $this->assertSame(100.0, (float) $report['previous_kpis']['approval_rate']);
    }
}
