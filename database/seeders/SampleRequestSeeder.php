<?php

namespace Database\Seeders;

use App\Enums\RequestStatus;
use App\Models\Facility;
use App\Models\Request;
use App\Models\RequestFacility;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SampleRequestSeeder extends Seeder
{
    /**
     * Additive dev seed: requests + request_facilities with dates
     * relative to today. Safe to re-run (idempotent guard).
     * NEVER run with migrate:fresh / migrate:refresh / db:wipe.
     */
    public function run(): void
    {
        if (Request::where('title', 'like', '[DEV-SEED]%')->exists()) {
            $this->command->warn('SampleRequestSeeder: [DEV-SEED] rows already exist, skipping.');

            return;
        }

        $facilityIds = Facility::whereIn('name', [
            'Main Auditorium',
            'Assembly Hall',
            'COED AVR',
            'CEIT Lecture Hall',
            'MPH 6C (CEIT Big room)',
            'MPH 6D (CEIT Small room)',
            'CABA Lecture Hall',
            'MPH 6A (CABA Big room)',
            'MPH 6B (CABA Small room)',
        ])->pluck('id', 'name');

        if ($facilityIds->count() !== 9) {
            $this->command->error('SampleRequestSeeder: expected 9 facilities, found '.$facilityIds->count().'. Aborting.');

            return;
        }

        // Requester rotation: Regular User (3) and Lebron (4); admin (2) processes decided rows.
        $regularUserId = 3;
        $lebronUserId = 4;
        $adminId = 2;
        $now = Carbon::now();

        // Each entry: request attrs + its facility rows. All dates relative to today.
        $plan = [
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] College Research Colloquium',
                'description' => 'Research presentation for faculty and students',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'Main Auditorium', 'days' => 4, 'start' => '09:00:00', 'end' => '12:00:00', 'capacity' => 350, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $lebronUserId, 'title' => '[DEV-SEED] Student Leadership Summit',
                'description' => 'Leadership training for student officers',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'Assembly Hall', 'days' => 5, 'start' => '13:00:00', 'end' => '16:00:00', 'capacity' => 600, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] Two-Day Workshop Booking',
                'description' => 'Workshop split across two facilities on the same week',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'COED AVR', 'days' => 6, 'start' => '08:00:00', 'end' => '10:00:00', 'capacity' => 80, 'outsiders' => false],
                    ['name' => 'CEIT Lecture Hall', 'days' => 6, 'start' => '13:00:00', 'end' => '15:00:00', 'capacity' => 120, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $lebronUserId, 'title' => '[DEV-SEED] Engineering Seminar',
                'description' => 'Guest speaker seminar for CEIT students',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'CEIT Lecture Hall', 'days' => 7, 'start' => '09:00:00', 'end' => '12:00:00', 'capacity' => 140, 'outsiders' => true],
                ],
            ],
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] Capstone Defense',
                'description' => 'Final capstone project defenses',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'MPH 6C (CEIT Big room)', 'days' => 8, 'start' => '14:00:00', 'end' => '17:00:00', 'capacity' => 250, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $lebronUserId, 'title' => '[DEV-SEED] Org Night Fellowship',
                'description' => 'Evening fellowship for org members',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'MPH 6D (CEIT Small room)', 'days' => 9, 'start' => '18:00:00', 'end' => '21:00:00', 'capacity' => 45, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] Business Case Competition',
                'description' => 'Inter-college case competition eliminations',
                'status' => RequestStatus::PENDING,
                'facilities' => [
                    ['name' => 'CABA Lecture Hall', 'days' => 10, 'start' => '10:00:00', 'end' => '12:00:00', 'capacity' => 90, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $lebronUserId, 'title' => '[DEV-SEED] Foundation Anniversary Fair',
                'description' => 'Whole-day anniversary fair and exhibits',
                'status' => RequestStatus::APPROVED,
                'recommended_action' => RequestStatus::APPROVED,
                'recommended_action_reason' => 'No conflicts detected for the requested slot.',
                'processed_by' => $adminId, 'processed_at' => $now->copy()->subDay(),
                'facilities' => [
                    ['name' => 'MPH 6A (CABA Big room)', 'days' => 12, 'start' => '08:00:00', 'end' => '17:00:00', 'capacity' => 280, 'outsiders' => true],
                ],
            ],
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] Club Recruitment Week',
                'description' => 'Recruitment booths across two venues',
                'status' => RequestStatus::APPROVED,
                'recommended_action' => RequestStatus::APPROVED,
                'recommended_action_reason' => 'Both venues free on the requested dates.',
                'processed_by' => $adminId, 'processed_at' => $now->copy()->subDays(2),
                'facilities' => [
                    ['name' => 'MPH 6B (CABA Small room)', 'days' => 13, 'start' => '09:00:00', 'end' => '11:00:00', 'capacity' => 40, 'outsiders' => false],
                    ['name' => 'Main Auditorium', 'days' => 14, 'start' => '13:00:00', 'end' => '16:00:00', 'capacity' => 400, 'outsiders' => false],
                ],
            ],
            [
                'user_id' => $lebronUserId, 'title' => '[DEV-SEED] Graduation Rehearsal',
                'description' => 'Rehearsal with minor time conditions',
                'status' => RequestStatus::CONDITIONALLY_APPROVED,
                'recommended_action' => RequestStatus::CONDITIONALLY_APPROVED,
                'recommended_action_reason' => 'Approved with adjusted ingress time.',
                'processed_by' => $adminId, 'processed_at' => $now->copy()->subDay(),
                'facilities' => [
                    ['name' => 'Assembly Hall', 'days' => 15, 'start' => '09:00:00', 'end' => '12:00:00', 'capacity' => 700, 'outsiders' => true],
                ],
            ],
            [
                'user_id' => $regularUserId, 'title' => '[DEV-SEED] Evening Film Showing',
                'description' => 'Denied: venue under maintenance that week',
                'status' => RequestStatus::DENIED,
                'recommended_action' => RequestStatus::DENIED,
                'recommended_action_reason' => 'Venue unavailable due to scheduled maintenance.',
                'processed_by' => $adminId, 'processed_at' => $now->copy()->subDay(),
                'facilities' => [
                    ['name' => 'COED AVR', 'days' => 16, 'start' => '14:00:00', 'end' => '17:00:00', 'capacity' => 70, 'outsiders' => false],
                ],
            ],
        ];

        DB::transaction(function () use ($plan, $facilityIds, $now) {
            foreach ($plan as $entry) {
                $facilityRows = $entry['facilities'];
                unset($entry['facilities']);

                /** @var Request $request */
                $request = Request::create($entry);

                foreach ($facilityRows as $row) {
                    RequestFacility::create([
                        'request_id' => $request->id,
                        'facility_id' => $facilityIds[$row['name']],
                        'date_requested' => $now->copy()->addDays($row['days'])->toDateString(),
                        'time_start' => $row['start'],
                        'time_end' => $row['end'],
                        'expected_capacity' => $row['capacity'],
                        'has_outsiders' => $row['outsiders'],
                        'status' => $request->status,
                    ]);
                }
            }
        });

        $this->command->info('SampleRequestSeeder: seeded '.count($plan).' requests with relative dates.');
    }
}
