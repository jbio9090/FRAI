<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RolePermissionSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_roles_and_permissions_without_account_seeds(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $this->assertDatabaseHas('roles', ['name' => 'Super Admin']);
        $this->assertDatabaseHas('permissions', ['name' => 'approve requests']);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_it_creates_demo_accounts_when_account_seeds_are_enabled(): void
    {
        config(['seed.create_account_seeds' => true]);

        $this->seed(RolePermissionSeeder::class);

        $this->assertDatabaseHas('users', ['email' => 'gso@example.com']);
        $this->assertTrue(User::where('email', 'gso@example.com')->firstOrFail()->hasRole('Super Admin'));
        $this->assertDatabaseHas('users', ['email' => 'admin@example.com']);
        $this->assertTrue(User::where('email', 'admin@example.com')->firstOrFail()->hasRole('admin'));
        $this->assertDatabaseHas('users', ['email' => 'user@example.com']);
        $this->assertTrue(User::where('email', 'user@example.com')->firstOrFail()->hasRole('Administrative Staff'));
    }

    public function test_super_admin_role_is_created_before_accounts_are_skipped(): void
    {
        $this->assertDatabaseCount('roles', 0);

        $this->seed(RolePermissionSeeder::class);

        $this->assertSame(3, Role::count());
    }
}
