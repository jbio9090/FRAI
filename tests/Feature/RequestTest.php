<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
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
}
