<?php

namespace App\Http\Requests;

use App\Models\Equipment;
use App\Models\Facility;
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
            'facility_bookings.*.facility_id' => ['required'],
            'facility_bookings.*.date' => 'required|date',
            'facility_bookings.*.time_start' => 'required',
            'facility_bookings.*.time_end' => 'required',
            'facility_bookings.*.equipment' => 'array',
            'facility_bookings.*.equipment.*.equipment_id' => 'required|integer',
            'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
            'facility_bookings.*.external_equipment' => 'nullable|array',
            'facility_bookings.*.external_equipment.*.name' => 'required|string|max:255',
            'facility_bookings.*.borrowed_equipment' => 'array',
            'facility_bookings.*.borrowed_equipment.*.equipment_id' => 'required|integer',
            'facility_bookings.*.borrowed_equipment.*.source_facility_id' => ['required'],
            'facility_bookings.*.borrowed_equipment.*.quantity_needed' => 'required|integer|min:1',
            'facility_bookings.*.expected_capacity' => 'nullable|integer|min:1',
            'facility_bookings.*.has_outsiders' => 'nullable|boolean',
            'files' => 'nullable|array|max:10',
            'files.*' => 'file|max:10240|mimes:jpg,jpeg,png,pdf,doc,docx,xlsx,pptx',
            'existing_file_ids' => ['nullable', 'array'],
            'existing_file_ids.*' => ['integer'],
            'approved_by' => ['nullable', 'array'],
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
            if (! is_array($bookings) || empty($bookings)) {
                return;
            }

            $facilityIds = collect($bookings)
                ->pluck('facility_id')
                ->merge(collect($bookings)->pluck('borrowed_equipment')->flatten(1)->pluck('source_facility_id'))
                ->filter()
                ->unique()
                ->values();

            $equipmentIds = collect($bookings)
                ->pluck('equipment')
                ->flatten(1)
                ->pluck('equipment_id')
                ->merge(collect($bookings)->pluck('borrowed_equipment')->flatten(1)->pluck('equipment_id'))
                ->filter()
                ->unique()
                ->values();

            $validFacilityIds = $facilityIds->isNotEmpty()
                ? Facility::whereIn('id', $facilityIds)->whereNull('deleted_at')->pluck('id')->all()
                : [];

            $validEquipmentIds = $equipmentIds->isNotEmpty()
                ? Equipment::whereIn('id', $equipmentIds)->pluck('id')->all()
                : [];

            foreach ($bookings as $bookingIndex => $booking) {
                if (isset($booking['facility_id']) && ! in_array($booking['facility_id'], $validFacilityIds)) {
                    $validator->errors()->add(
                        "facility_bookings.{$bookingIndex}.facility_id",
                        'The selected facility is invalid.'
                    );
                }

                foreach ($booking['equipment'] ?? [] as $eqIndex => $item) {
                    if (isset($item['equipment_id']) && ! in_array($item['equipment_id'], $validEquipmentIds)) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.equipment.{$eqIndex}.equipment_id",
                            'The selected equipment is invalid.'
                        );
                    }
                }

                foreach ($booking['borrowed_equipment'] ?? [] as $eqIndex => $item) {
                    if (isset($item['equipment_id']) && ! in_array($item['equipment_id'], $validEquipmentIds)) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.borrowed_equipment.{$eqIndex}.equipment_id",
                            'The selected equipment is invalid.'
                        );
                    }

                    if (isset($item['source_facility_id']) && ! in_array($item['source_facility_id'], $validFacilityIds)) {
                        $validator->errors()->add(
                            "facility_bookings.{$bookingIndex}.borrowed_equipment.{$eqIndex}.source_facility_id",
                            'The selected facility is invalid.'
                        );
                    }
                }
            }
        });
    }

    public function attributes(): array
    {
        $attrs = [
            'facility_bookings.*.facility_id' => 'facility',
            'facility_bookings.*.date' => 'booking date',
            'facility_bookings.*.time_start' => 'start time',
            'facility_bookings.*.time_end' => 'end time',
            'facility_bookings.*.equipment.*.quantity_needed' => 'equipment quantity',
            'facility_bookings.*.external_equipment' => 'external equipment',
        ];

        // Dynamically label each file by its original name
        foreach ($this->file('files', []) as $index => $file) {
            $attrs["files.{$index}"] = $file?->getClientOriginalName() ?? 'file '.($index + 1);
        }

        return $attrs;
    }

    public function messages(): array
    {
        return [
            'files.*.max' => 'Each file must be under 10MB. ":attribute" exceeds the limit.',
            'files.*.mimes' => '":attribute" is not an allowed file type. Accepted: JPG, PNG, PDF, DOC, DOCX, XLSX, PPTX.',
            'files.*.file' => '":attribute" could not be uploaded.',
            'files.max' => 'You may only attach up to 10 files.',
        ];
    }
}
