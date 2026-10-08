<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\User;
use App\Services\RequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Equipment availability is derived entirely from request_equipment's link to
 * the booking row that consumed it. A row written without that link — an
 * `attach()` that omits `request_facility_id` — silently reserves nothing, so the
 * facility reads as fully stocked while an approved booking still holds the units.
 *
 * Two seeders did exactly that (via belongsToMany attach with no link, and
 * booking rows left at their Pending default under Approved parents). They were
 * deleted, so these assertions are what stop it coming back: every writer is held
 * to linking its rows, and to producing a reservation the availability query can
 * actually see.
 */
class RequestEquipmentLinkageTest extends TestCase
{
    use RefreshDatabase;

    private const DATE = '2026-12-01';

    public function test_web_submission_links_every_equipment_row_to_its_booking(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitWebRequest($user, $facility, $equipment, 4);

        $this->assertNoOrphanEquipmentRows();
        $this->assertEveryEquipmentRowPointsAtItsOwnRequestsBooking();
    }

    public function test_chatbot_submission_links_every_equipment_row_to_its_booking(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitChatRequest($user, $facility, $equipment, 4);

        $this->assertNoOrphanEquipmentRows();
        $this->assertEveryEquipmentRowPointsAtItsOwnRequestsBooking();
    }

    /**
     * The payoff: a booking created through the app, once approved, must actually
     * reduce availability. This fails if either the link is missing or the booking
     * row's status is left Pending under an Approved parent.
     */
    public function test_an_approved_submission_really_reserves_its_equipment(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitWebRequest($user, $facility, $equipment, 6);

        $request = FacilityRequest::firstOrFail();
        app(RequestService::class)->approve($request->id);

        $reserved = $equipment->fresh()->quantityReservedInFacility(
            $facility->id,
            self::DATE,
            '09:00',
            '11:00'
        );

        $this->assertSame(6, $reserved, 'An approved booking must hold its equipment out of availability.');
        $this->assertSame(4, $equipment->fresh()->slotAvailabilityInFacility($facility->id, self::DATE, '09:00', '11:00')['remaining_quantity']);
    }

    public function test_approving_propagates_the_status_to_the_booking_row(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitWebRequest($user, $facility, $equipment, 2);

        $request = FacilityRequest::firstOrFail();
        app(RequestService::class)->approve($request->id);

        // Reservation status is read from the booking row, never the parent, so
        // this must follow the approval.
        $this->assertSame(
            RequestStatus::APPROVED->value,
            $request->requestFacilities()->firstOrFail()->fresh()->status->value
        );
    }

    public function test_a_pending_submission_does_not_reserve_equipment(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitWebRequest($user, $facility, $equipment, 6);

        // Pending is a soft signal, not a hold — the number must stay untouched.
        $this->assertSame(0, $equipment->fresh()->quantityReservedInFacility($facility->id, self::DATE, '09:00', '11:00'));
    }

    public function test_a_booking_in_another_facility_does_not_reserve_this_facilitys_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $other = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        // Both facilities must legitimately hold the same equipment, otherwise the
        // submission is rejected for over-allocating rather than exercising the
        // cross-facility reservation rule.
        $equipment->facilities()->attach($other->id, ['quantity' => 10]);

        $this->submitWebRequest($user, $other, $equipment, 6);
        FacilityRequest::firstOrFail()->update(['status' => RequestStatus::APPROVED]);

        $this->assertSame(0, $equipment->fresh()->quantityReservedInFacility($facility->id, self::DATE, '09:00', '11:00'));
        $this->assertSame(6, $equipment->fresh()->quantityReservedInFacility($other->id, self::DATE, '09:00', '11:00'));
    }

    private function assertNoOrphanEquipmentRows(): void
    {
        $orphans = DB::table('request_equipment')->whereNull('request_facility_id')->count();

        $this->assertSame(0, $orphans, 'Every request_equipment row must link to the booking that consumed it.');
    }

    private function assertEveryEquipmentRowPointsAtItsOwnRequestsBooking(): void
    {
        $mismatched = DB::table('request_equipment as re')
            ->join('request_facilities as rf', 'rf.id', '=', 're.request_facility_id')
            ->whereColumn('rf.request_id', '!=', 're.request_id')
            ->count();

        $this->assertSame(0, $mismatched, 'A booking link must stay within the request that owns it.');
    }

    private function submitWebRequest(User $user, Facility $facility, Equipment $equipment, int $quantity): void
    {
        $this->actingAs($user)->post(route('requests.store'), [
            'title' => 'Linkage invariant',
            'description' => 'Checks that equipment rows link to their booking.',
            'facility_bookings' => [[
                'facility_id' => $facility->id,
                'date' => self::DATE,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [['equipment_id' => $equipment->id, 'quantity_needed' => $quantity]],
                'borrowed_equipment' => [],
                'external_equipment' => [],
            ]],
        ])->assertSessionHasNoErrors();
    }

    private function submitChatRequest(User $user, Facility $facility, Equipment $equipment, int $quantity): void
    {
        $this->actingAs($user)->postJson(route('api.db.create.request'), [
            'title' => 'Chat linkage invariant',
            'description' => 'Checks that chatbot equipment rows link to their booking.',
            'facility_bookings' => [[
                'facility_id' => $facility->id,
                'date' => self::DATE,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [['equipment_id' => $equipment->id, 'quantity_needed' => $quantity]],
            ]],
        ])->assertOk();
    }

    /**
     * Regression: getEditData() builds per-row availability inside a closure over
     * the request's booking rows. The closure read $equipmentById without
     * capturing it, so GET /requests/{id}/edit threw "Undefined variable" and the
     * edit page 500'd for every request that had equipment.
     */
    public function test_the_edit_page_loads_with_equipment_availability(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->submitWebRequest($user, $facility, $equipment, 3);
        $request = FacilityRequest::firstOrFail();

        $response = $this->actingAs($user)->get(route('requests.edit', $request));

        $response->assertOk();

        $booking = collect($response->viewData('page')['props']['existingRequest']['facility_bookings'])->first();

        $this->assertNotNull($booking);
        $this->assertSame($equipment->id, $booking['equipment'][0]['equipment_id']);
        $this->assertSame(3, $booking['equipment'][0]['quantity_needed']);
        $this->assertSame(10, $booking['equipment'][0]['availability']['total_quantity']);
        $this->assertArrayHasKey('availability', $booking['equipment'][0]);
    }

    /**
     * Regression: FacilityFormRequest::excludeRequestId() cast the route
     * parameter straight to int. Route model binding hands back a Request
     * INSTANCE there, and PHP evaluated that cast to 1 with a warning — so every
     * edit of anything other than request #1 excluded the wrong request.
     *
     * Arranged so the bug is observable: request #1 holds 6 approved units and
     * request #2 holds 3, leaving 1 free. The request being edited is #3 and
     * holds nothing itself, so the only thing that can make its 3-unit request
     * fail is #1's reservation being counted. Under the bug, #1 is excluded,
     * the validator sees 7 free, and the over-allocated submit is let through.
     */
    public function test_editing_still_counts_other_requests_reserved_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->approveHolding($user, $facility, $equipment, 6);
        $this->approveHolding($user, $facility, $equipment, 3);

        $target = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
        ]);

        $this->assertSame(3, $target->id, 'Target must not be request #1 for this regression to mean anything.');
        $this->assertSame(1, $equipment->fresh()->slotAvailabilityInFacility($facility->id, self::DATE, '09:00', '11:00')['remaining_quantity']);

        $response = $this->actingAs($user)->put(route('requests.update', $target->id), [
            'title' => 'Should be rejected',
            'description' => 'Only 1 unit is free but 3 are requested.',
            'facility_bookings' => [[
                'facility_id' => $facility->id,
                'date' => self::DATE,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [['equipment_id' => $equipment->id, 'quantity_needed' => 3]],
                'borrowed_equipment' => [],
                'external_equipment' => [],
            ]],
        ]);

        $response->assertSessionHasErrors('facility_bookings.0.equipment.0.quantity_needed');
        $this->assertStringContainsString('only 1 remaining', session('errors')->first('facility_bookings.0.equipment.0.quantity_needed'));
    }

    /** An approved request holding $quantity units in the test slot. */
    private function approveHolding(User $user, Facility $facility, Equipment $equipment, int $quantity): FacilityRequest
    {
        $request = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::APPROVED,
            'on_hold' => false,
        ]);

        $rf = $request->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => self::DATE,
            'time_start' => '09:00',
            'time_end' => '11:00',
            'status' => RequestStatus::APPROVED,
        ]);

        DB::table('request_equipment')->insert([
            'request_id' => $request->id,
            'request_facility_id' => $rf->id,
            'equipment_id' => $equipment->id,
            'quantity_needed' => $quantity,
            'is_borrowed' => false,
            'source_facility_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $request;
    }

    private function equipmentHeldBy(Facility $facility, int $quantity): Equipment
    {
        $equipment = Equipment::factory()->create(['quantity' => $quantity]);
        $equipment->facilities()->attach($facility->id, ['quantity' => $quantity]);

        return $equipment;
    }
}
