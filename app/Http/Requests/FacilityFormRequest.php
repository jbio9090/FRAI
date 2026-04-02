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
            'facility_bookings.*.borrowed_equipment' => 'array',
            'facility_bookings.*.borrowed_equipment.*.equipment_id' => 'required|exists:equipments,id',
            'facility_bookings.*.borrowed_equipment.*.source_facility_id' => 'required|exists:facilities,id',
            'facility_bookings.*.borrowed_equipment.*.quantity_needed' => 'required|integer|min:1',
            'facility_bookings.*.expected_capacity' => 'nullable|integer|min:1',
            'files'   => 'nullable|array|max:10',
            'files.*' => 'file|max:10240|mimes:jpg,jpeg,png,pdf,doc,docx,xlsx,pptx',
            'existing_file_ids'   => ['nullable', 'array'],
            'existing_file_ids.*' => ['integer'],
        ];
    }
    
    protected function prepareForValidation(): void
    {
        if ($this->has('facility_bookings') && is_string($this->facility_bookings)) {
            $this->merge([
                'facility_bookings' => json_decode($this->facility_bookings, true) ?? [],
            ]);
        }

        if ($this->has('existing_file_ids') && is_string($this->existing_file_ids)) {
            $this->merge([
                'existing_file_ids' => json_decode($this->existing_file_ids, true) ?? [],
            ]);
        }
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

                if (!$facilityId || !$date || !$timeStart || !$timeEnd) continue;

                $excludeRequestId = $this->route('request')?->id;

                // Validate regular equipment
                foreach ($booking['equipment'] ?? [] as $eqIndex => $item) {
                    $eq = Equipment::find($item['equipment_id'] ?? null);
                    if (!$eq) continue;

                    $available = $eq->quantityAvailableInFacility(
                        $facilityId,
                        $date,
                        $timeStart,
                        $timeEnd,
                        $excludeRequestId
                    );

                    if ($item['quantity_needed'] > $available) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.equipment.{$eqIndex}.quantity_needed",
                            "{$eq->name} only has {$available} units available in this facility for this time slot."
                        );
                    }
                }

                // Validate borrowed equipment
                foreach ($booking['borrowed_equipment'] ?? [] as $eqIndex => $item) {
                    $eq = Equipment::find($item['equipment_id'] ?? null);
                    if (!$eq) continue;

                    $sourceFacilityId = $item['source_facility_id'] ?? null;
                    if (!$sourceFacilityId) continue;

                    // Can't borrow from the same facility — just use regular equipment
                    if ($sourceFacilityId == $facilityId) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.borrowed_equipment.{$eqIndex}.source_facility_id",
                            "Cannot borrow from the same facility. Use the regular equipment section instead."
                        );
                        continue;
                    }

                    $available = $eq->quantityAvailableToBorrowFrom(
                        $sourceFacilityId,
                        $date,
                        $timeStart,
                        $timeEnd,
                        $excludeRequestId
                    );

                    if ($item['quantity_needed'] > $available) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.borrowed_equipment.{$eqIndex}.quantity_needed",
                            "{$eq->name} only has {$available} units available to borrow from that facility for this time slot."
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
