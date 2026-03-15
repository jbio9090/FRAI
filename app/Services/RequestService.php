<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\RequestStatus;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;

class RequestService
{

    public function get(RequestStatus $status, string $filter = 'this_week', ?string $search = null)
    {
        $user = Auth::user();

        $query = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", $status)
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", $status);

        $query = match ($filter) {
            'today'      => $query->whereDate('updated_at', Carbon::today()),
            'this_week'  => $query->where('updated_at', '>=', Carbon::now()->subWeek()),
            'this_month' => $query->where('updated_at', '>=', Carbon::now()->subMonth()),
            default      => $query,
        };

        if ($search) {
            $query->where('title', 'like', "%{$search}%");
        }

        return $query->latest()->paginate(20);
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
                    $query->whereIn('status', [RequestStatus::APPROVED])
                        ->where('on_hold', false)
                        ->where('id', '!=', $excludeRequestId ?? 0);
                })
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = Carbon::parse($existing->time_start);
                $existingEnd   = Carbon::parse($existing->time_end);

                Log::debug('Conflict check', [
                    'requestedStart' => $requestedStart->toTimeString(),
                    'requestedEnd'   => $requestedEnd->toTimeString(),
                    'existingStart'  => $existingStart->toTimeString(),
                    'existingEnd'    => $existingEnd->toTimeString(),
                    'overlaps'       => $requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart),
                ]);
            }

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
            'priority_level' => $validated['priority_level'] ?? 0,
            'priority_reason' => $validated['priority_reason'] ?? null,
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
        Log::debug('Conflicts found', ['conflicts' => $conflicts]);

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


    public function approve(int $request_id): FacilityRequest
    {
        $request = FacilityRequest::with(['requestFacilities'])->findOrFail($request_id);

        Log::debug('Approving request', [
            'id'             => $request->id,
            'priority_level' => $request->priority_level,
            'status'         => $request->status,
        ]);

        $bookings = $request->requestFacilities->map(fn($rf) => [
            'facility_id' => $rf->facility_id,
            'date'        => $rf->date_requested,
            'time_start'  => $rf->time_start,
            'time_end'    => $rf->time_end,
        ])->toArray();

        $conflictingRequests = $this->getConflictingApprovedRequests($bookings, $request->id);

        Log::debug('Conflicting requests found', [
            'count'     => $conflictingRequests->count(),
            'conflicts' => $conflictingRequests->map(fn($r) => [
                'id'             => $r->id,
                'status'         => $r->status,
                'priority_level' => $r->priority_level,
                'on_hold'        => $r->on_hold,
            ])->toArray(),
        ]);

        if ($conflictingRequests->isEmpty()) {
            $request->update([
                'status'            => RequestStatus::APPROVED,
                'on_hold'           => false,
                'held_by_request_id' => null,
            ]);

            return $request;
        }

        $highestConflictPriority = $conflictingRequests->max(fn($r) => $r->priority_level->value);

        if ($request->priority_level->value > $highestConflictPriority) {
            // Incoming request wins — approve it, put conflicting ones on hold
            $request->update([
                'status'             => RequestStatus::APPROVED,
                'on_hold'            => false,
                'held_by_request_id' => null,
            ]);

            foreach ($conflictingRequests as $conflicting) {
                $conflicting->update([
                    'status'             => RequestStatus::PENDING,
                    'on_hold'            => true,
                    'held_by_request_id' => $request->id,
                ]);
            }
        } else {
            // Existing approved request(s) win — put incoming on hold
            $winner = $conflictingRequests->sortByDesc('priority_level')->first();

            $request->update([
                'status'             => RequestStatus::PENDING,
                'on_hold'            => true,
                'held_by_request_id' => $winner->id,
            ]);
        }

        return $request->fresh();
    }


    private function getConflictingApprovedRequests(array $bookings, int $excludeRequestId): \Illuminate\Support\Collection
    {
        $conflictingIds = collect();

        foreach ($bookings as $booking) {
            $dateOnly       = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = Carbon::parse($booking['time_start']);
            $requestedEnd   = Carbon::parse($booking['time_end']);

            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) use ($excludeRequestId) {
                    $query->where('status', RequestStatus::APPROVED)
                        ->where('id', '!=', $excludeRequestId);
                })
                ->with('request')
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = Carbon::parse($existing->time_start);
                $existingEnd   = Carbon::parse($existing->time_end);

                if ($requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart)) {
                    $conflictingIds->push($existing->request_id);
                }
            }
        }

        if ($conflictingIds->isEmpty()) {
            return collect();
        }

        return FacilityRequest::whereIn('id', $conflictingIds->unique())->get();
    }
}
