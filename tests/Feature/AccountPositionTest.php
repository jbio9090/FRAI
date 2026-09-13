<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AccountPositionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // AccountController uses PostgreSQL-specific ILIKE for role lookups,
        // which sqlite cannot parse. These endpoint tests require pgsql.
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Requires PostgreSQL (AccountController uses ILIKE).');
        }
    }

    private function superAdmin(): User
    {
        Role::findOrCreate('Super Admin')->givePermissionTo(Permission::findOrCreate('manage users'));
        Role::findOrCreate('admin');
        Role::findOrCreate('Administrative Staff');

        $admin = User::factory()->create();
        $admin->assignRole('Super Admin');
        $admin->givePermissionTo('manage users');

        return $admin;
    }

    public function test_store_persists_position(): void
    {
        $admin = $this->superAdmin();

        $response = $this->actingAs($admin)->post(route('accounts.store'), [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'role' => 'admin',
            'position' => 'Registrar Clerk',
        ]);

        $response->assertRedirect(route('accounts.index'));
        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
            'position' => 'Registrar Clerk',
        ]);
    }

    public function test_store_normalizes_blank_position_to_null(): void
    {
        $admin = $this->superAdmin();

        $response = $this->actingAs($admin)->post(route('accounts.store'), [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'role' => 'admin',
            'position' => '   ',
        ]);

        $response->assertRedirect(route('accounts.index'));
        $this->assertDatabaseHas('users', [
            'email' => 'john@example.com',
            'position' => null,
        ]);
    }

    public function test_store_rejects_position_over_100_characters(): void
    {
        $admin = $this->superAdmin();

        $response = $this->actingAs($admin)
            ->from(route('accounts.index'))
            ->post(route('accounts.store'), [
                'name' => 'Jane Doe',
                'email' => 'jane@example.com',
                'role' => 'admin',
                'position' => str_repeat('a', 101),
            ]);

        $response->assertSessionHasErrors('position');
        $this->assertDatabaseMissing('users', ['email' => 'jane@example.com']);
    }

    public function test_update_persists_position(): void
    {
        $admin = $this->superAdmin();
        $target = User::factory()->create(['position' => null]);
        $target->assignRole('Administrative Staff');

        $response = $this->actingAs($admin)->put(route('accounts.update', $target), [
            'name' => $target->name,
            'email' => $target->email,
            'role' => 'administrative staff',
            'position' => 'Records Officer',
        ]);

        $response->assertRedirect(route('accounts.index'));
        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'position' => 'Records Officer',
        ]);
    }

    public function test_batch_store_persists_position(): void
    {
        $admin = $this->superAdmin();

        $response = $this->actingAs($admin)->post(route('accounts.batch-store'), [
            'accounts' => [
                ['name' => 'Batch One', 'email' => 'batch1@example.com', 'role' => 'admin', 'position' => 'Registrar Clerk'],
                ['name' => 'Batch Two', 'email' => 'batch2@example.com', 'role' => 'admin'],
            ],
        ]);

        $response->assertRedirect(route('accounts.index'));
        $this->assertDatabaseHas('users', [
            'email' => 'batch1@example.com',
            'position' => 'Registrar Clerk',
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'batch2@example.com',
            'position' => null,
        ]);
    }

    public function test_batch_store_rejects_position_over_100_characters(): void
    {
        $admin = $this->superAdmin();

        $response = $this->actingAs($admin)
            ->from(route('accounts.index'))
            ->post(route('accounts.batch-store'), [
                'accounts' => [
                    ['name' => 'Batch One', 'email' => 'batch1@example.com', 'role' => 'admin', 'position' => str_repeat('a', 101)],
                ],
            ]);

        $response->assertSessionHasErrors('accounts.0.position');
        $this->assertDatabaseMissing('users', ['email' => 'batch1@example.com']);
    }
}
