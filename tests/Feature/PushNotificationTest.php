<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_subscribe_registers_active_token(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson(route('notification.subscribe'), ['token' => 'web-token-123', 'platform' => 'web'])
            ->assertOk()
            ->assertJson(['active' => true]);

        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $user->id,
            'token' => 'web-token-123',
            'is_active' => true,
        ]);
    }

    public function test_subscribe_reactivates_previously_unsubscribed_token(): void
    {
        $user = User::factory()->create();
        $user->registerFcmToken('web-token-123');
        $user->removeFcmToken('web-token-123');

        $this->actingAs($user)
            ->postJson(route('notification.subscribe'), ['token' => 'web-token-123', 'platform' => 'web'])
            ->assertOk();

        $this->assertTrue($user->fcmTokens()->where('token', 'web-token-123')->first()->is_active);
    }

    public function test_unsubscribe_deactivates_only_matching_token(): void
    {
        $user = User::factory()->create();
        $user->registerFcmToken('token-a');
        $user->registerFcmToken('token-b');

        $this->actingAs($user)
            ->postJson(route('notification.unsubscribe'), ['token' => 'token-a'])
            ->assertOk()
            ->assertJson(['active' => false]);

        $this->assertFalse($user->fcmTokens()->where('token', 'token-a')->first()->is_active);
        $this->assertTrue($user->fcmTokens()->where('token', 'token-b')->first()->is_active);
        $this->assertSame(['token-b'], $user->routeNotificationForFcm());
    }

    public function test_status_reflects_per_device_server_truth(): void
    {
        $user = User::factory()->create();
        $user->registerFcmToken('active-token');

        $this->actingAs($user)
            ->postJson(route('notification.status'), ['token' => 'active-token'])
            ->assertOk()
            ->assertJson(['active' => true]);

        $user->removeFcmToken('active-token');

        $this->actingAs($user)
            ->postJson(route('notification.status'), ['token' => 'active-token'])
            ->assertOk()
            ->assertJson(['active' => false]);

        $this->actingAs($user)
            ->postJson(route('notification.status'), ['token' => 'unknown-token'])
            ->assertOk()
            ->assertJson(['active' => false]);
    }

    public function test_status_does_not_leak_other_users_tokens(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $owner->registerFcmToken('owner-token');

        $this->actingAs($other)
            ->postJson(route('notification.status'), ['token' => 'owner-token'])
            ->assertOk()
            ->assertJson(['active' => false]);
    }

    public function test_push_endpoints_require_token(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('notification.subscribe'), [])->assertUnprocessable();
        $this->actingAs($user)->postJson(route('notification.unsubscribe'), [])->assertUnprocessable();
        $this->actingAs($user)->postJson(route('notification.status'), [])->assertUnprocessable();
    }

    public function test_push_endpoints_require_authentication(): void
    {
        $this->postJson(route('notification.subscribe'), ['token' => 'x'])->assertUnauthorized();
        $this->postJson(route('notification.unsubscribe'), ['token' => 'x'])->assertUnauthorized();
        $this->postJson(route('notification.status'), ['token' => 'x'])->assertUnauthorized();
    }

    public function test_sw_config_is_public_javascript_mirroring_firebase_config(): void
    {
        config()->set('services.firebase.project_id', 'test-project-123');

        $response = $this->get(route('notification.sw-config'));

        $response->assertOk();
        $this->assertStringContainsString('application/javascript', $response->headers->get('Content-Type'));
        $response->assertSee('self.__FIREBASE_CONFIG', false);
        $response->assertSee('test-project-123', false);
    }
}
