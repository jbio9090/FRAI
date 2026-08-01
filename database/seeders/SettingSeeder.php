<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'request.approvers' => [
                'Faculty',
                'College Dean',
                'Chairperson',
                'OSA',
                'VP AA',
                'VP Admin',
                'President',
            ],
            'request.booking_window' => [
                'start_time' => '07:00',
                'end_time' => '20:00',
                'days_of_week' => [0, 1, 2, 3, 4, 5, 6],
                'step_minutes' => 30,
            ],
            'request.min_advance_days' => 5,
        ];

        foreach ($defaults as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
