<?php

namespace App\Services;

use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\PriorityLevel;
use App\RequestStatus;
use App\Services\RAG\AIRecommendationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RequestService
{
    public function __construct(
        protected AuditLogger $auditLogger,
        protected AIRecommendationService $aiRecommender,
        protected NotificationService $notification,
    ) {}

    public function get(
        ?array $statuses,
        string $filter = 'this_week',
        ?string $search = null,
        ?string $sort = null,
        string $order = 'asc',
        ?string $requester = null,
        ?string $facility = null,
        ?string $hasExternalEquipment = null,
        ?bool $hasConflicts = false,
    ) {
        $user = Auth::user();
        $order = in_array($order, ['asc', 'desc']) ? $order : 'asc';

        $query = $user->hasRole('admin')
            ? FacilityRequest::with([
                'user',
                'processedBy',
                'facilities',
                'files',
                'comments.user',
                'requestFacilities',
                'requestFacilities.externalEquipments',
                'equipment' => fn ($q) => $q->withPivot(['quantity_needed', 'is_borrowed', 'source_facility_id']),
                'equipment.facilities',
            ])
            : FacilityRequest::with([
                'user',
                'processedBy',
                'facilities',
                'files',
                'comments.user',
                'requestFacilities',
                'requestFacilities.externalEquipments',
                'equipment' => fn ($q) => $q->withPivot(['quantity_needed', 'is_borrowed', 'source_facility_id']),
                'equipment.facilities',
            ])->where('requests.user_id', $user->id);

        $query = match ($filter) {
            'today' => $query->whereDate('requests.updated_at', Carbon::today()),
            'this_week' => $query->where('requests.updated_at', '>=', Carbon::now()->subWeek()),
            'this_month' => $query->where('requests.updated_at', '>=', Carbon::now()->subMonth()),
            default => $query,
        };

        if (! empty($statuses)) {
            $query->whereIn('requests.status', $statuses);
        }

        if ($search) {
            $query->where('title', 'like', "%{$search}%");
        }

        if ($requester) {
            $requesterIds = explode(',', $requester);
            $query->whereIn('requests.user_id', $requesterIds);
        }

        if (! empty($facility)) {
            $facilityIds = is_array($facility) ? $facility : explode(',', $facility);
            $query->whereHas('requestFacilities', fn ($q) => $q->whereIn('facility_id', $facilityIds));
        }

        if ($hasExternalEquipment === 'yes') {
            $query->whereHas('requestFacilities.externalEquipments');
        } elseif ($hasExternalEquipment === 'no') {
            $query->whereDoesntHave('requestFacilities.externalEquipments');
        }

        $sortMap = [
            'created_at' => 'requests.created_at',
            'priority_level' => 'requests.priority_level',
            'title' => 'requests.title',
            'user_name' => 'users.name',
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

        $paginated = $query->paginate(20);

        $paginated->getCollection()->transform(function ($request) {
            $allRfIds = array_unique(array_merge(
                $request->pending_conflict_rf_ids ?? [],
                $request->approved_conflict_rf_ids ?? [],
            ));

            $conflictRfs = $allRfIds
                ? RequestFacility::whereIn('id', $allRfIds)
                    ->with(['request.user', 'facility'])
                    ->get()
                    ->keyBy('id')
                : collect();

            $request->setRelation(
                'pending_conflicts',
                collect($request->pending_conflict_rf_ids ?? [])
                    ->map(fn ($id) => $conflictRfs->get($id))
                    ->filter()->values()
            );

            $request->setRelation(
                'approved_conflicts',
                collect($request->approved_conflict_rf_ids ?? [])
                    ->map(fn ($id) => $conflictRfs->get($id))
                    ->filter()->values()
            );

            $this->loadEquipmentConflictRelations($request);
            $this->attachPerFacilityEquipment($request);

            return $request;
        });

        return $paginated;
    }

    public function getDetail(int $request_id)
    {
        $request = FacilityRequest::with([
            'user',
            'facilities',
            'requestFacilities',
            'processedBy',
            'requestFacilities.externalEquipments',
            'comments' => fn ($q) => $q->latest(),
            'comments.user',
            'equipment' => fn ($q) => $q->withPivot(['quantity_needed', 'is_borrowed', 'source_facility_id']),
            'equipment.facilities',
        ])->where('id', $request_id)->firstOrFail();

        $allRfIds = array_unique(array_merge(
            $request->pending_conflict_rf_ids ?? [],
            $request->approved_conflict_rf_ids ?? [],
        ));

        $conflictRfs = $allRfIds
            ? RequestFacility::whereIn('id', $allRfIds)
                ->with(['request.user', 'facility'])
                ->get()
                ->keyBy('id')
            : collect();

        $request->setRelation(
            'pending_conflicts',
            collect($request->pending_conflict_rf_ids ?? [])
                ->map(fn ($id) => $conflictRfs->get($id))
                ->filter()
                ->values()
        );

        $request->setRelation(
            'approved_conflicts',
            collect($request->approved_conflict_rf_ids ?? [])
                ->map(fn ($id) => $conflictRfs->get($id))
                ->filter()
                ->values()
        );

        $this->loadEquipmentConflictRelations($request);
        $this->attachPerFacilityEquipment($request);

        return $request;
    }

    public function create(array $validated): FacilityRequest
    {
        return DB::transaction(function () use ($validated) {
            $priorityLevel = PriorityLevel::from($validated['priority_level'] ?? 0);

            $facilityRequest = FacilityRequest::create([
                'user_id' => Auth::id(),
                'title' => $validated['title'],
                'description' => $validated['description'],
                'status' => RequestStatus::PENDING,
                'priority_level' => $validated['priority_level'] ?? 0,
                'priority_reason' => $validated['priority_reason'] ?? null,
                'approved_by' => $validated['approved_by'] ?? null,
            ]);

            if (! empty($validated['files'])) {
                $this->handleFileUploads($facilityRequest, $validated['files']);
            }

            $this->syncBookingsAndEquipment($facilityRequest, $validated['facility_bookings']);

            if ($priorityLevel === PriorityLevel::Government) {
                return $this->approve($facilityRequest->id);
            }

            $this->auditLogger::requestCreated($facilityRequest);

            return $facilityRequest;
        });
    }

    public function update(array $validated, int $requestId): FacilityRequest
    {
        return DB::transaction(function () use ($validated, $requestId) {
            $facilityRequest = FacilityRequest::lockForUpdate()->findOrFail($requestId);

            abort_if($facilityRequest->user_id !== Auth::id(), 403);
            abort_if(! in_array($facilityRequest->status, [RequestStatus::PENDING, RequestStatus::FOR_RESCHEDULE]), 403);
            abort_if($facilityRequest->on_hold, 403);

            $original = $facilityRequest->only([
                'title',
                'description',
                'priority_level',
                'priority_reason',
            ]);

            $oldBookings = $facilityRequest->requestFacilities()
                ->with('facility')
                ->get()
                ->map(fn ($rf) => [
                    'facility' => $rf->facility?->name,
                    'date' => $rf->date_requested,
                    'time_start' => substr($rf->time_start, 0, 5),
                    'time_end' => substr($rf->time_end, 0, 5),
                    'expected_capacity' => $rf->expected_capacity,
                    'has_outsiders' => (bool) $rf->has_outsiders,
                ])
                ->toArray();

            $facilityRequest->update([
                'title' => $validated['title'],
                'description' => $validated['description'],
                'priority_level' => $validated['priority_level'] ?? 0,
                'priority_reason' => $validated['priority_reason'] ?? null,
                'approved_by' => $validated['approved_by'] ?? null,
                'recommended_action' => null,
                'recommended_action_reason' => null,
            ]);

            $changes = collect($facilityRequest->only([
                'title',
                'description',
                'priority_level',
                'priority_reason',
            ]))->filter(fn ($value, $key) => $value != $original[$key])
                ->map(fn ($value, $key) => [
                    'from' => $original[$key],
                    'to' => $value,
                ])->toArray();

            $facilityRequest->equipment()->detach();
            $facilityRequest->requestFacilities()->delete();

            $keptIds = array_map('intval', $validated['existing_file_ids'] ?? []);
            foreach ($facilityRequest->files as $file) {
                if (! in_array($file->id, $keptIds)) {
                    Storage::disk('public')->delete($file->path);
                    $this->auditLogger::requestFileRemoved($facilityRequest, $file);
                    $file->delete();
                }
            }

            if (! empty($validated['files'])) {
                $this->handleFileUploads($facilityRequest, $validated['files']);
            }

            $this->syncBookingsAndEquipment($facilityRequest, $validated['facility_bookings']);

            $facilityRequest->load('requestFacilities.facility');

            $newBookings = $facilityRequest->requestFacilities
                ->map(fn ($rf) => [
                    'facility' => $rf->facility?->name,
                    'date' => $rf->date_requested,
                    'time_start' => substr($rf->time_start, 0, 5),
                    'time_end' => substr($rf->time_end, 0, 5),
                    'expected_capacity' => $rf->expected_capacity,
                    'has_outsiders' => (bool) $rf->has_outsiders,
                ])
                ->toArray();

            if ($oldBookings !== $newBookings) {
                $changes['bookings'] = [
                    'from' => $oldBookings,
                    'to' => $newBookings,
                ];
            }

            $this->auditLogger::requestUpdated($facilityRequest, $changes);

            return $facilityRequest;
        });
    }

    private function syncBookingsAndEquipment(FacilityRequest $facilityRequest, array $bookings): void
    {
        $equipmentMap = [];

        foreach ($bookings as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

            $requestFacility = $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $dateOnly,
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
                'expected_capacity' => $booking['expected_capacity'] ?? null,
                'has_outsiders' => $booking['has_outsiders'] ?? false,
            ]);

            foreach ($booking['external_equipment'] ?? [] as $externalItem) {
                $requestFacility->externalEquipments()->create([
                    'name' => $externalItem['name'],
                ]);
            }

            foreach ($booking['equipment'] ?? [] as $equipment) {
                $key = "own_{$equipment['equipment_id']}";
                $equipmentMap[$key] = [
                    'equipment_id' => $equipment['equipment_id'],
                    'quantity_needed' => ($equipmentMap[$key]['quantity_needed'] ?? 0) + $equipment['quantity_needed'],
                    'is_borrowed' => false,
                    'source_facility_id' => null,
                ];
            }

            foreach ($booking['borrowed_equipment'] ?? [] as $equipment) {
                $key = "borrow_{$equipment['equipment_id']}_{$equipment['source_facility_id']}";
                $equipmentMap[$key] = [
                    'equipment_id' => $equipment['equipment_id'],
                    'quantity_needed' => ($equipmentMap[$key]['quantity_needed'] ?? 0) + $equipment['quantity_needed'],
                    'is_borrowed' => true,
                    'source_facility_id' => $equipment['source_facility_id'],
                ];
            }
        }

        foreach ($equipmentMap as $item) {
            $facilityRequest->equipment()->attach($item['equipment_id'], [
                'quantity_needed' => $item['quantity_needed'],
                'is_borrowed' => $item['is_borrowed'],
                'source_facility_id' => $item['source_facility_id'],
            ]);
        }
    }

    public function checkForConflicts(array $bookings, array $statuses = [RequestStatus::APPROVED], ?int $excludeRequestId = null): array
    {
        $conflicts = [];

        $facilityIds = collect($bookings)->pluck('facility_id')->unique();
        $dates = collect($bookings)->pluck('date')->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))->unique();

        $existingBookings = RequestFacility::whereIn('facility_id', $facilityIds)
            ->whereIn('date_requested', $dates)
            ->whereHas('request', function ($query) use ($excludeRequestId, $statuses) {
                $query->whereIn('status', $statuses)
                    ->where('on_hold', false)
                    ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId));
            })
            ->with(['facility', 'request'])
            ->get();

        foreach ($bookings as $booking) {
            $requestedDate = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = $this->parseBookingDateTime($requestedDate, $booking['time_start']);
            $requestedEnd = $this->parseBookingDateTime($requestedDate, $booking['time_end']);

            foreach ($existingBookings as $existing) {
                if ($existing->facility_id != $booking['facility_id'] || $existing->date_requested != $requestedDate) {
                    continue;
                }

                $existingStart = $this->parseBookingDateTime($requestedDate, $existing->time_start);
                $existingEnd = $this->parseBookingDateTime($requestedDate, $existing->time_end);

                if ($requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart)) {
                    $status = $existing->request->status;
                    $conflicts[] = [
                        'request_id' => $existing->request_id,
                        'request_facility_id' => $existing->id,
                        'status' => $status,
                        'message' => sprintf(
                            'Time conflict for %s on %s: Your booking (%s - %s) overlaps with an existing %s booking (%s - %s)',
                            $existing->facility->name,
                            Carbon::parse($requestedDate)->format('F j, Y'),
                            $requestedStart->format('g:i A'),
                            $requestedEnd->format('g:i A'),
                            strtolower($status->value),
                            $existingStart->format('g:i A'),
                            $existingEnd->format('g:i A')
                        ),
                    ];
                }
            }
        }

        return $conflicts;
    }

    public function recommendAction(array $validated, FacilityRequest $saved_request): array
    {
        $hasExternalEquipment = false;

        $conflicts = $this->checkForConflicts(
            $validated['facility_bookings'],
            [RequestStatus::PENDING, RequestStatus::APPROVED],
            $saved_request->id
        );

        $hasApprovedConflict = collect($conflicts)->contains(fn ($c) => $c['status'] === RequestStatus::APPROVED);
        $pendingConflicts = collect($conflicts)->filter(fn ($c) => $c['status'] === RequestStatus::PENDING)->values();
        $approvedConflicts = collect($conflicts)->filter(fn ($c) => $c['status'] === RequestStatus::APPROVED)->values();

        $pendingConflictRfIds = $pendingConflicts->pluck('request_facility_id')->unique()->values()->toArray();
        $approvedConflictRfIds = $approvedConflicts->pluck('request_facility_id')->unique()->values()->toArray();

        $equipmentConflicts = $this->checkForEquipmentConflicts(
            $validated['facility_bookings'],
            [RequestStatus::PENDING, RequestStatus::APPROVED],
            $saved_request->id
        );
        $pendingEquipmentRequestIds = collect($equipmentConflicts)
            ->filter(fn ($c) => $c['status'] === RequestStatus::PENDING)
            ->pluck('request_id')->unique()->values()->toArray();

        $approvedEquipmentRequestIds = collect($equipmentConflicts)
            ->filter(fn ($c) => $c['status'] === RequestStatus::APPROVED)
            ->pluck('request_id')->unique()->values()->toArray();

        foreach ($validated['facility_bookings'] as $booking) {
            if (! empty($booking['external_equipment'])) {
                $hasExternalEquipment = true;
                break;
            }
        }

        $saved_request->update([
            'pending_conflict_rf_ids' => $pendingConflictRfIds ?: [],
            'approved_conflict_rf_ids' => $approvedConflictRfIds ?: [],
            'pending_equipment_conflict_request_ids' => $pendingEquipmentRequestIds ?: [],
            'approved_equipment_conflict_request_ids' => $approvedEquipmentRequestIds ?: [],
        ]);

        $saved_request->refresh();

        $saved_request->loadMissing(['requestFacilities.facility', 'requestFacilities.externalEquipments', 'equipment']);

        $ai = $this->aiRecommender->recommend($saved_request);

        $saved_request->update([
            'recommended_action' => $ai['status'],
            'recommended_action_reason' => $ai['reason'],
        ]);

        $this->notification->notifyAdminsAfterAiRecommendation($saved_request);

        $savedRequestRfIds = $saved_request->requestFacilities()->pluck('id')->toArray();

        $pendingConflicts
            ->pluck('request_id')
            ->unique()
            ->each(function ($conflictingRequestId) use ($savedRequestRfIds) {
                $conflictingRequest = FacilityRequest::find($conflictingRequestId);
                if (! $conflictingRequest) {
                    return;
                }

                $existing = $conflictingRequest->pending_conflict_rf_ids ?? [];
                $merged = array_values(array_unique(array_merge($existing, $savedRequestRfIds)));

                $conflictingRequest->update([
                    'pending_conflict_rf_ids' => $merged,
                    'recommended_action' => RequestStatus::FOR_RESCHEDULE,
                    'recommended_action_reason' => 'Time conflict with pending requests',
                ]);
            });

        $this->removeStalePendingConflictRefs($saved_request, $pendingConflictRfIds);

        return [
            'pending' => $pendingConflictRfIds,
            'approved' => $approvedConflictRfIds,
        ];
    }

    private function removeStalePendingConflictRefs(FacilityRequest $saved_request, array $currentPendingRfIds): void
    {
        $savedRfIds = $saved_request->requestFacilities()->pluck('id')->toArray();

        $candidateRequests = FacilityRequest::where('id', '!=', $saved_request->id)
            ->whereNotNull('pending_conflict_rf_ids')
            ->get()
            ->filter(fn ($r) => ! empty(array_intersect($r->pending_conflict_rf_ids ?? [], $savedRfIds)));

        foreach ($candidateRequests as $candidate) {
            $isStillConflicting = in_array($candidate->id, collect($currentPendingRfIds)->toArray())
                || RequestFacility::whereIn('id', $currentPendingRfIds)
                    ->where('request_id', $candidate->id)
                    ->exists();

            if ($isStillConflicting) {
                continue;
            }
            $cleaned = array_values(array_diff($candidate->pending_conflict_rf_ids ?? [], $savedRfIds));

            $candidate->update([
                'pending_conflict_rf_ids' => $cleaned,
            ]);
        }
    }

    public function approve(int $request_id): FacilityRequest
    {
        return DB::transaction(function () use ($request_id) {
            $request = FacilityRequest::with(['requestFacilities', 'equipment'])
                ->lockForUpdate()
                ->findOrFail($request_id);

            $bookings = $request->requestFacilities->map(fn ($rf) => [
                'facility_id' => $rf->facility_id,
                'date' => $rf->date_requested,
                'time_start' => $rf->time_start,
                'time_end' => $rf->time_end,
            ])->toArray();

            $conflictingRequests = $this->getConflictingApprovedRequests($bookings, $request->id);

            $request->update([
                'status' => RequestStatus::APPROVED,
                'on_hold' => false,
                'held_by_request_id' => null,
                'processed_by' => Auth::id(),
                'processed_at' => Carbon::now(),
            ]);

            $this->auditLogger::requestApproved($request);

            foreach ($conflictingRequests as $conflicting) {
                $conflicting->update([
                    'status' => RequestStatus::FOR_RESCHEDULE,
                    'on_hold' => true,
                    'held_by_request_id' => $request->id,
                    'recommended_action' => RequestStatus::DENIED,
                    'recommended_action_reason' => 'Superseded by approved request: "'.$request->title.'"',
                    'processed_by' => null,
                    'processed_at' => null,
                ]);

                $conflicting->comments()->create([
                    'user_id' => Auth::id(),
                    'body' => 'Marked for reschedule — overridden by approved request: "'.$request->title.'"',
                ]);

                $this->auditLogger::requestHeld($conflicting, $request);
            }

            $equipmentDisplaced = $this->getEquipmentDisplacedRequests($request);

            foreach ($equipmentDisplaced as $conflicting) {
                if ($conflicting->on_hold) {
                    continue;
                }

                $conflicting->update([
                    'status' => RequestStatus::FOR_RESCHEDULE,
                    'on_hold' => true,
                    'held_by_request_id' => $request->id,
                    'recommended_action' => RequestStatus::DENIED,
                    'recommended_action_reason' => 'Equipment no longer available — superseded by approved request: "'.$request->title.'"',
                    'processed_by' => null,
                    'processed_at' => null,
                ]);

                $conflicting->comments()->create([
                    'user_id' => Auth::id(),
                    'body' => 'Marked for reschedule — equipment taken by approved request: "'.$request->title.'"',
                ]);

                $this->auditLogger::requestHeld($conflicting, $request);
            }

            return $request->fresh();
        });
    }

    private function getEquipmentDisplacedRequests(FacilityRequest $approvedRequest): Collection
    {
        $displacedIds = collect();

        foreach ($approvedRequest->requestFacilities as $rf) {
            $date = Carbon::parse($rf->date_requested)->format('Y-m-d');
            $timeStart = substr($rf->time_start, 0, 5);
            $timeEnd = substr($rf->time_end, 0, 5);

            foreach ($approvedRequest->equipment as $equipment) {
                $available = $equipment->quantityAvailable($date, $timeStart, $timeEnd, null);

                if ($available >= 0) {
                    continue;
                }

                $pendingRequests = FacilityRequest::whereIn('status', [RequestStatus::PENDING, RequestStatus::CONDITIONALLY_APPROVED])
                    ->where('on_hold', false)
                    ->where('id', '!=', $approvedRequest->id)
                    ->whereHas('equipment', fn ($q) => $q->where('equipments.id', $equipment->id))
                    ->whereHas('requestFacilities', function ($q) use ($date, $timeStart, $timeEnd) {
                        $q->where('date_requested', $date)
                            ->where('time_start', '<', $timeEnd)
                            ->where('time_end', '>', $timeStart);
                    })
                    ->get();

                foreach ($pendingRequests as $pending) {
                    $displacedIds->push($pending->id);
                }
            }
        }

        if ($displacedIds->isEmpty()) {
            return collect();
        }

        return FacilityRequest::whereIn('id', $displacedIds->unique())->get();
    }

    private function getConflictingApprovedRequests(array $bookings, int $excludeRequestId): Collection
    {
        $conflictingIds = collect();

        foreach ($bookings as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = $this->parseBookingDateTime($dateOnly, $booking['time_start']);
            $requestedEnd = $this->parseBookingDateTime($dateOnly, $booking['time_end']);

            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) use ($excludeRequestId) {
                    $query->whereIn('status', [RequestStatus::APPROVED, RequestStatus::FOR_RESCHEDULE])
                        ->where('id', '!=', $excludeRequestId);
                })
                ->with('request')
                ->lockForUpdate()
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = $this->parseBookingDateTime($dateOnly, $existing->time_start);
                $existingEnd = $this->parseBookingDateTime($dateOnly, $existing->time_end);

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

    public function handleFileUploads(FacilityRequest $facilityRequest, array $files): void
    {
        foreach ($files as $file) {
            $path = $file->store('request-files', 'public');

            $requestFile = $facilityRequest->files()->create([
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);

            $this->auditLogger::requestFileUploaded($facilityRequest, $requestFile); // 👈
        }
    }

    public function deleteFiles(FacilityRequest $facilityRequest): void
    {
        foreach ($facilityRequest->files as $file) {
            Storage::disk('local')->delete($file->path);
            $this->auditLogger::requestFileRemoved($facilityRequest, $file); // 👈
            $file->delete();
        }
    }

    public function findConflictingLowerPriorityRequests(array $bookings, int $priorityLevel): Collection
    {
        $conflictingIds = collect();

        foreach ($bookings as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = $this->parseBookingDateTime($dateOnly, $booking['time_start']);
            $requestedEnd = $this->parseBookingDateTime($dateOnly, $booking['time_end']);

            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) use ($priorityLevel) {
                    $query->whereIn('status', [RequestStatus::APPROVED, RequestStatus::PENDING])
                        ->where('on_hold', false)
                        ->whereRaw('priority_level < ?', [$priorityLevel]);
                })
                ->with('request')
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = $this->parseBookingDateTime($dateOnly, $existing->time_start);
                $existingEnd = $this->parseBookingDateTime($dateOnly, $existing->time_end);

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

    private function parseBookingDateTime(string $date, string $time): Carbon
    {
        $dateOnly = Carbon::parse($date)->format('Y-m-d');
        $timeOnly = trim($time);

        foreach (['Y-m-d H:i:s', 'Y-m-d H:i'] as $format) {
            try {
                return Carbon::createFromFormat($format, "{$dateOnly} {$timeOnly}");
            } catch (\Carbon\Exceptions\InvalidFormatException) {
                continue;
            }
        }

        return Carbon::parse("{$dateOnly} {$timeOnly}");
    }

    public function putOnHold(FacilityRequest $target, FacilityRequest $heldBy, string $reason): void
    {
        $target->update([
            'on_hold' => true,
            'held_by_request_id' => $heldBy->id,
            'recommended_action' => RequestStatus::DENIED,
            'recommended_action_reason' => $reason,
            'processed_by' => null,
            'processed_at' => null,
        ]);
    }

    public function getEditData(int $requestId): array
    {
        $detail = FacilityRequest::with([
            'user',
            'requestFacilities',
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment' => fn ($q) => $q->withPivot(['quantity_needed', 'is_borrowed', 'source_facility_id']),
            'equipment.facilities',
            'files',
        ])->where('id', $requestId)->firstOrFail();

        $sourceFacilities = $detail->equipment
            ->flatMap(fn ($eq) => $eq->facilities)
            ->keyBy('id');

        return [
            'id' => $detail->id,
            'title' => $detail->title,
            'description' => $detail->description,
            'priority_level' => $detail->priority_level,
            'priority_reason' => $detail->priority_reason,
            'approved_by' => $detail->approved_by ?? [],
            'existing_files' => $detail->files->map(fn ($f) => [
                'id' => $f->id,
                'original_name' => $f->original_name,
                'mime_type' => $f->mime_type,
                'size' => $f->size,
                'url' => $f->url,
                'path' => $f->path,
            ]),
            'facility_bookings' => $detail->requestFacilities->map(
                function ($rf) use ($detail, $sourceFacilities) {

                    $ownEquipment = $detail->equipment
                        ->filter(
                            fn ($eq) => ! $eq->pivot->is_borrowed &&
                                $eq->facilities->contains('id', $rf->facility_id)
                        )
                        ->map(fn ($eq) => [
                            'equipment_id' => $eq->id,
                            'equipment_name' => $eq->name,
                            'quantity_needed' => $eq->pivot->quantity_needed,
                            'max_quantity' => $eq->facilities
                                ->firstWhere('id', $rf->facility_id)
                                ?->pivot->quantity ?? $eq->quantity,
                        ])->values();

                    $borrowedEquipment = $detail->equipment
                        ->filter(fn ($eq) => $eq->pivot->is_borrowed)
                        ->map(fn ($eq) => [
                            'equipment_id' => $eq->id,
                            'equipment_name' => $eq->name,
                            'source_facility_id' => $eq->pivot->source_facility_id,
                            'source_facility_name' => $sourceFacilities->get($eq->pivot->source_facility_id)?->name ?? '',
                            'quantity_needed' => $eq->pivot->quantity_needed,
                            'max_quantity' => $eq->pivot->quantity_needed,
                        ])->values();

                    return [
                        'facility_id' => $rf->facility_id,
                        'facility_name' => $rf->facility->name ?? '',
                        'date' => $rf->date_requested,
                        'time_start' => $rf->time_start,
                        'time_end' => $rf->time_end,
                        'expected_capacity' => $rf->expected_capacity,
                        'external_equipment' => $rf->externalEquipments->map(fn ($e) => ['name' => $e->name])->values(),
                        'equipment' => $ownEquipment,
                        'borrowed_equipment' => $borrowedEquipment,
                        'conflicts' => [],
                        'has_outsiders' => (bool) $rf->has_outsiders,
                    ];
                },
            )->values(),
        ];
    }

    public function checkForEquipmentConflicts(
        array $bookings,
        array $statuses = [RequestStatus::APPROVED],
        ?int $excludeRequestId = null
    ): array {
        $conflicts = [];

        foreach ($bookings as $booking) {
            $date = Carbon::parse($booking['date'])->format('Y-m-d');
            $timeStart = substr($booking['time_start'], 0, 5);
            $timeEnd = substr($booking['time_end'], 0, 5);

            $equipmentIds = array_unique(array_merge(
                array_column($booking['equipment'] ?? [], 'equipment_id'),
                array_column($booking['borrowed_equipment'] ?? [], 'equipment_id'),
            ));

            if (empty($equipmentIds)) {
                continue;
            }

            $conflictingRequests = FacilityRequest::whereIn('status', $statuses)
                ->where('on_hold', false)
                ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId))
                ->whereHas('equipment', fn ($q) => $q->whereIn('equipments.id', $equipmentIds))
                ->whereHas(
                    'requestFacilities',
                    fn ($q) => $q
                        ->where('date_requested', $date)
                        ->where('time_start', '<', $timeEnd)
                        ->where('time_end', '>', $timeStart)
                )
                ->with(['user', 'equipment'])
                ->get();

            foreach ($conflictingRequests as $conflicting) {
                $overlappingEquipmentIds = $conflicting->equipment
                    ->pluck('id')
                    ->intersect($equipmentIds)
                    ->values();

                foreach ($overlappingEquipmentIds as $eqId) {
                    $conflicts[] = [
                        'request_id' => $conflicting->id,
                        'request_title' => $conflicting->title,
                        'requester' => $conflicting->user->name,
                        'equipment_id' => $eqId,
                        'equipment_name' => $conflicting->equipment->firstWhere('id', $eqId)?->name,
                        'status' => $conflicting->status,
                        'date' => $date,
                        'time_start' => $timeStart,
                        'time_end' => $timeEnd,
                    ];
                }
            }
        }

        return $conflicts;
    }

    private function loadEquipmentConflictRelations(FacilityRequest $request): void
    {
        $allIds = array_unique(array_merge(
            $request->pending_equipment_conflict_request_ids ?? [],
            $request->approved_equipment_conflict_request_ids ?? [],
        ));

        $conflictRequests = $allIds
            ? FacilityRequest::whereIn('id', $allIds)
                ->with(['user', 'equipment', 'requestFacilities.facility'])
                ->get()
                ->keyBy('id')
            : collect();

        $request->setRelation(
            'pending_equipment_conflicts',
            collect($request->pending_equipment_conflict_request_ids ?? [])
                ->map(fn ($id) => $conflictRequests->get($id))
                ->filter()->values()
        );

        $request->setRelation(
            'approved_equipment_conflicts',
            collect($request->approved_equipment_conflict_request_ids ?? [])
                ->map(fn ($id) => $conflictRequests->get($id))
                ->filter()->values()
        );
    }

    private function attachPerFacilityEquipment(FacilityRequest $request): void
    {
        $sourceFacilities = $request->equipment
            ->flatMap(fn ($eq) => $eq->facilities)
            ->keyBy('id');

        foreach ($request->requestFacilities as $rf) {
            $ownEquipment = $request->equipment
                ->filter(
                    fn ($eq) => ! $eq->pivot->is_borrowed &&
                        $eq->facilities->contains('id', $rf->facility_id)
                )
                ->map(fn ($eq) => [
                    'equipment_id' => $eq->id,
                    'equipment_name' => $eq->name,
                    'quantity_needed' => $eq->pivot->quantity_needed,
                    'max_quantity' => $eq->facilities
                        ->firstWhere('id', $rf->facility_id)
                        ?->pivot->quantity ?? $eq->quantity,
                ])->values();

            $borrowedEquipment = $request->equipment
                ->filter(fn ($eq) => (bool) $eq->pivot->is_borrowed)
                ->map(fn ($eq) => [
                    'equipment_id' => $eq->id,
                    'equipment_name' => $eq->name,
                    'source_facility_id' => $eq->pivot->source_facility_id,
                    'source_facility_name' => $sourceFacilities->get($eq->pivot->source_facility_id)?->name ?? '',
                    'quantity_needed' => $eq->pivot->quantity_needed,
                    'max_quantity' => $eq->pivot->quantity_needed,
                ])->values();

            $rf->setRelation('equipment', $ownEquipment);
            $rf->setRelation('borrowed_equipment', $borrowedEquipment);
        }
    }
}
