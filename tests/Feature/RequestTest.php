<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Services\RequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RequestTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A basic feature test example.
     */
    public function test_create_request_page_loads(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->get(route('request.create'));

        $response->assertOk();
    }

    public function test_get_filters_by_pending_and_approved_conflicts(): void
    {
        $user = User::factory()->create();

        $withPending = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
            'pending_conflict_rf_ids' => [1],
            'approved_conflict_rf_ids' => [],
        ]);

        $withApproved = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'pending_conflict_rf_ids' => [],
            'approved_conflict_rf_ids' => [2],
        ]);

        $withoutConflicts = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
            'pending_conflict_rf_ids' => [],
            'approved_conflict_rf_ids' => [],
        ]);

        $withBoth = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
            'pending_conflict_rf_ids' => [3],
            'approved_conflict_rf_ids' => [4],
        ]);

        $this->actingAs($user);

        $service = app(RequestService::class);

        $pendingOnly = $service->get(null, 'all', null, null, 'asc', null, null, null, true, false);
        $pendingIds = $pendingOnly->pluck('id');

        $this->assertTrue($pendingIds->contains($withPending->id));
        $this->assertTrue($pendingIds->contains($withBoth->id));
        $this->assertFalse($pendingIds->contains($withApproved->id));
        $this->assertFalse($pendingIds->contains($withoutConflicts->id));

        $approvedOnly = $service->get(null, 'all', null, null, 'asc', null, null, null, false, true);
        $approvedIds = $approvedOnly->pluck('id');

        $this->assertTrue($approvedIds->contains($withApproved->id));
        $this->assertTrue($approvedIds->contains($withBoth->id));
        $this->assertFalse($approvedIds->contains($withPending->id));
        $this->assertFalse($approvedIds->contains($withoutConflicts->id));

        $both = $service->get(null, 'all', null, null, 'asc', null, null, null, true, true);
        $bothIds = $both->pluck('id');

        $this->assertTrue($bothIds->contains($withBoth->id));
        $this->assertFalse($bothIds->contains($withPending->id));
        $this->assertFalse($bothIds->contains($withApproved->id));
        $this->assertFalse($bothIds->contains($withoutConflicts->id));
    }

    public function test_create_stores_conflicts_synchronously(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $service = app(RequestService::class);

        $this->actingAs($ownerA);

        $first = $service->create([
            'title' => 'First booking',
            'description' => 'First booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-21',
                    'time_start' => '10:00',
                    'time_end' => '12:00',
                ],
            ],
        ]);

        $this->assertEquals([], $first->fresh()->pending_conflict_rf_ids ?? []);

        $this->actingAs($ownerB);

        $second = $service->create([
            'title' => 'Second booking',
            'description' => 'Second booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-21',
                    'time_start' => '11:00',
                    'time_end' => '13:00',
                ],
            ],
        ]);

        $firstRfId = $first->requestFacilities()->first()->id;
        $secondRfId = $second->requestFacilities()->first()->id;

        $this->assertEquals([$firstRfId], $second->fresh()->pending_conflict_rf_ids);
        $this->assertEquals([$secondRfId], $first->fresh()->pending_conflict_rf_ids);
    }

    public function test_update_clears_stale_conflict_refs(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $service = app(RequestService::class);

        $this->actingAs($ownerA);

        $first = $service->create([
            'title' => 'First booking',
            'description' => 'First booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-22',
                    'time_start' => '10:00',
                    'time_end' => '12:00',
                ],
            ],
        ]);

        $this->actingAs($ownerB);

        $second = $service->create([
            'title' => 'Second booking',
            'description' => 'Second booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-22',
                    'time_start' => '11:00',
                    'time_end' => '13:00',
                ],
            ],
        ]);

        $this->assertNotEmpty($second->fresh()->pending_conflict_rf_ids);
        $this->assertNotEmpty($first->fresh()->pending_conflict_rf_ids);

        $service->update([
            'title' => 'Second booking',
            'description' => 'Second booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-22',
                    'time_start' => '14:00',
                    'time_end' => '15:00',
                ],
            ],
        ], $second->id);

        $this->assertEquals([], $second->fresh()->pending_conflict_rf_ids ?? []);
        $this->assertEquals([], $first->fresh()->pending_conflict_rf_ids ?? []);
    }

    public function test_conflict_filters_match_regardless_of_request_status(): void
    {
        $facility = Facility::factory()->create();
        $owner = User::factory()->create();

        $this->actingAs($owner);

        $service = app(RequestService::class);

        $approved = FacilityRequest::factory()->approved()->create(['user_id' => $owner->id]);

        RequestFacility::create([
            'request_id' => $approved->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-09-23',
            'time_start' => '07:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $pending = $service->create([
            'title' => 'Overlapping booking',
            'description' => 'Overlaps the approved booking',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-23',
                    'time_start' => '08:00',
                    'time_end' => '12:00',
                ],
            ],
        ]);

        $this->assertEquals(RequestStatus::PENDING, $pending->fresh()->status);
        $this->assertNotEmpty($pending->fresh()->approved_conflict_rf_ids);

        $filtered = $service->get(null, 'all', null, null, 'asc', null, null, null, false, true);

        $this->assertTrue($filtered->pluck('id')->contains($pending->id));
    }

    private function createBooking(User $owner, Facility $facility, string $date, string $start, string $end): FacilityRequest
    {
        $this->actingAs($owner);

        return app(RequestService::class)->create([
            'title' => 'Test booking',
            'description' => 'Test booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => $date,
                    'time_start' => $start,
                    'time_end' => $end,
                ],
            ],
        ]);
    }

    public function test_pending_conflict_records_ids_and_flags_older_request(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-10-01', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-10-01', '11:00', '13:00');

        $firstRfId = $first->requestFacilities()->first()->id;
        $secondRfId = $second->requestFacilities()->first()->id;

        $this->assertEquals([$firstRfId], $second->fresh()->pending_conflict_rf_ids);
        $this->assertEquals([], $second->fresh()->approved_conflict_rf_ids ?? []);

        $flagged = $first->fresh();

        $this->assertEquals([$secondRfId], $flagged->pending_conflict_rf_ids);
        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $flagged->recommended_action);
        $this->assertEquals('Time conflict with pending requests', $flagged->recommended_action_reason);
    }

    public function test_approved_conflict_records_ids_without_touching_approved_side(): void
    {
        $facility = Facility::factory()->create();
        $owner = User::factory()->create();

        $this->actingAs($owner);

        $approved = FacilityRequest::factory()->approved()->create(['user_id' => $owner->id]);

        $approvedRf = RequestFacility::create([
            'request_id' => $approved->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-10-02',
            'time_start' => '07:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $originalRecommendation = $approved->recommended_action;

        $pending = $this->createBooking($owner, $facility, '2026-10-02', '08:00', '12:00');

        $this->assertEquals([$approvedRf->id], $pending->fresh()->approved_conflict_rf_ids);
        $this->assertEquals([], $pending->fresh()->pending_conflict_rf_ids ?? []);

        $untouched = $approved->fresh();

        $this->assertEquals([], $untouched->pending_conflict_rf_ids ?? []);
        $this->assertEquals([], $untouched->approved_conflict_rf_ids ?? []);
        $this->assertEquals($originalRecommendation, $untouched->recommended_action);
        $this->assertEquals(RequestStatus::APPROVED, $untouched->status);
    }

    public function test_request_overlapping_pending_and_approved_bookings_records_both(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();
        $ownerC = User::factory()->create();

        $pending = $this->createBooking($ownerA, $facility, '2026-10-03', '10:00', '12:00');

        $this->actingAs($ownerB);

        $approved = FacilityRequest::factory()->approved()->create(['user_id' => $ownerB->id]);

        $approvedRf = RequestFacility::create([
            'request_id' => $approved->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-10-03',
            'time_start' => '14:00:00',
            'time_end' => '16:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        $originalRecommendation = $approved->recommended_action;

        $both = $this->createBooking($ownerC, $facility, '2026-10-03', '11:00', '15:00');

        $pendingRfId = $pending->requestFacilities()->first()->id;

        $this->assertEquals([$pendingRfId], $both->fresh()->pending_conflict_rf_ids);
        $this->assertEquals([$approvedRf->id], $both->fresh()->approved_conflict_rf_ids);

        $flagged = $pending->fresh();

        $this->assertContains($both->requestFacilities()->first()->id, $flagged->pending_conflict_rf_ids);
        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $flagged->recommended_action);
        $this->assertEquals('Time conflict with pending requests', $flagged->recommended_action_reason);

        $untouched = $approved->fresh();

        $this->assertEquals([], $untouched->pending_conflict_rf_ids ?? []);
        $this->assertEquals([], $untouched->approved_conflict_rf_ids ?? []);
        $this->assertEquals($originalRecommendation, $untouched->recommended_action);
    }
}
