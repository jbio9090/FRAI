<?php

namespace Database\Factories;

use App\Models\Facility;
use App\Models\Request;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RequestFacility>
 */
class RequestFacilityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'request_id' => Request::factory(),
            'facility_id' => Facility::factory(),
            'date_requested' => fake()->date(),
            'time_start' => $start = fake()->time('H:i:s'),
            'time_end' => \Carbon\Carbon::createFromFormat('H:i:s', $start)
                ->addHours(fake()->numberBetween(1, 4))
                ->format('H:i:s'),
        ];
    }
}
