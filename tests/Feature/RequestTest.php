<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Notifications\RequestFacilityDecision;
use App\Notifications\RequestResult;
use App\Services\FacilityService;
use App\Services\RequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
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

    public function test_deny_clears_conflict_refs_on_other_requests(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-01', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-01', '11:00', '13:00');

        $firstRfId = $first->requestFacilities()->first()->id;

        $this->assertContains($firstRfId, $second->fresh()->pending_conflict_rf_ids ?? []);

        app(RequestService::class)->applyStatusTransition($first->id, RequestStatus::DENIED);

        $denied = $first->fresh();

        $this->assertEquals(RequestStatus::DENIED, $denied->status);
        $this->assertEquals(RequestStatus::DENIED, $denied->requestFacilities()->first()->status);

        $cleared = $second->fresh();

        $this->assertNotContains($firstRfId, $cleared->pending_conflict_rf_ids ?? []);
        $this->assertEquals([], $cleared->pending_conflict_rf_ids ?? []);
        $this->assertNull($cleared->recommended_action);
    }

    public function test_approve_migrates_pending_bucket_to_approved(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();
        $admin = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-02', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-02', '11:00', '13:00');

        $firstRfId = $first->requestFacilities()->first()->id;

        $this->assertContains($firstRfId, $second->fresh()->pending_conflict_rf_ids ?? []);

        $this->actingAs($admin);
        app(RequestService::class)->approve($first->id);

        $migrated = $second->fresh();

        // Pending time-overlaps are not held on approve, but their buckets
        // must stop describing the winner as pending.
        $this->assertFalse($migrated->on_hold);
        $this->assertEquals(RequestStatus::PENDING, $migrated->status);
        $this->assertNotContains($firstRfId, $migrated->pending_conflict_rf_ids ?? []);
        $this->assertContains($firstRfId, $migrated->approved_conflict_rf_ids ?? []);
    }

    public function test_bulk_for_reschedule_applies_without_crash(): void
    {
        Permission::findOrCreate('approve requests');
        Role::findOrCreate('admin')->givePermissionTo('approve requests');

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-03', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-03', '11:00', '13:00');

        $response = $this->actingAs($admin)->post(route('bulk.action'), [
            'ids' => [$first->id, $second->id],
            'action' => 'for_reschedule',
        ]);

        $response->assertRedirect();

        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $first->fresh()->status);
        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $second->fresh()->status);
        $this->assertEquals([], $first->fresh()->pending_conflict_rf_ids ?? []);
        $this->assertEquals([], $second->fresh()->pending_conflict_rf_ids ?? []);
    }

    public function test_conditionally_approved_blocker_is_detected(): void
    {
        $facility = Facility::factory()->create();
        $owner = User::factory()->create();

        $this->actingAs($owner);

        $blocker = FacilityRequest::factory()->conditionallyApproved()->create(['user_id' => $owner->id]);

        $blockerRf = RequestFacility::create([
            'request_id' => $blocker->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-11-04',
            'time_start' => '07:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::CONDITIONALLY_APPROVED,
        ]);

        $pending = $this->createBooking($owner, $facility, '2026-11-04', '08:00', '12:00');

        $this->assertContains($blockerRf->id, $pending->fresh()->approved_conflict_rf_ids ?? []);
    }

    public function test_held_request_can_resubmit_after_release(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();
        $admin = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-05', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-05', '11:00', '13:00');

        $this->actingAs($admin);
        app(RequestService::class)->putOnHold($second->fresh(), $first->fresh(), 'Superseded by approved request');

        $this->assertTrue($second->fresh()->on_hold);

        $this->actingAs($ownerB);
        app(RequestService::class)->update([
            'title' => 'Second booking',
            'description' => 'Second booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-11-05',
                    'time_start' => '14:00',
                    'time_end' => '15:00',
                ],
            ],
        ], $second->id);

        $resubmitted = $second->fresh();

        $this->assertFalse($resubmitted->on_hold);
        $this->assertNull($resubmitted->held_by_request_id);
        $this->assertEquals([], $resubmitted->pending_conflict_rf_ids ?? []);
    }

    public function test_deny_releases_held_requests(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();
        $admin = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-06', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-06', '11:00', '13:00');

        $this->actingAs($admin);
        app(RequestService::class)->putOnHold($second->fresh(), $first->fresh(), 'Superseded by approved request');

        $this->assertEquals($first->id, $second->fresh()->held_by_request_id);

        app(RequestService::class)->applyStatusTransition($first->id, RequestStatus::DENIED);

        $released = $second->fresh();

        $this->assertFalse($released->on_hold);
        $this->assertNull($released->held_by_request_id);
    }

    public function test_equipment_conflicts_are_stored_and_backfilled(): void
    {
        $facility = Facility::factory()->create();
        $equipment = Equipment::factory()->create();
        $equipment->facilities()->attach($facility->id, ['quantity' => 5]);

        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $bookingsFor = fn () => [
            [
                'facility_id' => $facility->id,
                'date' => '2026-11-07',
                'time_start' => '10:00',
                'time_end' => '12:00',
                'equipment' => [
                    ['equipment_id' => $equipment->id, 'quantity_needed' => 1],
                ],
            ],
        ];

        $this->actingAs($ownerA);
        $first = app(RequestService::class)->create([
            'title' => 'First equipment booking',
            'description' => 'First equipment booking description',
            'facility_bookings' => $bookingsFor(),
        ]);

        $this->actingAs($ownerB);
        $second = app(RequestService::class)->create([
            'title' => 'Second equipment booking',
            'description' => 'Second equipment booking description',
            'facility_bookings' => $bookingsFor(),
        ]);

        $this->assertEquals([$first->id], $second->fresh()->pending_equipment_conflict_request_ids ?? []);
        $this->assertContains($second->id, $first->fresh()->pending_equipment_conflict_request_ids ?? []);

        app(RequestService::class)->applyStatusTransition($first->id, RequestStatus::DENIED);

        $this->assertEquals([], $second->fresh()->pending_equipment_conflict_request_ids ?? []);
    }

    private function actingAsAdmin(): User
    {
        Permission::findOrCreate('approve requests');
        Role::findOrCreate('admin')->givePermissionTo('approve requests');

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function createApprovedRequestWithBookings(User $owner, Facility $facility, array $bookings): FacilityRequest
    {
        $request = FacilityRequest::factory()->approved()->create(['user_id' => $owner->id]);

        foreach ($bookings as $booking) {
            RequestFacility::create([
                'request_id' => $request->id,
                'facility_id' => $facility->id,
                'date_requested' => $booking['date'],
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
                'status' => RequestStatus::APPROVED,
            ]);
        }

        return $request;
    }

    public function test_approve_facility_flips_only_overlapping_loser_row(): void
    {
        $facility = Facility::factory()->create();
        $loserOwner = User::factory()->create();
        $winnerOwner = User::factory()->create();
        $admin = User::factory()->create();

        $loser = $this->createApprovedRequestWithBookings($loserOwner, $facility, [
            ['date' => '2026-12-01', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
            ['date' => '2026-12-02', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
        ]);

        $overlapRf = $loser->requestFacilities()->where('date_requested', '2026-12-01')->firstOrFail();
        $otherRf = $loser->requestFacilities()->where('date_requested', '2026-12-02')->firstOrFail();

        $winner = $this->createBooking($winnerOwner, $facility, '2026-12-01', '11:30', '16:00');
        $winnerRf = $winner->requestFacilities()->firstOrFail();

        $this->actingAs($admin);
        $approvedRf = app(RequestService::class)->approveFacility($winnerRf->id);

        $this->assertEquals(RequestStatus::APPROVED, $approvedRf->fresh()->status);
        $this->assertEquals(RequestStatus::APPROVED, $winner->fresh()->status);
        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $overlapRf->fresh()->status);
        $this->assertEquals(RequestStatus::APPROVED, $otherRf->fresh()->status);

        $loserFresh = $loser->fresh();

        $this->assertEquals(RequestStatus::PARTIALLY_APPROVED, $loserFresh->status);
        $this->assertTrue($loserFresh->on_hold);
        $this->assertEquals($winner->id, $loserFresh->held_by_request_id);
        $this->assertEquals([$loser->id], $approvedRf->getAttribute('held_request_ids'));
    }

    public function test_approve_facility_without_overlap_holds_nothing(): void
    {
        $facility = Facility::factory()->create();
        $loserOwner = User::factory()->create();
        $winnerOwner = User::factory()->create();
        $admin = User::factory()->create();

        $loser = $this->createApprovedRequestWithBookings($loserOwner, $facility, [
            ['date' => '2026-12-05', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
        ]);

        $loserRf = $loser->requestFacilities()->firstOrFail();

        $winner = $this->createBooking($winnerOwner, $facility, '2026-12-06', '10:00', '16:00');
        $winnerRf = $winner->requestFacilities()->firstOrFail();

        $this->actingAs($admin);
        $approvedRf = app(RequestService::class)->approveFacility($winnerRf->id);

        $this->assertEquals(RequestStatus::APPROVED, $approvedRf->fresh()->status);
        $this->assertEquals(RequestStatus::APPROVED, $loserRf->fresh()->status);
        $this->assertEquals(RequestStatus::APPROVED, $loser->fresh()->status);
        $this->assertFalse($loser->fresh()->on_hold);
        $this->assertEquals([], $approvedRf->getAttribute('held_request_ids'));
    }

    public function test_full_approve_exposes_held_request_ids_and_notifies_loser(): void
    {
        $facility = Facility::factory()->create();
        $loserOwner = User::factory()->create();
        $winnerOwner = User::factory()->create();

        $loser = $this->createApprovedRequestWithBookings($loserOwner, $facility, [
            ['date' => '2026-12-10', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
        ]);

        $winner = $this->createBooking($winnerOwner, $facility, '2026-12-10', '11:00', '13:00');

        Notification::fake();

        $admin = $this->actingAsAdmin();
        $response = $this->actingAs($admin)->post(route('requests.updateStatus', $winner->id), [
            'action' => 'approve',
        ]);

        $response->assertRedirect();

        $loserFresh = $loser->fresh();

        $this->assertEquals(RequestStatus::APPROVED, $winner->fresh()->status);
        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $loserFresh->status);
        $this->assertTrue($loserFresh->on_hold);
        $this->assertEquals($winner->id, $loserFresh->held_by_request_id);

        Notification::assertSentTo($winnerOwner, RequestResult::class, fn ($notification, $channels, $notifiable) => $notification->toArray($notifiable)['status'] === RequestStatus::APPROVED->value);
        Notification::assertSentTo($loserOwner, RequestResult::class, fn ($notification, $channels, $notifiable) => $notification->toArray($notifiable)['status'] === RequestStatus::ON_HOLD->value);
    }

    public function test_approve_facility_notifies_winner_and_loser(): void
    {
        $facility = Facility::factory()->create();
        $loserOwner = User::factory()->create();
        $winnerOwner = User::factory()->create();

        $loser = $this->createApprovedRequestWithBookings($loserOwner, $facility, [
            ['date' => '2026-12-11', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
            ['date' => '2026-12-12', 'time_start' => '07:00:00', 'time_end' => '12:00:00'],
        ]);

        $winner = $this->createBooking($winnerOwner, $facility, '2026-12-11', '11:30', '16:00');
        $winnerRf = $winner->requestFacilities()->firstOrFail();

        Notification::fake();

        $admin = $this->actingAsAdmin();
        $response = $this->actingAs($admin)->post(route('requests.facilities.updateStatus', [
            'request' => $winner->id,
            'facility' => $winnerRf->id,
        ]), [
            'action' => 'approve',
        ]);

        $response->assertRedirect();

        $loserFresh = $loser->fresh();

        $this->assertEquals(RequestStatus::FOR_RESCHEDULE, $loser->requestFacilities()->where('date_requested', '2026-12-11')->firstOrFail()->fresh()->status);
        $this->assertEquals(RequestStatus::APPROVED, $loser->requestFacilities()->where('date_requested', '2026-12-12')->firstOrFail()->fresh()->status);
        $this->assertEquals(RequestStatus::PARTIALLY_APPROVED, $loserFresh->status);
        $this->assertTrue($loserFresh->on_hold);

        Notification::assertSentTo($winnerOwner, RequestFacilityDecision::class);
        Notification::assertSentTo($loserOwner, RequestResult::class, fn ($notification, $channels, $notifiable) => $notification->toArray($notifiable)['status'] === RequestStatus::ON_HOLD->value);
    }

    public function test_deny_releases_hold_and_exposes_released_ids(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();
        $admin = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-12-13', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-12-13', '11:00', '13:00');

        $this->actingAs($admin);
        app(RequestService::class)->putOnHold($second->fresh(), $first->fresh(), 'Superseded by approved request');

        $this->assertTrue($second->fresh()->on_hold);

        $denied = app(RequestService::class)->applyStatusTransition($first->id, RequestStatus::DENIED);

        $this->assertEquals([$second->id], $denied->getAttribute('released_request_ids'));

        $released = $second->fresh();

        $this->assertFalse($released->on_hold);
        $this->assertNull($released->held_by_request_id);
    }

    public function test_day_schedule_shows_approved_rows_regardless_of_parent_status(): void
    {
        $facility = Facility::factory()->create();
        $owner = User::factory()->create();

        $this->actingAs($owner);

        $parent = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $parent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-12-20',
            'time_start' => '10:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $parent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-12-21',
            'time_start' => '10:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::DENIED,
        ]);

        $events = app(FacilityService::class)->getDaySchedule($facility->id, '2026-12-20');

        $this->assertCount(1, $events);
        $this->assertSame(RequestStatus::APPROVED, $events->first()['status']);
        $this->assertSame($parent->title, $events->first()['request_title']);

        $this->assertSame([], app(FacilityService::class)->getDaySchedule($facility->id, '2026-12-21')->all());
    }

    public function test_day_schedule_includes_rows_of_held_requests(): void
    {
        $facility = Facility::factory()->create();
        $owner = User::factory()->create();

        $this->actingAs($owner);

        $parent = FacilityRequest::factory()->approved()->create([
            'user_id' => $owner->id,
            'on_hold' => true,
        ]);

        RequestFacility::create([
            'request_id' => $parent->id,
            'facility_id' => $facility->id,
            'date_requested' => '2026-12-22',
            'time_start' => '10:00:00',
            'time_end' => '12:00:00',
            'status' => RequestStatus::APPROVED,
        ]);

        // Display-only schedules include held parents' approved rows; only
        // approve-time conflict scans exclude on-hold requests.
        $events = app(FacilityService::class)->getDaySchedule($facility->id, '2026-12-22');

        $this->assertCount(1, $events);
        $this->assertSame($parent->id, $events->first()['request_id']);
    }

    public function test_backfill_only_merges_overlapping_rf_ids(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $this->actingAs($ownerA);
        $multi = app(RequestService::class)->create([
            'title' => 'Multi date booking',
            'description' => 'Multi date booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-21',
                    'time_start' => '07:00',
                    'time_end' => '19:30',
                ],
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-22',
                    'time_start' => '07:00',
                    'time_end' => '20:00',
                ],
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-23',
                    'time_start' => '07:00',
                    'time_end' => '20:00',
                ],
            ],
        ]);

        $this->actingAs($ownerB);
        $single = app(RequestService::class)->create([
            'title' => 'Single date booking',
            'description' => 'Single date booking description',
            'facility_bookings' => [
                [
                    'facility_id' => $facility->id,
                    'date' => '2026-09-21',
                    'time_start' => '09:00',
                    'time_end' => '14:00',
                ],
            ],
        ]);

        $multiRfByDate = $multi->requestFacilities()->get()->keyBy(fn ($rf) => $rf->date_requested);
        $overlappingRfId = (int) $multiRfByDate['2026-09-21']->id;

        $singleFresh = $single->fresh();

        // Only the 09-21 RF overlaps; 09-22/09-23 ids must not leak in.
        $this->assertEquals([$overlappingRfId], $singleFresh->pending_conflict_rf_ids);

        $multiFresh = $multi->fresh();
        $singleRfId = (int) $single->requestFacilities()->first()->id;

        // Backfill side also records only the overlapping own RF, not all
        // three RF ids of the multi-date request.
        $this->assertEquals([$singleRfId], $multiFresh->pending_conflict_rf_ids);
    }

    public function test_conflict_id_lists_stay_unique(): void
    {
        $facility = Facility::factory()->create();
        $ownerA = User::factory()->create();
        $ownerB = User::factory()->create();

        $first = $this->createBooking($ownerA, $facility, '2026-11-01', '10:00', '12:00');
        $second = $this->createBooking($ownerB, $facility, '2026-11-01', '11:00', '13:00');

        foreach ([$first->fresh(), $second->fresh()] as $request) {
            foreach (['pending_conflict_rf_ids', 'approved_conflict_rf_ids'] as $key) {
                $ids = $request->getAttribute($key) ?? [];
                $this->assertEquals(array_values(array_unique(array_map('intval', $ids))), array_map('intval', $ids));
            }
        }
    }
}
