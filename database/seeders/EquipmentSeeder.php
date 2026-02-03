<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EquipmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        // Equipment
        $equipments = [
            // 1 - Main Auditorium
            [
                "name" => "Padded Seats",
                "quantity" => 500,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Built-in Sound System",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Built-in Motorized Projector",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Tables for Laptop",
                "quantity" => 3,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Mic Stand",
                "quantity" => 3,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Microphone",
                "quantity" => 3,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Podium w/ PLV Logo",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],
            [
                "name" => "Folding Table",
                "quantity" => 10,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 1,
            ],

            // 2 - Assembly Hall
            [
                "name" => "Monoblock Chairs",
                "quantity" => 800,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Sound System with 4 slot audio board",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Wireless Microphone",
                "quantity" => 2,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Wired Microphone",
                "quantity" => 2,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Mic Stand",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Projector Screen",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "8x12ft Tarpaulin Backdrop",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],
            [
                "name" => "Podium w/ PLV Logo",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 2,
            ],

            // 3 - COED AVR
            [
                "name" => "Monoblock Chairs",
                "quantity" => 100,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 3,
            ],
            [
                "name" => "Mobile Fender System w/o Bluetooth",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 3,
            ],
            [
                "name" => "Microphone",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 3,
            ],

            // 4 CEIT Lecture Hall
            [
                "name" => "Seats with working Tables",
                "quantity" => 160,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 4,
            ],
            [
                "name" => "9x12 Built-in LED Wall",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 4,
            ],
            [
                "name" => "Built-in Sound Systems",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 4,
            ],
            [
                "name" => "Wireless Microphones",
                "quantity" => 2,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 4,
            ],
            [
                "name" => "Podium w/o PLV Logo",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 4,
            ],


            // 7 - CABA Lecure Hall
            // 4 CEIT Lecture Hall
            [
                "name" => "Seats with working Tables",
                "quantity" => 160,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 7,
            ],
            [
                "name" => "9x12 Built-in LED Wall",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 7,
            ],
            [
                "name" => "Built-in Sound Systems",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 7,
            ],
            [
                "name" => "Wireless Microphones",
                "quantity" => 2,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 7,
            ],
            [
                "name" => "Podium w/o PLV Logo",
                "quantity" => 1,
                'created_at' => now(),
                'updated_at' => now(),
                "facility_id" => 7,
            ],
        ];

        foreach ($equipments as $e) {
            DB::table('equipments')->insert($e);
        }
    }
}
