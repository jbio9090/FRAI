<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\RequestStatus;
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

    public function getOnHold()
    {
        $user = Auth::user();

        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities', 'heldByRequest'])
                ->where('on_hold', true)
                ->latest()
                ->get()
            : FacilityRequest::with(['user', 'facilities', 'requestFacilities', 'heldByRequest'])
                ->where('user_id', $user->id)
                ->where('on_hold', true)
                ->latest()
                ->get();

        return $requests;
    }

    public function getDetail(int $request_id)
    {
        return FacilityRequest::with(["user", "facilities", "equipment", "requestFacilities", "heldByRequest", "heldRequests"])->where("id", $request_id)->firstOrFail();
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
                    $query->where('status', RequestStatus::APPROVED)
                          ->where('on_hold', false); // on-hold approved requests don't block
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

    /**
     * Find existing requests (pending or approved) that conflict with the new high-priority request's bookings.
     * Only puts on hold requests that:
     *   1. Have a LOWER priority_level than the new request
     *   2. Are booked on the SAME facility
     *   3. Are on the SAME date
     *   4. Have an OVERLAPPING time slot
     *   5. Are not already on hold
     *
     * Returns array of unique conflicting FacilityRequest models.
     */
    public function findConflictingLowerPriorityRequests(array $bookings, int $newPriorityLevel): array
    {
        // Safety: if new request is normal priority (0), nothing can be lower
        if ($newPriorityLevel <= 0) {
            return [];
        }

        $conflicting = [];

        foreach ($bookings as $booking) {
            $dateOnly       = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = Carbon::parse($booking['time_start']);
            $requestedEnd   = Carbon::parse($booking['time_end']);

            // Step 1: Find request_facilities on the SAME facility and SAME date
            // with a parent request that has LOWER priority and is not already on hold
            $candidates = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) use ($newPriorityLevel) {
                    $query->whereIn('status', ['pending', 'approved'])
                          ->where('on_hold', false)
                          ->where('priority_level', '<', $newPriorityLevel);
                })
                ->with('request')
                ->get();

            // Step 2: Among those candidates, check for actual TIME overlap
            foreach ($candidates as $rf) {
                $existingStart = Carbon::parse($rf->time_start);
                $existingEnd   = Carbon::parse($rf->time_end);

                // Overlap condition: new start < existing end AND new end > existing start
                $overlaps = $requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart);

                if ($overlaps && $rf->request !== null) {
                    $conflicting[] = $rf->request;
                }
            }
        }

        // Deduplicate by request id (a request may have multiple facilities that conflict)
        return collect($conflicting)->unique('id')->values()->all();
    }

    /**
     * Put a request on hold due to a higher-priority conflict.
     */
    public function putOnHold(FacilityRequest $request, FacilityRequest $heldByRequest, string $reason): void
    {
        $request->update([
            'on_hold'             => true,
            'priority_reason'     => $reason,
            'held_by_request_id'  => $heldByRequest->id,
        ]);
    }

    /**
     * Release a request from hold (e.g., if the higher-priority request is cancelled/denied).
     */
    public function releaseFromHold(FacilityRequest $request): void
    {
        $request->update([
            'on_hold'            => false,
            'priority_reason'    => null,
            'held_by_request_id' => null,
        ]);
    }

    public function create(array $validated)
    {
        $priorityLevel = $validated['priority_level'] ?? 0;
        $priorityReason = $validated['priority_reason'] ?? null;

        $facilityRequest = FacilityRequest::create([
            'user_id'        => Auth::id(),
            'title'          => $validated['title'],
            'description'    => $validated['description'],
            'status'         => RequestStatus::PENDING,
            'priority_level' => $priorityLevel,
            'priority_reason' => $priorityReason,
        ]);

        foreach ($validated['facility_bookings'] as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

            $facilityRequest->requestFacilities()->create([
                'facility_id'    => $booking['facility_id'],
                'date_requested' => $dateOnly,
                'time_start'     => $booking['time_start'],
                'time_end'       => $booking['time_end'],
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
}
