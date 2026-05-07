<?php

namespace Database\Factories;

use App\Models\Building;
use App\Models\Campus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Facility>
 */
class FacilityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $campus = Campus::firstOrCreate(['name' => 'Main']);
        $building = Building::firstOrCreate([
            'campus_id' => $campus->id,
            'name' => fake()->buildingNumber(),
        ]);

        return [
            'name' => fake()->name(),
            'building' => $building->name,
            'campus_id' => $campus->id,
            'building_id' => $building->id,
            'capacity' => fake()->numberBetween(100, 500),
        ];
    }
}
