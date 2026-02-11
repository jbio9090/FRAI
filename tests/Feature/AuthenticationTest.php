<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_login_page()
    {
        $response = $this->get(route('login.show'));

        $response->assertOk();
        $response->assertInertia(
            fn(Assert $page) => $page
                ->component('login') // Your Inertia component name
        );
    }

    public function test_user_can_login_with_valid_credentials()
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123')
        ]);

        $response = $this->post(route('login'), [
            'email' => 'test@example.com',
            'password' => 'password123'
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($user);
    }

    public function test_guest_redirects_to_login()
    {
        $response = $this->get(route('dashboard'));

        $response->assertRedirect(route('login.show'));
    }

    public function test_authenticated_user_sees_dashboard()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->get(route('dashboard'));

        $response->assertInertia(
            fn(Assert $page) => $page
                ->component('dashboard')
                ->has('auth.user')
                ->where('auth.user.email', $user->email)
        );
    }
}
