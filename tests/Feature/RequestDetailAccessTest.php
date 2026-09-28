<?php

namespace Tests\Feature;

use App\Models\Request as FacilityRequest;
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
}
