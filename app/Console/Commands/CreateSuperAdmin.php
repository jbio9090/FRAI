<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class CreateSuperAdmin extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:create-super-admin
                            {--name= : The name of the super admin}
                            {--email= : The email of the super admin}
                            {--password= : The password for the super admin}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create or ensure a Super Admin user with all system permissions';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Configuring Super Admin permissions and role...');

        // Reset cached permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Standard system permissions
        $permissions = [
            'view requests',
            'create requests',
            'approve requests',
            'reject requests',
            'manage facilities',
            'manage equipments',
            'manage users',
            'modify rules',
            'view chatbot logs',
            'reset password',
            'create new admins',
            'manage request options',
        ];

        foreach ($permissions as $permissionName) {
            Permission::updateOrCreate(['name' => $permissionName]);
        }

        // Create or update Super Admin role and assign all permissions
        $superAdminRole = Role::updateOrCreate(['name' => 'Super Admin']);
        $superAdminRole->syncPermissions(Permission::all());

        // Gather user details
        $name = $this->option('name') ?: $this->ask('Name', 'GSO');
        $email = $this->option('email') ?: $this->ask('Email', 'gso@example.com');

        $user = User::where('email', $email)->first();

        if ($user) {
            $this->warn("User [{$email}] already exists.");

            if ($this->option('password')) {
                $user->password = Hash::make($this->option('password'));
                $user->save();
                $this->info('Password updated.');
            }

            if (! $user->hasRole('Super Admin')) {
                $user->assignRole('Super Admin');
                $this->info("Assigned 'Super Admin' role to [{$email}].");
            } else {
                $this->info("User [{$email}] already has the 'Super Admin' role.");
            }

            return self::SUCCESS;
        }

        $password = $this->option('password') ?: $this->secret('Password (leave empty for default: "password")');
        if (empty($password)) {
            $password = 'password';
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'email_verified_at' => now(),
            'is_active' => true,
        ]);

        $user->assignRole('Super Admin');

        $this->info("✅ Super Admin user [{$email}] created and assigned 'Super Admin' role successfully.");

        return self::SUCCESS;
    }
}
