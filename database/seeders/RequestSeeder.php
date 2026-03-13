<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use App\Models\User;
use App\Models\Facility;
use App\Models\Request;
use App\Models\RequestFacility;
use App\Models\Equipment;
use App\RequestStatus;

class RequestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::role('admin')->firstOrFail();
        $user  = User::role('user')->firstOrFail();

        $facilities = Facility::pluck('id')->toArray();

        // ---- REQUESTS ----
        $request1 = Request::create([
            'user_id'     => $user->id,
            'title'       => 'Student Organization General Assembly',
            'description' => 'General assembly meeting for all members',
            'status'      => RequestStatus::PENDING->value,
            'comment'     => null,
        ]);

        $request2 = Request::create([
            'user_id'     => $user->id,
            'title'       => 'Department Seminar',
            'description' => 'Guest speaker seminar for CEIT students',
            'status'      => RequestStatus::APPROVED->value,
            'comment'     => 'Approved request',
        ]);

        $request3 = Request::create([
            'user_id'     => $admin->id,
            'title'       => 'University-wide Orientation',
            'description' => 'Orientation event for incoming students',
            'status'      => RequestStatus::APPROVED->value,
            'comment'     => 'Approved Request',
        ]);

        $request4 = Request::create([
            'user_id'     => $user->id,
            'title'       => 'End-of-Semester Party',
            'description' => 'Celebration event for graduating students',
            'status'      => RequestStatus::DENIED->value,
            'comment'     => 'Day is unavailable due to upcoming storm',
        ]);

        // ---- REQUEST FACILITIES ----
        RequestFacility::create([
            'request_id'         => $request1->id,
            'facility_id'        => $facilities[2],
            'date_requested'     => Carbon::now()->addDays(10)->toDateString(),
            'time_start'         => '09:00:00',
            'time_end'           => '12:00:00',
            'external_equipment' => null,
        ]);

        RequestFacility::create([
            'request_id'         => $request2->id,
            'facility_id'        => $facilities[3],
            'date_requested'     => Carbon::now()->addDays(15)->toDateString(),
            'time_start'         => '10:00:00',
            'time_end'           => '16:00:00',
            'external_equipment' => '1 portable projector, 2 extension cords',
        ]);

        RequestFacility::create([
            'request_id'         => $request2->id,
            'facility_id'        => $facilities[3],
            'date_requested'     => Carbon::now()->addDays(16)->toDateString(),
            'time_start'         => '10:00:00',
            'time_end'           => '16:00:00',
            'external_equipment' => null,
        ]);

        RequestFacility::create([
            'request_id'         => $request3->id,
            'facility_id'        => $facilities[0],
            'date_requested'     => Carbon::now()->addDays(20)->toDateString(),
            'time_start'         => '08:00:00',
            'time_end'           => '17:00:00',
            'external_equipment' => '3 portable speakers, 1 mixing board, 2 microphone stands',
        ]);

        RequestFacility::create([
            'request_id'         => $request4->id,
            'facility_id'        => $facilities[5],
            'date_requested'     => Carbon::now()->addDays(7)->toDateString(),
            'time_start'         => '18:00:00',
            'time_end'           => '22:00:00',
            'external_equipment' => '1 bluetooth speaker',
        ]);


        // ---- FACTORY-GENERATED REQUESTS ----
        $statuses = [
            'pending'              => 29,
            'approved'             => 8,
            'denied'               => 6,
            'conditionallyApproved' => 6,
        ];

        $facilityCollection = Facility::all();

        foreach ($statuses as $state => $count) {
            Request::factory($count)
                ->$state()
                ->for($user)
                ->create()  // <-- remove created_at from here
                ->each(function ($request) use ($facilityCollection) {
                    // Set a random created_at per individual request
                    $request->update(['created_at' => Carbon::now()->subDays(rand(0, 45)), 'updated_at' => Carbon::now()->subDays(rand(0, 45))]);

                    $picked = $facilityCollection->random(rand(1, min(3, $facilityCollection->count())));

                    foreach ($picked as $facility) {
                        RequestFacility::create([
                            'request_id'         => $request->id,
                            'facility_id'        => $facility->id,
                            'date_requested'     => Carbon::now()->addDays(rand(1, 30))->toDateString(),
                            'time_start'         => '08:00:00',
                            'time_end'           => '10:00:00',
                            'external_equipment' => null,
                        ]);
                    }
                });
        }

        // ---- EQUIPMENT (via request_equipment pivot) ----
        $coed_avr_equipment   = Equipment::where('facility_id', $facilities[2])->get();
        $ceit_hall_equipment  = Equipment::where('facility_id', $facilities[3])->get();
        $main_audit_equipment = Equipment::where('facility_id', $facilities[0])->get();

        $request1->equipment()->attach(
            $coed_avr_equipment->take(2)->mapWithKeys(fn($e) => [
                $e->id => ['quantity_needed' => 1]
            ])->all()
        );

        $request2->equipment()->attach(
            $ceit_hall_equipment->take(3)->mapWithKeys(fn($e) => [
                $e->id => ['quantity_needed' => 2]
            ])->all()
        );

        $request3->equipment()->attach(
            $main_audit_equipment->take(2)->mapWithKeys(fn($e) => [
                $e->id => ['quantity_needed' => 1]
            ])->all()
        );
    }
}
