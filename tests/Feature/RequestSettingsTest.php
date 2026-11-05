<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\RequestSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class RequestSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_requires_manage_request_options_permission(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('settings.request.approvers.add'), ['approver' => 'Registrar'])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.approvers.remove'), ['approver' => 'Faculty'])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.booking-window.start-time'), ['start_time' => '08:00'])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.booking-window.end-time'), ['end_time' => '17:00'])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.booking-window.step-minutes'), ['step_minutes' => 60])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.booking-window.days-of-week.toggle'), ['day' => 1])
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('settings.request.min-advance-days'), ['min_advance_days' => 3])
            ->assertForbidden();
    }

    public function test_admin_can_add_approver(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.approvers.add'), ['approver' => 'Registrar'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertContains('Registrar', RequestSettingsService::approvers());
    }

    public function test_admin_can_remove_approver(): void
    {
        $this->actingAsRequestSettingsAdmin();

        RequestSettingsService::update(['request.approvers' => ['Faculty', 'Registrar', 'OSA']]);

        $this->post(route('settings.request.approvers.remove'), ['approver' => 'Registrar'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNotContains('Registrar', RequestSettingsService::approvers());
        $this->assertContains('Faculty', RequestSettingsService::approvers());
        $this->assertContains('OSA', RequestSettingsService::approvers());
    }

    public function test_admin_cannot_add_duplicate_approver(): void
    {
        $this->actingAsRequestSettingsAdmin();

        RequestSettingsService::update(['request.approvers' => ['Faculty', 'Registrar']]);

        $this->post(route('settings.request.approvers.add'), ['approver' => 'Faculty'])
            ->assertSessionHasErrors(['approver']);
    }

    public function test_admin_can_update_start_time(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.booking-window.start-time'), ['start_time' => '08:00'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('08:00', RequestSettingsService::bookingWindow()['start_time']);
    }

    public function test_admin_can_update_end_time(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.booking-window.end-time'), ['end_time' => '17:00'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame('17:00', RequestSettingsService::bookingWindow()['end_time']);
    }

    public function test_admin_cannot_set_end_time_before_start_time(): void
    {
        $this->actingAsRequestSettingsAdmin();

        RequestSettingsService::update(['request.booking_window' => [
            'start_time' => '10:00',
            'end_time' => '18:00',
            'days_of_week' => [1, 2, 3, 4, 5],
            'step_minutes' => 30,
        ]]);

        $this->post(route('settings.request.booking-window.end-time'), ['end_time' => '08:00'])
            ->assertSessionHasErrors(['end_time']);
    }

    public function test_admin_can_update_step_minutes(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.booking-window.step-minutes'), ['step_minutes' => 60])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(60, RequestSettingsService::bookingWindow()['step_minutes']);
    }

    public function test_admin_can_toggle_day(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.booking-window.days-of-week.toggle'), ['day' => 0])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNotContains(0, RequestSettingsService::bookingWindow()['days_of_week']);

        // Toggle it back on
        $this->post(route('settings.request.booking-window.days-of-week.toggle'), ['day' => 0])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertContains(0, RequestSettingsService::bookingWindow()['days_of_week']);
    }

    public function test_admin_can_update_min_advance_days(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->post(route('settings.request.min-advance-days'), ['min_advance_days' => 3])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(3, RequestSettingsService::minAdvanceDays());
    }

    private function actingAsRequestSettingsAdmin(): User
    {
        Permission::findOrCreate('manage request options');

        $user = User::factory()->create();
        $user->givePermissionTo('manage request options');
        $this->actingAs($user);

        return $user;
    }
}
