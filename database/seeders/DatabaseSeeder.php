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
        // Call RolePermissionSeeder FIRST to create roles and permissions
        $this->call([
            RolePermissionSeeder::class,
        ]);

        // Create additional users with roles
        $testUser = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => Hash::make('123'),
        ]);
        $testUser->assignRole('user');

        $johnDoe = User::create([
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'password' => Hash::make('password'),
        ]);
        $johnDoe->assignRole('user');

        $janeSmith = User::create([
            'name' => 'Jane Smith',
            'email' => 'jane@example.com',
            'password' => Hash::make('password'),
        ]);
        $janeSmith->assignRole('admin'); // Make Jane an admin

        $mikeJohnson = User::create([
            'name' => 'Mike Johnson',
            'email' => 'mike@example.com',
            'password' => Hash::make('password'),
        ]);
        $mikeJohnson->assignRole('user');

        // Get user IDs for requests (accounting for the 2 users created in RolePermissionSeeder)
        $adminUserId = User::where('email', 'admin@example.com')->first()->id;
        $regularUserId = User::where('email', 'user@example.com')->first()->id;
        $johnDoeId = $johnDoe->id;
        $janeSmithId = $janeSmith->id;
        $mikeJohnsonId = $mikeJohnson->id;

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

        // Create Requests
        $requests = [
            [
                'user_id' => $johnDoeId,
                'title' => 'Annual Company Meeting',
                'description' => 'Quarterly all-hands meeting to discuss company performance and goals',
                'status' => 'approved',
                'created_at' => now()->subDays(10),
                'updated_at' => now()->subDays(8),
            ],
            [
                'user_id' => $janeSmithId,
                'title' => 'Product Launch Event',
                'description' => 'Product demonstration and launch event for new software release',
                'status' => 'pending',
                'created_at' => now()->subDays(5),
                'updated_at' => now()->subDays(5),
            ],
            [
                'user_id' => $johnDoeId,
                'title' => 'Team Building Activity',
                'description' => 'Sports day and team building exercises for the sales department',
                'status' => 'approved',
                'created_at' => now()->subDays(3),
                'updated_at' => now()->subDays(2),
            ],
            [
                'user_id' => $mikeJohnsonId,
                'title' => 'Training Workshop',
                'description' => 'Technical training workshop for new software tools',
                'status' => 'rejected',
                'created_at' => now()->subDays(7),
                'updated_at' => now()->subDays(6),
            ],
            [
                'user_id' => $regularUserId,
                'title' => 'Holiday Party',
                'description' => 'End of year celebration and awards ceremony',
                'status' => 'pending',
                'created_at' => now()->subDays(1),
                'updated_at' => now()->subDays(1),
            ],
        ];

        foreach ($requests as $request) {
            DB::table('requests')->insert($request);
        }

        // Create Request Facilities (Junction Table)
        $requestFacilities = [
            // Request 1: Annual Company Meeting - Auditorium + Cafeteria
            [
                'request_id' => 1,
                'facility_id' => 3,
                'date_requested' => Carbon::now()->addDays(15)->toDateString(),
                'time_start' => '09:00:00',
                'time_end' => '17:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 1,
                'facility_id' => 6,
                'date_requested' => Carbon::now()->addDays(15)->toDateString(),
                'time_start' => '12:00:00',
                'time_end' => '14:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 1,
                'facility_id' => 3,
                'date_requested' => Carbon::now()->addDays(16)->toDateString(),
                'time_start' => '09:00:00',
                'time_end' => '15:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 2: Product Launch - Conference Room A
            [
                'request_id' => 2,
                'facility_id' => 1,
                'date_requested' => Carbon::now()->addDays(20)->toDateString(),
                'time_start' => '14:00:00',
                'time_end' => '18:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 3: Team Building - Gymnasium + Cafeteria
            [
                'request_id' => 3,
                'facility_id' => 5,
                'date_requested' => Carbon::now()->addDays(25)->toDateString(),
                'time_start' => '08:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 3,
                'facility_id' => 6,
                'date_requested' => Carbon::now()->addDays(25)->toDateString(),
                'time_start' => '12:00:00',
                'time_end' => '14:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 4: Training Workshop - Training Room (3 days)
            [
                'request_id' => 4,
                'facility_id' => 4,
                'date_requested' => Carbon::now()->addDays(30)->toDateString(),
                'time_start' => '10:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 4,
                'facility_id' => 4,
                'date_requested' => Carbon::now()->addDays(31)->toDateString(),
                'time_start' => '10:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 4,
                'facility_id' => 4,
                'date_requested' => Carbon::now()->addDays(32)->toDateString(),
                'time_start' => '10:00:00',
                'time_end' => '16:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // Request 5: Holiday Party - Auditorium + Cafeteria
            [
                'request_id' => 5,
                'facility_id' => 3,
                'date_requested' => Carbon::now()->addDays(45)->toDateString(),
                'time_start' => '18:00:00',
                'time_end' => '23:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'request_id' => 5,
                'facility_id' => 6,
                'date_requested' => Carbon::now()->addDays(45)->toDateString(),
                'time_start' => '18:00:00',
                'time_end' => '23:00:00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        foreach ($requestFacilities as $rf) {
            DB::table('request_facilities')->insert($rf);
        }

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
