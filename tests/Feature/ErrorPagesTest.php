<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ErrorPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_renders_inertia_page_for_unknown_route_outside_local_and_testing()
    {
        app()->detectEnvironment(fn () => 'production');

        $response = $this->get('/definitely-missing-page-xyz');

        $response->assertStatus(404);
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Errors/Error')
                ->where('status', 404)
                // Unknown URLs match no route, so the `web` middleware (and its
                // shared `auth` prop) never runs — the page falls back to login.
                ->missing('auth')
        );
    }

    public function test_renders_inertia_page_for_forbidden_response_outside_local_and_testing()
    {
        Route::middleware('web')->get('/_test-forbidden', fn () => abort(403));

        app()->detectEnvironment(fn () => 'production');

        $user = User::factory()->create();
        $response = $this->actingAs($user)->get('/_test-forbidden');

        $response->assertStatus(403);
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Errors/Error')
                ->where('status', 403)
                ->where('auth.user.id', $user->id)
        );
    }

    public function test_dev_preview_renders_error_page()
    {
        $response = $this->get(route('dev.error', ['code' => 404]));

        $response->assertStatus(404);
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Errors/Error')
                ->where('status', 404)
        );
    }

    public function test_dev_preview_rejects_unknown_code()
    {
        $this->get('/dev/error/500')->assertStatus(404);
    }
}
