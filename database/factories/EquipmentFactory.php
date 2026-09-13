<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Equipment>
 */
class EquipmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // NOTE: equipments has no facility_id column; facility linkage lives
        // in the facility_equipment pivot — attach explicitly in tests.
        return [
            'name' => fake()->name(),
            'quantity' => fake()->randomDigit(),
        ];
    }
}
