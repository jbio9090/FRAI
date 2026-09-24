<?php

namespace Tests\Feature;

use App\Mail\RescheduleAlternativesChosen;
use Tests\TestCase;

class RescheduleAlternativesMailTest extends TestCase
{
    public function test_mailable_renders_with_mail_components(): void
    {
        $mailable = new RescheduleAlternativesChosen(
            'Capstone Defense',
            'https://example.test/requests/1',
            [
                [
                    'facility_id' => 1,
                    'facility_name' => 'Main Auditorium',
                    'options' => [
                        [
                            'date' => '2026-10-03',
                            'time_start' => '08:00',
                            'time_end' => '12:00',
                            'type' => 'same_facility_time',
                            'capacity_fit' => 'exact',
                            'equipment_available' => true,
                            'chosen_by' => 'GSO',
                        ],
                    ],
                ],
            ],
        );

        // Must not throw "No hint path defined for [mail]".
        $html = $mailable->render();

        $this->assertStringContainsString('Capstone Defense', $html);
        $this->assertStringContainsString('Main Auditorium', $html);
    }
}
