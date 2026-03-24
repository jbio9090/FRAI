<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\RequestStatus;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class RequestService
{

    public function get(
        RequestStatus $status,
        string $filter = 'this_week',
        ?string $search = null,
        ?string $sort = null,
        string $order = 'asc',
        ?string $requester = null,
        ?string $facility = null,
        ?string $hasExternalEquipment = null,
    ) {
        $user = Auth::user();
        $order = in_array($order, ['asc', 'desc']) ? $order : 'asc';

        $query = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("requests.status", $status)
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('requests.user_id', $user->id)
            ->where("requests.status", $status);

        $query = match ($filter) {
            'today'      => $query->whereDate('requests.updated_at', Carbon::today()),
            'this_week'  => $query->where('requests.updated_at', '>=', Carbon::now()->subWeek()),
            'this_month' => $query->where('requests.updated_at', '>=', Carbon::now()->subMonth()),
            default      => $query,
        };

        if ($search) {
            $query->where('title', 'like', "%{$search}%");
        }

        if ($requester) {
            $requesterIds = explode(',', $requester);
            $query->whereIn('requests.user_id', $requesterIds);
        }

        if (!empty($facility)) {
            $facilityIds = is_array($facility) ? $facility : explode(',', $facility);
            $query->whereHas('requestFacilities', fn($q) => $q->whereIn('facility_id', $facilityIds));
        }

        if ($hasExternalEquipment === 'yes') {
            $query->whereHas('requestFacilities', fn($q) => $q->whereNotNull('external_equipment')->where('external_equipment', '!=', ''));
        } elseif ($hasExternalEquipment === 'no') {
            $query->whereDoesntHave('requestFacilities', fn($q) => $q->whereNotNull('external_equipment')->where('external_equipment', '!=', ''));
        }

        $sortMap = [
            'created_at'     => 'requests.created_at',
            'priority_level' => 'requests.priority_level',
            'title'          => 'requests.title',
            'user_name'      => 'users.name',
        ];

        if ($sort && isset($sortMap[$sort])) {
            if ($sort === 'user_name') {
                $query->join('users', 'requests.user_id', '=', 'users.id')
                    ->orderBy('users.name', $order);
            } else {
                $query->orderBy($sortMap[$sort], $order);
            }
        } else {
            $query->latest();
        }

        return $query->paginate(20);
    }

    public function getDetail(int $request_id)
    {
        return FacilityRequest::with(["user", "facilities", "equipment", "requestFacilities"])->where("id", $request_id)->firstOrFail();
    }

    public function update(array $validated, int $requestId): FacilityRequest
    {
        return DB::transaction(function () use ($validated, $requestId) {
            $facilityRequest = FacilityRequest::lockForUpdate()->findOrFail($requestId);

            abort_if($facilityRequest->user_id !== Auth::id(), 403);
            abort_if($facilityRequest->status !== RequestStatus::PENDING, 403);
            abort_if($facilityRequest->on_hold, 403);

            $facilityRequest->update([
                'title'           => $validated['title'],
                'description'     => $validated['description'],
                'priority_level'  => $validated['priority_level'] ?? 0,
                'priority_reason' => $validated['priority_reason'] ?? null,
            ]);

            $facilityRequest->equipment()->detach();
            $facilityRequest->requestFacilities()->delete();

            foreach ($validated['facility_bookings'] as $booking) {
                $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

                $facilityRequest->requestFacilities()->create([
                    'facility_id'        => $booking['facility_id'],
                    'date_requested'     => $dateOnly,
                    'time_start'         => $booking['time_start'],
                    'time_end'           => $booking['time_end'],
                    'external_equipment' => $booking['external_equipment'],
                ]);

                if (!empty($booking['equipment'])) {
                    foreach ($booking['equipment'] as $equipment) {
                        $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                            'quantity_needed' => $equipment['quantity_needed'],
                        ]);
                    }
                }
            }

            return $facilityRequest;
        });
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


    public function create(array $validated): FacilityRequest
    {
        return DB::transaction(function () use ($validated) {
            $facilityRequest = FacilityRequest::create([
                'user_id'         => Auth::id(),
                'title'           => $validated['title'],
                'description'     => $validated['description'],
                'status'          => RequestStatus::PENDING,
                'priority_level'  => $validated['priority_level'] ?? 0,
                'priority_reason' => $validated['priority_reason'] ?? null,
            ]);

            foreach ($validated['facility_bookings'] as $booking) {
                $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

                $facilityRequest->requestFacilities()->create([
                    'facility_id'        => $booking['facility_id'],
                    'date_requested'     => $dateOnly,
                    'time_start'         => $booking['time_start'],
                    'time_end'           => $booking['time_end'],
                    'external_equipment' => $booking['external_equipment'],
                ]);

                if (!empty($booking['equipment'])) {
                    foreach ($booking['equipment'] as $equipment) {
                        $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                            'quantity_needed' => $equipment['quantity_needed'],
                        ]);
                    }
                }
            }

            return $facilityRequest;
        });
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
        return DB::transaction(function () use ($request_id) {
            // Lock the row so concurrent approvals can't read stale data
            $request = FacilityRequest::with(['requestFacilities'])
                ->lockForUpdate()
                ->findOrFail($request_id);

            $bookings = $request->requestFacilities->map(fn($rf) => [
                'facility_id' => $rf->facility_id,
                'date'        => $rf->date_requested,
                'time_start'  => $rf->time_start,
                'time_end'    => $rf->time_end,
            ])->toArray();

            $conflictingRequests = $this->getConflictingApprovedRequests($bookings, $request->id);

            if ($conflictingRequests->isEmpty()) {
                $request->update([
                    'status'             => RequestStatus::APPROVED,
                    'on_hold'            => false,
                    'held_by_request_id' => null,
                ]);

                return $request;
            }

            $highestConflictPriority = $conflictingRequests->max(fn($r) => $r->priority_level->value);

            if ($request->priority_level->value > $highestConflictPriority) {
                $request->update([
                    'status'             => RequestStatus::APPROVED,
                    'on_hold'            => false,
                    'held_by_request_id' => null,
                ]);

                foreach ($conflictingRequests as $conflicting) {
                    $conflicting->update([
                        'status'                    => RequestStatus::PENDING,
                        'on_hold'                   => true,
                        'held_by_request_id'        => $request->id,
                        'recommended_action'        => RequestStatus::DENIED,
                        'recommended_action_reason' => 'Superseded by higher priority request: "' . $request->title . '"',
                    ]);
                }
            } else {
                $winner = $conflictingRequests->sortByDesc('priority_level')->first();

                $request->update([
                    'status'                    => RequestStatus::PENDING,
                    'on_hold'                   => true,
                    'held_by_request_id'        => $winner->id,
                    'recommended_action'        => RequestStatus::DENIED,
                    'recommended_action_reason' => 'Time conflict with higher priority approved request: "' . $winner->title . '"',
                ]);
            }

            return $request->fresh();
        });
    }


    private function getConflictingApprovedRequests(array $bookings, int $excludeRequestId): Collection
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
                ->lockForUpdate() // prevent concurrent approvals from reading stale state
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
