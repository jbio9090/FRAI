<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        Permission::updateOrCreate(['name' => 'view requests']);
        Permission::updateOrCreate(['name' => 'create requests']);
        Permission::updateOrCreate(['name' => 'approve requests']);
        Permission::updateOrCreate(['name' => 'reject requests']);
        Permission::updateOrCreate(['name' => 'manage facilities']);
        Permission::updateOrCreate(['name' => 'manage equipments']);
        Permission::updateOrCreate(['name' => 'manage users']);
        Permission::updateOrCreate(['name' => 'modify rules']);
        Permission::updateOrCreate(['name' => 'view chatbot logs']);
        Permission::updateOrCreate(['name' => 'reset password']);
        Permission::updateOrCreate(['name' => 'create new admins']);
        Permission::updateOrCreate(['name' => 'manage request options']);


        // Create roles and assign permissions
        $userRole = Role::updateOrCreate(['name' => 'Department Head']);
        $userRole->givePermissionTo(['view requests', 'create requests']);

        $adminRole = Role::updateOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo(Permission::all());

        $superAdminRole = Role::updateOrCreate(['name' => 'Super Admin']);
        $superAdminRole->givePermissionTo(Permission::all());

        $superAdmin = User::firstOrCreate(
            ['email' => 'gso@example.com'],
            ['name' => 'GSO', 'password' => Hash::make('password')]
        );
        $superAdmin->assignRole('Super Admin');

        // Create admin user
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            ['name' => 'Admin User', 'password' => Hash::make('password')]
        );
        $adminUser->assignRole('admin');

        // Create regular user
        $regularUser = User::firstOrCreate(
            ['email' => 'user@example.com'],
            ['name' => 'Regular User', 'password' => Hash::make('password')]
        );
        $regularUser->assignRole('Department Head');
    }
}
