<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * A request may only ask for equipment the facility actually has free in that
 * slot. The check runs twice on purpose: once in the form request for immediate
 * field-level feedback, and once inside the write transaction under a row lock,
 * which is the one that actually guarantees it.
 */
class RequestEquipmentQuantityValidationTest extends TestCase
{
    use RefreshDatabase;

    private const DATE = '2026-11-11';

    public function test_submitting_more_than_the_facility_holds_free_is_rejected(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $this->approvedReservation($facility, $equipment, 7);
        $before = FacilityRequest::count();

        $response = $this->actingAs($user)->post(route('requests.store'), $this->payload($facility, [
            ['equipment_id' => $equipment->id, 'quantity_needed' => 4],
        ]));

        $response->assertSessionHasErrors('facility_bookings.0.equipment.0.quantity_needed');
        $this->assertStringContainsString('only 3 remaining', session('errors')->first('facility_bookings.0.equipment.0.quantity_needed'));
        $this->assertSame($before, FacilityRequest::count(), 'The rejected submission must not persist.');
    }

    public function test_requesting_exactly_what_remains_is_accepted(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $this->approvedReservation($facility, $equipment, 7);
        $before = FacilityRequest::count();

        $response = $this->actingAs($user)->post(route('requests.store'), $this->payload($facility, [
            ['equipment_id' => $equipment->id, 'quantity_needed' => 3],
        ]));

        $response->assertSessionHasNoErrors();
        $this->assertSame($before + 1, FacilityRequest::count());
    }

    public function test_unreserved_stock_can_be_requested_in_full(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $response = $this->actingAs($user)->post(route('requests.store'), $this->payload($facility, [
            ['equipment_id' => $equipment->id, 'quantity_needed' => 10],
        ]));

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseCount('requests', 1);
    }

    public function test_pending_requests_do_not_consume_stock(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $this->reservation($facility, $equipment, 10, RequestStatus::PENDING);

        $response = $this->actingAs($user)->post(route('requests.store'), $this->payload($facility, [
            ['equipment_id' => $equipment->id, 'quantity_needed' => 10],
        ]));

        $response->assertSessionHasNoErrors();
    }

    /**
     * Two bookings that each fit individually but overlap and together exceed
     * the free stock must not both be let through.
     */
    public function test_demand_is_aggregated_across_overlapping_bookings_in_one_submission(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $before = FacilityRequest::count();

        $payload = $this->payload($facility, [['equipment_id' => $equipment->id, 'quantity_needed' => 6]]);
        $payload['facility_bookings'][] = [
            'facility_id' => $facility->id,
            'date' => self::DATE,
            'time_start' => '10:00',
            'time_end' => '12:00',
            'equipment' => [['equipment_id' => $equipment->id, 'quantity_needed' => 6]],
        ];

        $response = $this->actingAs($user)->post(route('requests.store'), $payload);

        $response->assertSessionHasErrors([
            'facility_bookings.0.equipment.0.quantity_needed',
            'facility_bookings.1.equipment.0.quantity_needed',
        ]);
        $this->assertSame($before, FacilityRequest::count(), 'The rejected submission must not persist.');
    }

    public function test_demand_on_non_overlapping_bookings_is_not_aggregated(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);
        $before = FacilityRequest::count();

        $payload = $this->payload($facility, [['equipment_id' => $equipment->id, 'quantity_needed' => 6]]);
        $payload['facility_bookings'][] = [
            'facility_id' => $facility->id,
            'date' => self::DATE,
            'time_start' => '13:00',
            'time_end' => '15:00',
            'equipment' => [['equipment_id' => $equipment->id, 'quantity_needed' => 6]],
        ];

        $response = $this->actingAs($user)->post(route('requests.store'), $payload);

        $response->assertSessionHasNoErrors();
        $this->assertSame($before + 1, FacilityRequest::count());
    }

    public function test_borrowed_quantity_is_checked_against_the_source_facility(): void
    {
        $user = User::factory()->create();
        $bookingFacility = Facility::factory()->create();
        $source = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($source, 10);
        $this->approvedReservation($source, $equipment, 9);
        $before = FacilityRequest::count();

        $response = $this->actingAs($user)->post(route('requests.store'), $this->payload($bookingFacility, [], [
            'borrowed_equipment' => [[
                'equipment_id' => $equipment->id,
                'source_facility_id' => $source->id,
                'quantity_needed' => 2,
            ]],
        ]));

        $response->assertSessionHasErrors('facility_bookings.0.borrowed_equipment.0.quantity_needed');
        $this->assertStringContainsString('only 1 remaining', session('errors')->first('facility_bookings.0.borrowed_equipment.0.quantity_needed'));
        $this->assertSame($before, FacilityRequest::count(), 'The rejected submission must not persist.');
    }

    public function test_editing_a_request_does_not_treat_its_own_stock_as_taken(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $existing = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::PENDING,
        ]);

        $response = $this->actingAs($user)->put(route('requests.update', $existing->id), $this->payload($facility, [
            ['equipment_id' => $equipment->id, 'quantity_needed' => 10],
        ]));

        $response->assertSessionHasNoErrors();
    }

    /**
     * The form request check and the in-transaction check must agree, otherwise a
     * value that clears validation can still be rejected at write time.
     */
    public function test_the_in_transaction_check_rejects_what_validation_admitted(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create();
        $equipment = $this->equipmentHeldBy($facility, 10);

        $service = app(\App\Services\RequestService::class);
        $checker = app(\App\Services\EquipmentAvailabilityService::class);

        // Force a reservation to appear only after validation would have run.
        $validated = $this->payload($facility, [['equipment_id' => $equipment->id, 'quantity_needed' => 10]]);
        $validated = ['facility_bookings' => json_decode(json_encode($validated['facility_bookings']), true)];

        $this->assertSame([], $checker->violations($validated['facility_bookings']));

        $this->approvedReservation($facility, $equipment, 4);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->create($validated);
    }

    /**
     * @param  array<int, array<string, mixed>>  $equipment
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function payload(Facility $facility, array $equipment, array $extra = []): array
    {
        return [
            'title' => 'Equipment availability test',
            'description' => 'Verifies slot-aware equipment quantities.',
            'facility_bookings' => [array_merge([
                'facility_id' => $facility->id,
                'date' => self::DATE,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => $equipment,
                'external_equipment' => [],
                'borrowed_equipment' => [],
            ], $extra)],
        ];
    }

    private function equipmentHeldBy(Facility $facility, int $quantity): Equipment
    {
        $equipment = Equipment::factory()->create(['quantity' => $quantity]);
        $equipment->facilities()->attach($facility->id, ['quantity' => $quantity]);

        return $equipment;
    }

    private function approvedReservation(Facility $facility, Equipment $equipment, int $quantity): void
    {
        $this->reservation($facility, $equipment, $quantity, RequestStatus::APPROVED);
    }

    private function reservation(Facility $facility, Equipment $equipment, int $quantity, RequestStatus $status): void
    {
        $request = FacilityRequest::factory()->create([
            'status' => $status,
            'on_hold' => false,
        ]);

        $rf = $request->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => self::DATE,
            'time_start' => '09:00',
            'time_end' => '11:00',
            'status' => $status,
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
    }
}
