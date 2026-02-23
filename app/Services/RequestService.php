<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\RequestStatus;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class RequestService
{

    public function get(RequestStatus $status)
    {
        $user = Auth::user();

        // Admins see all requests, users see only their own
        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", $status)->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", $status)
            ->latest()
            ->get();

        return $requests;
    }


    public function getDetail(int $request_id)
    {
        return FacilityRequest::with(["user", "facilities", "equipment", "requestFacilities"])->where("id", $request_id)->firstOrFail();
    }


    public function checkForConflicts(array $bookings): array
    {
        $conflicts = [];

        foreach ($bookings as $index => $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = Carbon::parse($booking['time_start']);
            $requestedEnd = Carbon::parse($booking['time_end']);

            // Get all approved bookings for this facility on this date
            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) {
                    $query->where('status', RequestStatus::APPROVED);
                })
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = Carbon::parse($existing->time_start);
                $existingEnd = Carbon::parse($existing->time_end);

                // Check if times overlap
                if ($requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart)) {
                    $facility = Facility::find($booking['facility_id']);
                    $conflicts[] = sprintf(
                        'Time conflict for %s on %s: Your booking (%s - %s) overlaps with an existing approved booking (%s - %s)',
                        $facility->name ?? 'Unknown Facility',
                        Carbon::parse($dateOnly)->format('F j, Y'),
                        $requestedStart->format('g:i A'),
                        $requestedEnd->format('g:i A'),
                        $existingStart->format('g:i A'),
                        $existingEnd->format('g:i A')
                    );
                    break; // One conflict per booking is enough
                }
            }
        }

        return $conflicts;
    }


    public function create(array $validated)
    {
        $facilityRequest = FacilityRequest::create([
            'user_id' => Auth::id(),
            'title' => $validated['title'],
            'description' => $validated['description'],
            'status' => RequestStatus::PENDING,
        ]);

        foreach ($validated['facility_bookings'] as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

            $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $dateOnly,
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
                'external_equipment' => $booking['external_equipment'],
            ]);

            if (!empty($booking['equipment'])) {
                foreach ($booking['equipment'] as $equipment) {
                    $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                        'quantity_needed' => $equipment['quantity_needed']
                    ]);
                }
            }
        }

        return $facilityRequest;
    }


    public function recommendAction($validated, $saved_request)
    {
        $externalEquipment = false;
        $recommended_action = RequestStatus::APPROVED;
        $recommended_action_reason = null;

        $conflicts = $this->checkForConflicts($validated['facility_bookings']);

        foreach ($validated['facility_bookings'] as $booking) {
            if (!empty($booking['external_equipment'])) {
                $externalEquipment = true;
                break;
            }
        }

        if (!empty($conflicts)) {
            $recommended_action = RequestStatus::DENIED;
            $recommended_action_reason = "Time conflict with events";
        } else if ($externalEquipment) {
            $recommended_action = RequestStatus::CONDITIONALLY_APPROVED;
            $recommended_action_reason = "Approved request along with the external equipment";
        }
        
        $saved_request->update(["recommended_action" => $recommended_action, "recommended_action_reason" => $recommended_action_reason]);
    }
}
