<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RequestDetailAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_requester_can_view_their_own_request(): void
    {
        $owner = User::factory()->create();
        $request = FacilityRequest::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($owner)
            ->get(route('requests.detail', $request->id))
            ->assertOk();
    }

    public function test_requester_is_forbidden_from_another_users_request(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $request = FacilityRequest::factory()->create(['user_id' => $owner->id]);

        $this->actingAs($other)
            ->get(route('requests.detail', $request->id))
            ->assertForbidden();
    }

    public function test_admin_and_super_admin_can_view_any_request(): void
    {
        $owner = User::factory()->create();
        $request = FacilityRequest::factory()->create(['user_id' => $owner->id]);

        foreach (['admin', 'Super Admin'] as $roleName) {
            $role = Role::findOrCreate($roleName);
            $viewer = User::factory()->create();
            $viewer->assignRole($role);

            $this->actingAs($viewer)
                ->get(route('requests.detail', $request->id))
                ->assertOk();

            $role->delete();
        }
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $request = FacilityRequest::factory()->create();

        $this->get(route('requests.detail', $request->id))
            ->assertRedirect(route('login.show'));
    }

    public function test_preview_returns_limited_data_for_approved_request(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $facility = Facility::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::APPROVED,
            'date_requested' => now()->format('Y-m-d'),
            'time_start' => '10:00',
            'time_end' => '12:00',
        ]);

        $this->actingAs($viewer)
            ->get(route('requests.preview', $request->id))
            ->assertOk()
            ->assertJsonStructure([
                'id',
                'title',
                'status',
                'requester',
                'can_view_full',
                'facilities' => [
                    '*' => ['facility_name', 'building', 'date', 'time_start', 'time_end'],
                ],
            ])
            ->assertJson([
                'requester' => 'Another User',
                'can_view_full' => false,
                'status' => 'Approved',
            ]);
    }

    public function test_preview_shows_requester_name_for_owner(): void
    {
        $owner = User::factory()->create(['name' => 'John Doe']);
        $facility = Facility::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::APPROVED,
            'date_requested' => now()->format('Y-m-d'),
            'time_start' => '10:00',
            'time_end' => '12:00',
        ]);

        $this->actingAs($owner)
            ->get(route('requests.preview', $request->id))
            ->assertOk()
            ->assertJson([
                'requester' => 'John Doe',
                'can_view_full' => true,
            ]);
    }

    public function test_preview_shows_requester_name_for_admin(): void
    {
        $owner = User::factory()->create(['name' => 'Jane Smith']);
        $facility = Facility::factory()->create();
        $role = Role::findOrCreate('admin');

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::APPROVED,
        ]);

        RequestFacility::create([
            'request_id' => $request->id,
            'facility_id' => $facility->id,
            'status' => RequestStatus::APPROVED,
            'date_requested' => now()->format('Y-m-d'),
            'time_start' => '10:00',
            'time_end' => '12:00',
        ]);

        $admin = User::factory()->create();
        $admin->assignRole($role);

        $this->actingAs($admin)
            ->get(route('requests.preview', $request->id))
            ->assertOk()
            ->assertJson([
                'requester' => 'Jane Smith',
                'can_view_full' => true,
            ]);

        $role->delete();
    }

    public function test_preview_returns_404_for_pending_request(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::PENDING,
        ]);

        $this->actingAs($viewer)
            ->get(route('requests.preview', $request->id))
            ->assertNotFound();
    }

    public function test_preview_returns_404_for_denied_request(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::DENIED,
        ]);

        $this->actingAs($viewer)
            ->get(route('requests.preview', $request->id))
            ->assertNotFound();
    }

    public function test_preview_returns_404_for_for_reschedule_request(): void
    {
        $owner = User::factory()->create();
        $viewer = User::factory()->create();

        $request = FacilityRequest::factory()->create([
            'user_id' => $owner->id,
            'status' => RequestStatus::FOR_RESCHEDULE,
        ]);

        $this->actingAs($viewer)
            ->get(route('requests.preview', $request->id))
            ->assertNotFound();
    }
}
