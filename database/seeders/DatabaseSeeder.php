<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        $this->call([
            RolePermissionSeeder::class,
            FacilitySeeder::class,
            EquipmentSeeder::class,
            RequestSeeder::class
        ]);


        //RULES
        $rules = [
            [
                "rule" => "No running in the bathroom",
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        foreach ($rules as $rule) {
            DB::table("rules")->insert($rule);
        }
    }
}
