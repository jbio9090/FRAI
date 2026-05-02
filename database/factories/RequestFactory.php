<?php

namespace Database\Factories;

use App\Models\User;
use App\RequestStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Arr;

class RequestFactory extends Factory
{
    public function definition(): array
    {
        $status = Arr::random(RequestStatus::cases());

        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->sentence(),
            'status' => $status,
            'recommended_action' => Arr::random(RequestStatus::cases()),
            'recommended_action_reason' => fake()->sentence(),
        ];
    }

    public function pending(): static
    {
        return $this->state(['status' => RequestStatus::PENDING]);
    }

    public function approved(): static
    {
        return $this->state(['status' => RequestStatus::APPROVED]);
    }

    public function denied(): static
    {
        return $this->state(['status' => RequestStatus::DENIED]);
    }

    public function conditionallyApproved(): static
    {
        return $this->state(['status' => RequestStatus::CONDITIONALLY_APPROVED]);
    }
}
