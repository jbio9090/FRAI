<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Rule;

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
            "A request with no approved by, no file attachments shall, and no schedule conflicts shall be conditionally approved",
            "A request with external equipments shall be conditionally approved",
        ];

        for ($i = 0; $i < count($rules); $i++) {
            Rule::create([
                'rule' => $rules[$i],
                'priority' => $i + 1
            ]);
        }
    }
}
