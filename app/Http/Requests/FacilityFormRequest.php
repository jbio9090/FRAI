<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class FacilityFormRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
<<<<<<< Updated upstream
            'title' => 'required|string|max:255',
            'description' => 'string',
            'facility_bookings' => 'required|array|min:1',
            'facility_bookings.*.facility_id' => 'required|exists:facilities,id',
            'facility_bookings.*.date' => 'required|date',
            'facility_bookings.*.time_start' => 'required',
            'facility_bookings.*.time_end' => 'required',
            'facility_bookings.*.equipment' => 'array',
            'facility_bookings.*.equipment.*.equipment_id' => 'required|exists:equipments,id',
=======
            'title'                                           => 'required|string|max:255',
            'description'                                     => 'nullable|string',
            'priority_level'                                  => 'nullable|integer|in:0,1,2',
            'priority_reason'                                 => 'nullable|string|max:512',
            'facility_bookings'                               => 'required|array|min:1',
            'facility_bookings.*.facility_id'                 => 'required|exists:facilities,id',
            'facility_bookings.*.date'                        => 'required|date',
            'facility_bookings.*.time_start'                  => 'required',
            'facility_bookings.*.time_end'                    => 'required',
            'facility_bookings.*.equipment'                   => 'array',
            'facility_bookings.*.equipment.*.equipment_id'    => 'required|exists:equipments,id',
>>>>>>> Stashed changes
            'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
        ];
    }

    /**
     * Get custom attribute names for error messages.
     */
    public function attributes(): array
    {
        return [
            'facility_bookings.*.facility_id' => 'facility',
            'facility_bookings.*.date' => 'booking date',
            'facility_bookings.*.time_start' => 'start time',
            'facility_bookings.*.time_end' => 'end time',
            'facility_bookings.*.equipment.*.quantity_needed' => 'equipment quantity',
        ];
    }
}
