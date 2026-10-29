<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpireOverdueRequestsTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-expire-token';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.expire_requests.token' => self::TOKEN]);
    }

    private function makeFacility(): Facility
    {
        return Facility::factory()->create();
    }

    public function test_expires_past_due_facility_and_parent_request(): void
    {
        $user = User::factory()->create();

        $request = FacilityRequest::factory()->pending()->create(['user_id' => $user->id]);
        $pastDate = now()->subDay()->toDateString();

        $facility = $this->makeFacility();

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => $pastDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        $response = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));

        $response->assertOk();
        $response->assertJson([
            'expired_facilities' => 1,
            'expired_requests' => 1,
        ]);

        $this->assertDatabaseHas('request_facilities', [
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::EXPIRED->value,
        ]);
        $this->assertNotNull(RequestFacility::where('request_id', $request->id)
            ->where('facility_id', $facility->id)
            ->first()->expired_at);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => RequestStatus::EXPIRED->value,
        ]);
        $this->assertNotNull($request->fresh()->expired_at);
    }

    public function test_does_not_expire_future_dated_facility(): void
    {
        $user = User::factory()->create();

        $request = FacilityRequest::factory()->pending()->create(['user_id' => $user->id]);
        $futureDate = now()->addDay()->toDateString();

        $facility = $this->makeFacility();

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => $futureDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        $response = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));

        $response->assertOk();
        $response->assertJson([
            'expired_facilities' => 0,
            'expired_requests' => 0,
        ]);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => RequestStatus::PENDING->value,
        ]);
    }

    public function test_expires_only_past_due_facilities_keeps_parent_pending(): void
    {
        $user = User::factory()->create();

        $request = FacilityRequest::factory()->pending()->create(['user_id' => $user->id]);
        $pastDate = now()->subDay()->toDateString();
        $futureDate = now()->addDay()->toDateString();

        $pastFacility = $this->makeFacility();
        $futureFacility = $this->makeFacility();

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $pastFacility->id,
            'date_requested' => $pastDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $futureFacility->id,
            'date_requested' => $futureDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        $response = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));

        $response->assertOk();
        $response->assertJson([
            'expired_facilities' => 1,
            'expired_requests' => 0,
        ]);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => RequestStatus::PENDING->value,
        ]);
    }

    public function test_returns_401_without_token(): void
    {
        $response = $this->post(route('requests.expire-overdue'));

        $response->assertUnauthorized();
    }

    public function test_returns_401_with_wrong_token(): void
    {
        $response = $this->withHeader('X-Expire-Requests-Token', 'wrong-token')
            ->post(route('requests.expire-overdue'));

        $response->assertUnauthorized();
    }

    public function test_is_idempotent(): void
    {
        $user = User::factory()->create();

        $request = FacilityRequest::factory()->pending()->create(['user_id' => $user->id]);
        $pastDate = now()->subDay()->toDateString();

        $facility = $this->makeFacility();

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => $pastDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::PENDING,
        ]);

        $first = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));
        $first->assertOk();
        $first->assertJson(['expired_requests' => 1]);

        $second = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));
        $second->assertOk();
        $second->assertJson(['expired_requests' => 0]);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => RequestStatus::EXPIRED->value,
        ]);
    }

    public function test_skips_already_expired_request_and_facility(): void
    {
        $user = User::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $user->id,
            'status' => RequestStatus::EXPIRED,
            'expired_at' => now()->subDay(),
        ]);

        $facility = $this->makeFacility();
        $pastDate = now()->subDay()->toDateString();

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'date_requested' => $pastDate,
            'time_start' => '09:00:00',
            'time_end' => '10:00:00',
            'status' => RequestStatus::EXPIRED,
            'expired_at' => now()->subDay(),
        ]);

        $response = $this->withHeader('X-Expire-Requests-Token', self::TOKEN)
            ->post(route('requests.expire-overdue'));

        $response->assertOk();
        $response->assertJson([
            'expired_facilities' => 0,
            'expired_requests' => 0,
        ]);

        $this->assertDatabaseHas('requests', [
            'id' => $request->id,
            'status' => RequestStatus::EXPIRED->value,
        ]);
    }
}
