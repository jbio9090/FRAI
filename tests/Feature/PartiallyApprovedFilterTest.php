<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Request as FacilityRequest;
use App\Models\User;
use App\Services\RequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartiallyApprovedFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_try_from_filter_accepts_name_and_value(): void
    {
        $this->assertSame(RequestStatus::PARTIALLY_APPROVED, RequestStatus::tryFromFilter('partially_approved'));
        $this->assertSame(RequestStatus::PARTIALLY_APPROVED, RequestStatus::tryFromFilter('Partially Approved'));
        $this->assertSame(RequestStatus::PARTIALLY_APPROVED, RequestStatus::tryFromFilter('PARTIALLY_APPROVED'));
        $this->assertSame(RequestStatus::CONDITIONALLY_APPROVED, RequestStatus::tryFromFilter('Conditionally Approved'));
        $this->assertSame(RequestStatus::FOR_RESCHEDULE, RequestStatus::tryFromFilter('for_reschedule'));
        $this->assertNull(RequestStatus::tryFromFilter('not_a_status'));
    }

    public function test_request_list_filters_partially_approved(): void
    {
        $owner = User::factory()->create();

        $partial = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
        ]);
        $pending = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PENDING,
        ]);

        $this->actingAs($owner);

        $service = app(RequestService::class);
        $statuses = collect(['partially_approved'])
            ->map(fn ($s) => RequestStatus::tryFromFilter($s))
            ->filter()
            ->values()
            ->all();

        $result = $service->get($statuses, 'all');
        $ids = $result->pluck('id');

        $this->assertTrue($ids->contains($partial->id));
        $this->assertFalse($ids->contains($pending->id));
    }

    public function test_account_detail_filters_partially_approved_and_exposes_option(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(\Spatie\Permission\Models\Permission::findOrCreate('manage users'));

        $partial = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PARTIALLY_APPROVED,
        ]);
        $pending = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PENDING,
        ]);

        $this->actingAs($owner);

        $service = app(RequestService::class);

        // Legacy display value (with space) must still resolve.
        $legacy = collect(['Partially Approved'])
            ->map(fn ($s) => RequestStatus::tryFromFilter($s))
            ->filter()
            ->values()
            ->all();

        $result = $service->getForUser($owner->id, $legacy, 'all');
        $ids = $result->pluck('id');

        $this->assertTrue($ids->contains($partial->id));
        $this->assertFalse($ids->contains($pending->id));

        $response = $this->actingAs($owner)->get(route('accounts.show', $owner->id));
        $response->assertOk();

        $props = $response->viewData('page')['props'] ?? [];
        $values = collect($props['request_statuses'] ?? [])->pluck('value')->all();
        $this->assertContains('partially_approved', $values);
    }
}
