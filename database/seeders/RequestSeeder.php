<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use App\Models\User;
use App\Models\Facility;

class RequestSeeder extends Seeder
{
    public function run(): void
    {
        // Get users by role
        $admin = User::role('admin')->firstOrFail();
        $user  = User::role('user')->firstOrFail();

        // Get facilities (assumes facilities are already seeded)
        $facilities = Facility::pluck('id')->toArray();

        // ---- REQUESTS ----
        $requests = [
            [
                'user_id' => $user->id,
                'title' => 'Student Organization General Assembly',
                'description' => 'General assembly meeting for all members',
                'status' => 'pending',
                'created_at' => now()->subDays(5),
                'updated_at' => now()->subDays(5),
                'comment' => null,
            ],
            [
                'user_id' => $user->id,
                'title' => 'Department Seminar',
                'description' => 'Guest speaker seminar for CEIT students',
                'status' => 'approved',
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(8),
                'comment' => 'Approved request',
            ],
            [
                'user_id' => $admin->id,
                'title' => 'University-wide Orientation',
                'description' => 'Orientation event for incoming students',
                'status' => 'approved',
                'created_at' => now()->subDays(15),
                'updated_at' => now()->subDays(12),
                'comment' => 'Approved Request',
            ],
            [
                'user_id' => $user->id,
                'title' => 'End-of-Semester Party',
                'description' => 'Celebration event for graduating students',
                'status' => 'rejected',
                'created_at' => now()->subDays(7),
                'updated_at' => now()->subDays(6),
                'comment' => 'Day is unavailable due to upcoming storm',
            ],
        ];

        DB::table('requests')->insert($requests);

        // Fetch inserted request IDs
        $requestIds = DB::table('requests')->orderBy('id')->pluck('id');

        // ---- REQUEST FACILITIES ----
        $requestFacilities = [
            // Request 1
            [
                'request_id' => $requestIds[0],
                'facility_id' => $facilities[2], // COED AVR
                'date_requested' => Carbon::now()->addDays(10)->toDateString(),
                'time_start' => '09:00:00',
                'time_end' => '12:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 2 (2-day event)
            [
                'request_id' => $requestIds[1],
                'facility_id' => $facilities[3], // CEIT Lecture Hall
                'date_requested' => Carbon::now()->addDays(15)->toDateString(),
                'time_start' => '10:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => $requestIds[1],
                'facility_id' => $facilities[3],
                'date_requested' => Carbon::now()->addDays(16)->toDateString(),
                'time_start' => '10:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 3
            [
                'request_id' => $requestIds[2],
                'facility_id' => $facilities[0], // Main Auditorium
                'date_requested' => Carbon::now()->addDays(20)->toDateString(),
                'time_start' => '08:00:00',
                'time_end' => '17:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 4
            [
                'request_id' => $requestIds[3],
                'facility_id' => $facilities[5], // MPH 6D
                'date_requested' => Carbon::now()->addDays(7)->toDateString(),
                'time_start' => '18:00:00',
                'time_end' => '22:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('request_facilities')->insert($requestFacilities);
    }
}
