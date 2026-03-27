<?php

namespace App\Http\Requests;

use App\Models\Equipment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class FacilityFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority_level' => 'nullable|integer|in:0,1,2,3',
            'priority_reason' => 'nullable|string|max:512',
            'facility_bookings' => 'required|array|min:1',
            'facility_bookings.*.facility_id' => 'required|exists:facilities,id',
            'facility_bookings.*.date' => 'required|date',
            'facility_bookings.*.time_start' => 'required',
            'facility_bookings.*.time_end' => 'required',
            'facility_bookings.*.equipment' => 'array',
            'facility_bookings.*.equipment.*.equipment_id' => 'required|exists:equipments,id',
            'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
            'facility_bookings.*.external_equipment' => 'nullable|string|max:1000',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $bookings = $this->input('facility_bookings', []);

            foreach ($bookings as $bookingIndex => $booking) {
                $facilityId = $booking['facility_id'] ?? null;
                $date       = $booking['date'] ?? null;
                $timeStart  = $booking['time_start'] ?? null;
                $timeEnd    = $booking['time_end'] ?? null;

                if (!$facilityId || !$date || !$timeStart || !$timeEnd) {
                    continue;
                }

                foreach ($booking['equipment'] ?? [] as $eqIndex => $item) {
                    $equipmentId    = $item['equipment_id'] ?? null;
                    $quantityNeeded = $item['quantity_needed'] ?? 0;

                    if (!$equipmentId) {
                        continue;
                    }

                    $eq = Equipment::find($equipmentId);

                    if (!$eq) {
                        continue;
                    }

                    $available = $eq->quantityAvailableInFacility(
                        facilityId: $facilityId,
                        date: $date,
                        timeStart: $timeStart,
                        timeEnd: $timeEnd,
                        excludeRequestId: $this->route('request')?->id
                    );

                    if ($quantityNeeded > $available) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.equipment.{$eqIndex}.quantity_needed",
                            "{$eq->name} only has {$available} units available in this facility for this time slot."
                        );
                    }
                }
            }
        });
    }

    public function attributes(): array
    {
        return [
            'facility_bookings.*.facility_id'              => 'facility',
            'facility_bookings.*.date'                     => 'booking date',
            'facility_bookings.*.time_start'               => 'start time',
            'facility_bookings.*.time_end'                 => 'end time',
            'facility_bookings.*.equipment.*.quantity_needed' => 'equipment quantity',
            'facility_bookings.*.external_equipment'       => 'external equipment',
        ];
    }
}
