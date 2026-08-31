<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use App\Services\AlternativeRecommendationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlternativeRecommendationServiceTest extends TestCase
{
    use RefreshDatabase;

    private function buildRequest(User $user, string $timeStart, string $timeEnd): FacilityRequest
    {
        $facility = Facility::factory()->create(['capacity' => 100]);

        $request = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::FOR_RESCHEDULE,
        ]);

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => Carbon::today()->addDays(1)->format('Y-m-d'),
            'time_start' => "{$timeStart}:00",
            'time_end' => "{$timeEnd}:00",
            'expected_capacity' => 10,
        ]);

        return $request;
    }

    public function test_returned_alternative_time_slots_match_original_request_duration(): void
    {
        $user = User::factory()->create();
        $request = $this->buildRequest($user, '09:00', '11:00');

        $this->actingAs($user);

        $response = $this->getJson(route('requests.alternatives', $request->id));
        $response->assertOk();

        $alternatives = $response->json('alternatives');
        $facilitySlot = collect($alternatives)->flatten(1)->firstWhere('type', 'same_facility_time');

        $this->assertNotNull($facilitySlot, 'Expected a same_facility_time alternative to be generated.');

        $slots = collect($alternatives)->flatten(1)->where('type', 'same_facility_time');

        foreach ($slots as $slot) {
            $duration = (int) Carbon::parse($slot['time_start'])->diffInMinutes(Carbon::parse($slot['time_end']));
            $this->assertSame(120, $duration, "Alternative slot duration must match the original 2-hour booking.");
        }
    }

    public function test_generate_time_slots_uses_original_duration(): void
    {
        $service = app(AlternativeRecommendationService::class);

        $generateTimeSlots = new \ReflectionMethod($service, 'generateTimeSlots');
        $generateTimeSlots->setAccessible(true);

        $slots = $generateTimeSlots->invoke($service, '2026-08-01', [
            'start_time' => '07:00',
            'end_time' => '20:00',
            'step_minutes' => 30,
        ], 120);

        $this->assertNotEmpty($slots);

        // All candidate slots must span exactly 2 hours.
        foreach ($slots as $slot) {
            $duration = (int) Carbon::parse($slot['start'])->diffInMinutes(Carbon::parse($slot['end']));
            $this->assertSame(120, $duration);
        }

        // No slot may spill past the end time.
        foreach ($slots as $slot) {
            $this->assertTrue($slot['end'] <= '20:00', "Slot end {$slot['end']} must not exceed 20:00.");
        }

        // First slot starts at the booking window start.
        $this->assertSame('07:00', $slots[0]['start']);
        $this->assertSame('09:00', $slots[0]['end']);

        // Step of 30 minutes between starts.
        $this->assertSame('07:30', $slots[1]['start']);
    }
}
