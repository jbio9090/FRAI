<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Services\FacilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FacilityScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_schedule_shows_approved_rows_under_partially_approved_parent(): void
    {
        $facility = Facility::factory()->create(['status' => 'active']);
        $request = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        $booking = RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-21',
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $events = app(FacilityService::class)->getSchedule($facility->id, '2026-09-01', '2026-09-30');

        $this->assertTrue($events->contains(fn ($event) => $event['id'] === $booking->id));
    }

    public function test_get_schedule_shows_conditionally_approved_rows_and_hides_pending_but_includes_held(): void
    {
        $facility = Facility::factory()->create(['status' => 'active']);

        $parent = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        $conditional = RequestFacility::create([
            'request_id' => $parent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-21',
            'time_start' => '11:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
        ]);
        $pending = RequestFacility::create([
            'request_id' => $parent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-22',
            'time_start' => '11:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        $heldParent = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => true,
        ]);
        $held = RequestFacility::create([
            'request_id' => $heldParent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-23',
            'time_start' => '11:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $events = app(FacilityService::class)->getSchedule($facility->id, '2026-09-01', '2026-09-30');
        $ids = $events->pluck('id');

        $this->assertTrue($ids->contains($conditional->id));
        $this->assertFalse($ids->contains($pending->id));
        $this->assertTrue($ids->contains($held->id));
    }

    public function test_get_day_schedule_includes_held_approved_rows(): void
    {
        $facility = Facility::factory()->create(['status' => 'active']);
        $heldParent = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => true,
        ]);
        $held = RequestFacility::create([
            'request_id' => $heldParent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-23',
            'time_start' => '11:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $events = app(FacilityService::class)->getDaySchedule($facility->id, '2026-09-23');

        $this->assertTrue($events->contains(fn ($event) => $event['request_id'] === $heldParent->id));
    }

    public function test_get_all_schedule_uses_row_status_not_parent_status(): void
    {
        $facility = Facility::factory()->create(['status' => 'active']);
        $request = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        $booking = RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-21',
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);
        $heldParent = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => true,
        ]);
        $held = RequestFacility::create([
            'request_id' => $heldParent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-22',
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $events = app(FacilityService::class)->getAllSchedule('2026-09-01', '2026-09-30');

        $this->assertTrue($events->contains(fn ($event) => $event['id'] === $booking->id));
        $this->assertTrue($events->contains(fn ($event) => $event['id'] === $held->id));
    }

    public function test_facility_detail_page_includes_partially_approved_bookings(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create(['status' => 'active']);
        $request = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => now()->format('Y-m-d'),
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::APPROVED,
        ]);
        $heldParent = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => true,
        ]);
        RequestFacility::create([
            'request_id' => $heldParent->id,
            'facility_id' => $facility->id,
            'date_requested' => now()->format('Y-m-d'),
            'time_start' => '11:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $response = $this->actingAs($user)->get(route('facility.detail', $facility->id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('facilities/detail')
            ->has('initialEvents', 2));
    }
}
