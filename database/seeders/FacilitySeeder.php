<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FacilitySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        // Create Facilities
        $facilities = [
            [
                'name' => 'Main Auditorium',
                'room_number' => 'A101',
                'capacity' => 500,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Assembly Hall',
                'room_number' => 'B202',
                'capacity' => 800,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'COED AVR',
                'room_number' => 'AUD-1',
                'capacity' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'CEIT Lecture Hall',
                'room_number' => 'TR-303',
                'capacity' => 160,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6C (CEIT Big room)',
                'room_number' => 'GYM-1',
                'capacity' => 300,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6D (CEIT Small room)',
                'room_number' => 'CAF-1',
                'capacity' => 50,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'CABA Lecture Hall',
                'room_number' => 'CAF-1',
                'capacity' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6A (CABA Big room)',
                'room_number' => 'CAF-1',
                'capacity' => 300,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6B (CABA Small room)',
                'room_number' => 'CAF-1',
                'capacity' => 50,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($facilities as $facility) {
            DB::table('facilities')->insert($facility);
        }
    }
}
