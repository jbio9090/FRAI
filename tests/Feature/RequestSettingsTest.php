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

    public function test_page_requires_manage_request_options_permission(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('request-settings'))
            ->assertForbidden();

        $this->actingAs($user)
            ->post(route('request-settings.update'), $this->validPayload())
            ->assertForbidden();
    }

    public function test_admin_can_view_request_settings_page(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $this->get(route('request-settings'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('settings/request-options'));
    }

    public function test_admin_can_update_request_settings(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $payload = $this->validPayload();
        $payload['approvers'] = ['Faculty', 'Registrar', 'OSA'];
        $payload['booking_window'] = [
            'start_time' => '08:00',
            'end_time' => '17:00',
            'days_of_week' => [1, 2, 3, 4, 5],
            'step_minutes' => 60,
        ];
        $payload['min_advance_days'] = 3;

        $this->post(route('request-settings.update'), $payload)
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(['Faculty', 'Registrar', 'OSA'], RequestSettingsService::approvers());
        $this->assertSame('08:00', RequestSettingsService::bookingWindow()['start_time']);
        $this->assertSame('17:00', RequestSettingsService::bookingWindow()['end_time']);
        $this->assertSame([1, 2, 3, 4, 5], RequestSettingsService::bookingWindow()['days_of_week']);
        $this->assertSame(60, RequestSettingsService::bookingWindow()['step_minutes']);
        $this->assertSame(3, RequestSettingsService::minAdvanceDays());
    }

    public function test_update_rejects_invalid_step_and_empty_approvers(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $payload = $this->validPayload();
        $payload['approvers'] = [];
        $payload['booking_window']['step_minutes'] = 45;

        $this->post(route('request-settings.update'), $payload)
            ->assertSessionHasErrors(['approvers', 'booking_window.step_minutes']);
    }

    public function test_update_rejects_end_time_before_start_time(): void
    {
        $this->actingAsRequestSettingsAdmin();

        $payload = $this->validPayload();
        $payload['booking_window']['start_time'] = '20:00';
        $payload['booking_window']['end_time'] = '08:00';

        $this->post(route('request-settings.update'), $payload)
            ->assertSessionHasErrors(['booking_window.end_time']);
    }

    private function validPayload(): array
    {
        return [
            'approvers' => ['Faculty', 'College Dean'],
            'booking_window' => [
                'start_time' => '07:00',
                'end_time' => '20:00',
                'days_of_week' => [0, 1, 2, 3, 4, 5, 6],
                'step_minutes' => 30,
            ],
            'min_advance_days' => 5,
        ];
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
