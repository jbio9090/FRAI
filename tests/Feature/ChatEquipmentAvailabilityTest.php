<?php

namespace Tests\Feature;

use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatEquipmentAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_chat_equipment_endpoint_returns_slot_aware_remaining_quantities(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create(['name' => 'MPH Main']);
        $date = '2026-05-10';

        $enoughStock = Equipment::create(['name' => 'Mic Set', 'quantity' => 1000]);
        $partialStock = Equipment::create(['name' => 'Plastic Chair', 'quantity' => 2000]);
        $zeroStock = Equipment::create(['name' => 'Projector', 'quantity' => 400]);

        $enoughStock->facilities()->attach($facility->id, ['quantity' => 100]);
        $partialStock->facilities()->attach($facility->id, ['quantity' => 800]);
        $zeroStock->facilities()->attach($facility->id, ['quantity' => 200]);

        $this->reserveEquipmentForSlot($facility->id, $partialStock->id, 500, $date, '09:00:00', '11:00:00');
        $this->reserveEquipmentForSlot($facility->id, $zeroStock->id, 200, $date, '09:00:00', '11:00:00');

        $response = $this
            ->actingAs($user)
            ->getJson(route('chat.equipment', [
                'facility_id' => $facility->id,
                'date' => $date,
                'time_start' => '09:30',
                'time_end' => '10:30',
            ]));

        $response->assertOk();

        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertSame(100, $rows->get($enoughStock->id)['remaining_quantity']);
        $this->assertSame(0, $rows->get($enoughStock->id)['reserved_quantity']);

        $this->assertSame(300, $rows->get($partialStock->id)['remaining_quantity']);
        $this->assertSame(500, $rows->get($partialStock->id)['reserved_quantity']);

        $this->assertSame(0, $rows->get($zeroStock->id)['remaining_quantity']);
        $this->assertSame(200, $rows->get($zeroStock->id)['reserved_quantity']);
    }

    public function test_chat_request_submission_revalidates_stale_slot_equipment_availability(): void
    {
        $user = User::factory()->create();
        $facility = Facility::factory()->create(['name' => 'MPH Main']);
        $equipment = Equipment::create(['name' => 'Plastic Chair', 'quantity' => 2000]);
        $equipment->facilities()->attach($facility->id, ['quantity' => 800]);

        $date = '2026-05-12';

        // Initial guided fetch sees full stock.
        $availabilityBefore = $this
            ->actingAs($user)
            ->getJson(route('chat.equipment', [
                'facility_id' => $facility->id,
                'date' => $date,
                'time_start' => '09:00',
                'time_end' => '11:00',
            ]));
        $availabilityBefore->assertOk();
        $beforeRows = collect($availabilityBefore->json('data'))->keyBy('id');
        $this->assertSame(800, $beforeRows->get($equipment->id)['remaining_quantity']);

        // Another booking reserves stock before submit.
        $this->reserveEquipmentForSlot($facility->id, $equipment->id, 500, $date, '09:00:00', '11:00:00');

        $payload = [
            'title' => 'Stale Equipment Submission Test',
            'description' => 'Testing stale quantity revalidation',
            'facility_bookings' => [[
                'facility_id' => $facility->id,
                'date' => $date,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [[
                    'equipment_id' => $equipment->id,
                    'quantity_needed' => 400,
                ]],
            ]],
        ];

        $submitResponse = $this
            ->actingAs($user)
            ->postJson(route('api.db.create.request'), $payload);

        $submitResponse
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'facility_bookings.0.equipment.0.quantity_needed',
            ]);

        $errorMessage = implode(' ', $submitResponse->json('errors.facility_bookings.0.equipment.0.quantity_needed'));
        $this->assertStringContainsString('only 300 remaining', $errorMessage);
        $this->assertStringContainsString('Plastic Chair', $errorMessage);
    }

    public function test_chat_equipment_endpoint_returns_borrowable_slot_aware_rows_from_other_facilities(): void
    {
        $user = User::factory()->create();
        $selectedFacility = Facility::factory()->create(['name' => 'MPH Main']);
        $sourceFacility = Facility::factory()->create(['name' => 'Gym']);
        $date = '2026-05-18';

        $ownEquipment = Equipment::create(['name' => 'Own Chairs', 'quantity' => 999]);
        $borrowableEquipment = Equipment::create(['name' => 'Borrow Chairs', 'quantity' => 999]);

        $ownEquipment->facilities()->attach($selectedFacility->id, ['quantity' => 400]);
        $borrowableEquipment->facilities()->attach($sourceFacility->id, ['quantity' => 300]);

        $this->reserveEquipmentForSlot($sourceFacility->id, $borrowableEquipment->id, 250, $date, '09:00:00', '11:00:00');

        $response = $this
            ->actingAs($user)
            ->getJson(route('chat.equipment', [
                'facility_id' => $selectedFacility->id,
                'source' => 'borrow',
                'date' => $date,
                'time_start' => '09:00',
                'time_end' => '11:00',
            ]));

        $response->assertOk();

        $rows = collect($response->json('data'));
        $borrowRow = $rows->firstWhere('id', $borrowableEquipment->id);

        $this->assertNotNull($borrowRow);
        $this->assertSame($sourceFacility->id, $borrowRow['facility_id']);
        $this->assertSame(300, $borrowRow['total_quantity']);
        $this->assertSame(250, $borrowRow['reserved_quantity']);
        $this->assertSame(50, $borrowRow['remaining_quantity']);
        $this->assertNull($rows->firstWhere('id', $ownEquipment->id));
    }

    public function test_chat_request_submission_revalidates_borrowed_equipment_quantities_by_source_facility_slot(): void
    {
        $user = User::factory()->create();
        $selectedFacility = Facility::factory()->create(['name' => 'MPH Main']);
        $sourceFacility = Facility::factory()->create(['name' => 'Gym']);
        $date = '2026-05-20';

        $borrowableEquipment = Equipment::create(['name' => 'Borrowed Projector', 'quantity' => 999]);
        $borrowableEquipment->facilities()->attach($sourceFacility->id, ['quantity' => 300]);

        $this->reserveEquipmentForSlot($sourceFacility->id, $borrowableEquipment->id, 260, $date, '09:00:00', '11:00:00');

        $payload = [
            'title' => 'Borrowed Equipment Revalidation Test',
            'description' => 'Borrow from another facility',
            'facility_bookings' => [[
                'facility_id' => $selectedFacility->id,
                'date' => $date,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [[
                    'equipment_id' => $borrowableEquipment->id,
                    'quantity_needed' => 60,
                    'facility_id' => $sourceFacility->id,
                ]],
            ]],
        ];

        $submitResponse = $this
            ->actingAs($user)
            ->postJson(route('api.db.create.request'), $payload);

        $submitResponse
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'facility_bookings.0.equipment.0.quantity_needed',
            ]);

        $errorMessage = implode(' ', $submitResponse->json('errors.facility_bookings.0.equipment.0.quantity_needed'));
        $this->assertStringContainsString('only 40 remaining', $errorMessage);
        $this->assertStringContainsString('facility ID '.$sourceFacility->id, $errorMessage);
    }

    public function test_chat_request_submission_auto_resolves_borrow_source_when_source_facility_metadata_is_missing(): void
    {
        $user = User::factory()->create();
        $selectedFacility = Facility::factory()->create(['name' => 'MPH Main']);
        $sourceFacility = Facility::factory()->create(['name' => 'Gym']);
        $date = '2026-05-21';

        $borrowableEquipment = Equipment::create(['name' => 'Auto Borrow Chairs', 'quantity' => 999]);
        $borrowableEquipment->facilities()->attach($sourceFacility->id, ['quantity' => 120]);

        $payload = [
            'title' => 'Auto Borrow Source Resolution',
            'description' => 'Borrow source metadata omitted',
            'facility_bookings' => [[
                'facility_id' => $selectedFacility->id,
                'date' => $date,
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [[
                    'equipment_id' => $borrowableEquipment->id,
                    'quantity_needed' => 20,
                ]],
            ]],
        ];

        $submitResponse = $this
            ->actingAs($user)
            ->postJson(route('api.db.create.request'), $payload);

        $submitResponse
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $requestId = (int) $submitResponse->json('request_id');
        $savedRequest = FacilityRequest::query()->with('equipment')->findOrFail($requestId);
        $savedPivot = $savedRequest->equipment->firstWhere('id', $borrowableEquipment->id)?->pivot;

        $this->assertNotNull($savedPivot);
        $this->assertTrue((bool) $savedPivot->is_borrowed);
        $this->assertSame($sourceFacility->id, (int) $savedPivot->source_facility_id);
    }

    private function reserveEquipmentForSlot(
        int $facilityId,
        int $equipmentId,
        int $quantity,
        string $date,
        string $timeStart,
        string $timeEnd
    ): void {
        $request = FacilityRequest::factory()->approved()->create([
            'on_hold' => false,
        ]);

        $request->requestFacilities()->create([
            'facility_id' => $facilityId,
            'date_requested' => $date,
            'time_start' => $timeStart,
            'time_end' => $timeEnd,
        ]);

        $request->equipment()->attach($equipmentId, [
            'quantity_needed' => $quantity,
            'is_borrowed' => false,
            'source_facility_id' => null,
        ]);
    }
}
