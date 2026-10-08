<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Availability is derived from request_facilities, not from the parent request:
 * an approved facility-level decision leaves a Partially Approved parent over an
 * Approved slot, and the units in that slot are genuinely spoken for.
 */
class EquipmentAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private const DATE = '2026-11-04';

    public function test_approved_booking_in_the_same_facility_reduces_availability(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->reserve($facility, $equipment, 7, RequestStatus::APPROVED);

        $this->assertAvailability($user, $facility, [
            'total_quantity' => 10,
            'reserved_quantity' => 7,
            'available_quantity' => 3,
            'is_limited' => true,
            'is_empty' => false,
        ]);
    }

    public function test_approved_booking_in_another_facility_does_not_reduce_availability(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $other = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->reserve($other, $equipment, 10, RequestStatus::APPROVED);

        $this->assertAvailability($user, $facility, [
            'total_quantity' => 10,
            'reserved_quantity' => 0,
            'available_quantity' => 10,
            'is_limited' => false,
        ]);
    }

    public function test_partially_approved_parent_with_an_approved_slot_still_reserves_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $request = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        $this->reserveOn($request, $facility, $equipment, 6, RequestStatus::APPROVED);

        // The parent is Partially Approved, which the previous query filtered on,
        // so these units used to read as fully available.
        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 6,
            'available_quantity' => 4,
        ]);
    }

    public function test_denied_slot_under_a_partially_approved_parent_does_not_reserve_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $request = FacilityRequest::factory()->create([
            'status' => RequestStatus::PARTIALLY_APPROVED,
            'on_hold' => false,
        ]);
        $this->reserveOn($request, $facility, $equipment, 6, RequestStatus::DENIED);

        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 0,
            'available_quantity' => 10,
        ]);
    }

    public function test_conditionally_approved_slot_reserves_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->reserve($facility, $equipment, 4, RequestStatus::CONDITIONALLY_APPROVED);

        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 4,
            'available_quantity' => 6,
        ]);
    }

    public function test_pending_slot_does_not_reserve_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->reserve($facility, $equipment, 4, RequestStatus::PENDING);

        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 0,
            'available_quantity' => 10,
        ]);
    }

    public function test_booking_on_hold_does_not_reserve_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $request = FacilityRequest::factory()->create([
            'status' => RequestStatus::APPROVED,
            'on_hold' => true,
        ]);
        $this->reserveOn($request, $facility, $equipment, 10, RequestStatus::APPROVED);

        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 0,
            'available_quantity' => 10,
        ]);
    }

    public function test_booking_that_ends_as_the_window_begins_does_not_reserve_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        // 09:00-11:00 booked, querying 11:00-13:00: touching, not overlapping.
        $this->reserveAt($facility, $equipment, 10, '09:00', '11:00', RequestStatus::APPROVED);

        $this->assertAvailabilityForWindow($user, $facility, '11:00', '13:00', [
            'reserved_quantity' => 0,
            'available_quantity' => 10,
        ]);
    }

    public function test_borrowed_away_reduces_the_source_facility(): void
    {
        $user = User::factory()->create();
        $source = Facility::factory()->create();
        $borrowing = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($source, 10);

        $request = FacilityRequest::factory()->approved()->create(['on_hold' => false]);
        $rf = $this->slot($request, $borrowing, '09:00', '11:00', RequestStatus::APPROVED);

        DB::table('request_equipment')->insert([
            'request_id' => $request->id,
            'request_facility_id' => $rf->id,
            'equipment_id' => $equipment->id,
            'quantity_needed' => 8,
            'is_borrowed' => true,
            'source_facility_id' => $source->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertAvailability($user, $source, [
            'reserved_quantity' => 8,
            'available_quantity' => 2,
        ]);
    }

    /**
     * The join used to correlate only on request_id, so every request_equipment
     * row of a request was summed against any window where the request had an
     * overlapping slot at that facility — double counting across two separate
     * bookings of the same equipment.
     */
    public function test_same_request_with_two_non_overlapping_bookings_reserves_once(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $request = FacilityRequest::factory()->approved()->create(['on_hold' => false]);

        $morning = $this->slot($request, $facility, '09:00', '11:00', RequestStatus::APPROVED);
        $evening = $this->slot($request, $facility, '14:00', '16:00', RequestStatus::APPROVED);

        foreach ([$morning, $evening] as $rf) {
            DB::table('request_equipment')->insert([
                'request_id' => $request->id,
                'request_facility_id' => $rf->id,
                'equipment_id' => $equipment->id,
                'quantity_needed' => 3,
                'is_borrowed' => false,
                'source_facility_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Each window sees only its own booking's 3 units, not both.
        $this->assertAvailabilityForWindow($user, $facility, '09:00', '11:00', [
            'reserved_quantity' => 3,
            'available_quantity' => 7,
        ]);
        $this->assertAvailabilityForWindow($user, $facility, '14:00', '16:00', [
            'reserved_quantity' => 3,
            'available_quantity' => 7,
        ]);
    }

    public function test_exclude_request_id_ignores_the_request_own_reservation(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $request = FacilityRequest::factory()->approved()->create(['on_hold' => false]);
        $this->reserveOn($request, $facility, $equipment, 10, RequestStatus::APPROVED);

        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 10,
            'available_quantity' => 0,
            'is_empty' => true,
        ]);

        // Editing that request must see its own units as free again.
        $this->assertAvailability($user, $facility, [
            'reserved_quantity' => 0,
            'available_quantity' => 10,
        ], $request->id);
    }

    public function test_reservations_explain_where_the_stock_is_committed(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $requester = User::factory()->create(['name' => 'Juan Dela Cruz']);

        $request = FacilityRequest::factory()->create([
            'user_id' => $requester->id,
            'title' => 'Community Outreach',
            'status' => RequestStatus::APPROVED,
            'on_hold' => false,
        ]);
        $this->reserveOn($request, $facility, $equipment, 7, RequestStatus::APPROVED);

        $reservation = $this->availabilityRow($user, $facility)['reservations'][0] ?? null;

        $this->assertNotNull($reservation);
        $this->assertSame($request->id, $reservation['request_id']);
        $this->assertSame('Community Outreach', $reservation['request_title']);
        $this->assertSame('Juan Dela Cruz', $reservation['requester']);
        $this->assertSame(7, $reservation['quantity']);
        $this->assertSame('09:00', $reservation['time_start']);
        $this->assertSame('11:00', $reservation['time_end']);
        $this->assertSame(self::DATE, $reservation['date']);
        $this->assertSame($facility->name, $reservation['facility_name']);
        $this->assertFalse($reservation['is_borrowed']);
        $this->assertNull($reservation['source_facility_name']);
    }

    public function test_reservations_exclude_pending_bookings(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $this->reserve($facility, $equipment, 4, RequestStatus::PENDING);

        $this->assertSame([], $this->availabilityRow($user, $facility)['reservations']);
    }

    public function test_reservations_name_the_source_facility_for_borrowed_units(): void
    {
        $user = User::factory()->create();
        $source = Facility::factory()->create(['name' => 'Assembly Hall']);
        $borrowing = Facility::factory()->create(['name' => 'COED AVR']);
        $equipment = $this->equipmentHeldBy($source, 10);

        $request = FacilityRequest::factory()->approved()->create(['on_hold' => false]);
        $rf = $this->slot($request, $borrowing, '09:00', '11:00', RequestStatus::APPROVED);

        DB::table('request_equipment')->insert([
            'request_id' => $request->id,
            'request_facility_id' => $rf->id,
            'equipment_id' => $equipment->id,
            'quantity_needed' => 8,
            'is_borrowed' => true,
            'source_facility_id' => $source->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $reservation = $this->availabilityRow($user, $source)['reservations'][0] ?? null;

        $this->assertNotNull($reservation);
        $this->assertTrue($reservation['is_borrowed']);
        $this->assertSame('Assembly Hall', $reservation['source_facility_name']);
        $this->assertSame('COED AVR', $reservation['facility_name']);
    }

    public function test_reservations_are_empty_when_nothing_is_booked(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $this->equipmentHeldBy($facility, 10);

        $this->assertSame([], $this->availabilityRow($user, $facility)['reservations']);
    }

    private function equipmentHeldBy(Facility $facility, int $quantity): Equipment
    {
        $equipment = Equipment::factory()->create(['quantity' => $quantity]);
        $equipment->facilities()->attach($facility->id, ['quantity' => $quantity]);

        return $equipment;
    }

    private function reserve(Facility $facility, Equipment $equipment, int $quantity, RequestStatus $status): void
    {
        $this->reserveAt($facility, $equipment, $quantity, '09:00', '11:00', $status);
    }

    private function reserveAt(Facility $facility, Equipment $equipment, int $quantity, string $start, string $end, RequestStatus $status): void
    {
        $request = FacilityRequest::factory()->create([
            'status' => $status,
            'on_hold' => false,
        ]);

        $this->reserveOn($request, $facility, $equipment, $quantity, $status, $start, $end);
    }

    private function reserveOn(
        FacilityRequest $request,
        Facility $facility,
        Equipment $equipment,
        int $quantity,
        RequestStatus $status,
        string $start = '09:00',
        string $end = '11:00'
    ): void {
        $rf = $this->slot($request, $facility, $start, $end, $status);

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
    }

    private function slot(FacilityRequest $request, Facility $facility, string $start, string $end, RequestStatus $status): RequestFacility
    {
        return $request->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => self::DATE,
            'time_start' => $start,
            'time_end' => $end,
            'status' => $status,
        ]);
    }

    /**
     * @param  array<string, mixed>  $expected
     */
    private function assertAvailability(User $user, Facility $facility, array $expected, ?int $excludeRequestId = null): void
    {
        $this->assertAvailabilityForWindow($user, $facility, '09:00', '11:00', $expected, $excludeRequestId);
    }

    /**
     * @return array<string, mixed>
     */
    private function availabilityRow(User $user, Facility $facility, ?int $excludeRequestId = null, string $date = self::DATE): array
    {
        $response = $this->actingAs($user)->postJson(route('equipment.availability'), [
            'facility_id' => $facility->id,
            'dates' => [$date],
            'time_start' => '09:00',
            'time_end' => '11:00',
            'exclude_request_id' => $excludeRequestId,
        ]);

        $response->assertOk();

        $row = collect($response->json("dates.{$date}.availability"))->first();

        $this->assertNotNull($row, 'Expected an availability row for the facility equipment.');

        return $row;
    }

    /**
     * @param  array<string, mixed>  $expected
     */
    private function assertAvailabilityForWindow(
        User $user,
        Facility $facility,
        string $start,
        string $end,
        array $expected,
        ?int $excludeRequestId = null
    ): void {
        $response = $this->actingAs($user)->postJson(route('equipment.availability'), [
            'facility_id' => $facility->id,
            'dates' => [self::DATE],
            'time_start' => $start,
            'time_end' => $end,
            'exclude_request_id' => $excludeRequestId,
        ]);

        $response->assertOk();

        $row = collect($response->json('dates.'.self::DATE.'.availability'))
            ->firstWhere('equipment_id', $expected['equipment_id'] ?? null)
            ?? collect($response->json('dates.'.self::DATE.'.availability'))->first();

        $this->assertNotNull($row, 'Expected an availability row for the facility equipment.');

        foreach ($expected as $key => $value) {
            $this->assertSame($value, $row[$key], "Unexpected {$key}.");
        }
    }

    public function test_one_request_returns_a_bucket_for_every_requested_date(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $this->equipmentHeldBy($facility, 10);

        $dates = ['2026-11-04', '2026-11-05', '2026-11-06'];

        $response = $this->actingAs($user)->postJson(route('equipment.availability'), [
            'facility_id' => $facility->id,
            'dates' => $dates,
            'time_start' => '09:00',
            'time_end' => '11:00',
        ]);

        $response->assertOk();
        $this->assertSame($dates, array_keys($response->json('dates')));
    }

    /**
     * The composer used to fire one request per date and read only the first for
     * borrowable stock, so a day other than the first went undetected and the
     * rejection only surfaced as a 422 at submit.
     */
    public function test_each_date_carries_its_own_reservations(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $secondDate = '2026-11-05';

        $request = FacilityRequest::factory()->approved()->create(['on_hold' => false]);
        $rf = $request->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => $secondDate,
            'time_start' => '09:00',
            'time_end' => '11:00',
            'status' => RequestStatus::APPROVED,
        ]);

        DB::table('request_equipment')->insert([
            'request_id' => $request->id,
            'request_facility_id' => $rf->id,
            'equipment_id' => $equipment->id,
            'quantity_needed' => 6,
            'is_borrowed' => false,
            'source_facility_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($user)->postJson(route('equipment.availability'), [
            'facility_id' => $facility->id,
            'dates' => [self::DATE, $secondDate],
            'time_start' => '09:00',
            'time_end' => '11:00',
        ]);

        $response->assertOk();

        $first = collect($response->json('dates.'.self::DATE.'.availability'))->first();
        $second = collect($response->json('dates.'.$secondDate.'.availability'))->first();

        $this->assertSame(10, $first['available_quantity']);
        $this->assertSame([], $first['reservations']);

        $this->assertSame(4, $second['available_quantity']);
        $this->assertCount(1, $second['reservations']);
        $this->assertSame($secondDate, $second['reservations'][0]['date']);
    }

    public function test_a_date_with_no_equipment_returns_an_empty_array_rather_than_being_omitted(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $other = Facility::factory()->create();
        $this->equipmentHeldBy($other, 10);

        $response = $this->actingAs($user)->postJson(route('equipment.availability'), [
            'facility_id' => $facility->id,
            'dates' => ['2026-11-04', '2026-11-05'],
            'time_start' => '09:00',
            'time_end' => '11:00',
        ]);

        $response->assertOk();
        $this->assertSame([], $response->json('dates.2026-11-04.availability'));
        $this->assertSame([], $response->json('dates.2026-11-05.availability'));
    }

    public function test_dates_are_required(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();

        $this->actingAs($user)
            ->postJson(route('equipment.availability'), [
                'facility_id' => $facility->id,
                'time_start' => '09:00',
                'time_end' => '11:00',
            ])
            ->assertJsonValidationErrors('dates');
    }
}
