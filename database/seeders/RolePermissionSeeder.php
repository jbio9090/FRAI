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

        // Create roles and assign permissions
        $userRole = Role::updateOrCreate(['name' => 'Department Head']);
        $userRole->givePermissionTo(['view requests', 'create requests']);

        $adminRole = Role::updateOrCreate(['name' => 'admin']);
        $adminRole->givePermissionTo(Permission::all());

        // Create admin user
        $admin = User::updateOrCreate([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
        ]);
        $admin->assignRole('admin');

        // Create regular user
        $user = User::updateOrCreate([
            'name' => 'Regular User',
            'email' => 'user@example.com',
            'password' => Hash::make('password'),
        ]);
        $user->assignRole('Department Head');
    }
}
