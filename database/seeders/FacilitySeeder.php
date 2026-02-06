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
                'building' => 'Student Building',
                'capacity' => 500,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Assembly Hall',
                'building' => 'College of Education',
                'capacity' => 800,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'COED AVR',
                'building' => 'College of Education',
                'capacity' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'CEIT Lecture Hall',
                'building' => 'College of Engineering and Information Technology',
                'capacity' => 160,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6C (CEIT Big room)',
                'building' => 'College of Engineering and Information Technology',
                'capacity' => 300,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6D (CEIT Small room)',
                'building' => 'College of Engineering and Information Technology',
                'capacity' => 50,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'CABA Lecture Hall',
                'building' => 'CABA',
                'capacity' => 100,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6A (CABA Big room)',
                'building' => 'CABA',
                'capacity' => 300,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'MPH 6B (CABA Small room)',
                'building' => 'CABA',
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
