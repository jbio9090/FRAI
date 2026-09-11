<?php

namespace App\Services;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RequestService
{
    /**
     * Statuses that block a slot for conflict detection. Conditionally
     * Approved occupies the slot just like Approved, so every detection
     * and approve-time scan must include it.
     */
    public const BLOCKING_STATUSES = [
        RequestStatus::PENDING,
        RequestStatus::APPROVED,
        RequestStatus::CONDITIONALLY_APPROVED,
    ];

    public function __construct(
        protected AuditLogger $auditLogger,
    ) {}

    /**
     * Normalize stored conflict id arrays (JSON casts mix ints and strings).
     *
     * @return array<int>
     */
    public static function normalizeConflictIds(mixed $ids): array
    {
        if (! is_array($ids)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', $ids)));
    }

    public function get(
        ?array $statuses,
        string $filter = 'this_week',
        ?string $search = null,
        ?string $sort = null,
        string $order = 'asc',
        ?string $requester = null,
        ?string $facility = null,
        ?string $hasExternalEquipment = null,
        ?bool $hasPendingConflicts = false,
        ?bool $hasApprovedConflicts = false,
    ) {
        $user = Auth::user();
        $order = in_array($order, ['asc', 'desc']) ? $order : 'asc';

        $query = $user->hasRole(['admin', 'Super Admin'])
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
            // Accept arrays or Collections of BackedEnum instances or raw values
            $statusArray = is_array($statuses) ? $statuses : (is_iterable($statuses) ? (array) $statuses : [$statuses]);
            $statusValues = array_map(fn ($s) => $s instanceof \BackedEnum ? $s->value : $s, $statusArray);

            // Match requests whose parent status matches OR any child request facility has the status
            $query->where(function ($q) use ($statusValues) {
                $q->whereIn('requests.status', $statusValues)
                    ->orWhereHas('requestFacilities', fn ($q2) => $q2->whereIn('status', $statusValues));
            });
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

        if ($hasPendingConflicts) {
            $query->whereJsonLength('requests.pending_conflict_rf_ids', '>', 0);
        }

        if ($hasApprovedConflicts) {
            $query->whereJsonLength('requests.approved_conflict_rf_ids', '>', 0);
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

    public function getForUser(
        int $userId,
        ?array $statuses,
        string $filter = 'this_week',
        ?string $search = null,
        ?string $sort = null,
        string $order = 'asc',
        int $perPage = 15,
    ) {
        $user = Auth::user();
        $order = in_array($order, ['asc', 'desc']) ? $order : 'asc';

        $query = $user->hasRole(['admin', 'Super Admin'])
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
            ])->where('requests.user_id', $userId);

        $query->where('requests.user_id', $userId);

        $query = match ($filter) {
            'today' => $query->whereDate('requests.updated_at', Carbon::today()),
            'this_week' => $query->where('requests.updated_at', '>=', Carbon::now()->subWeek()),
            'this_month' => $query->where('requests.updated_at', '>=', Carbon::now()->subMonth()),
            default => $query,
        };

        if (! empty($statuses)) {
            $statusArray = is_array($statuses) ? $statuses : (is_iterable($statuses) ? (array) $statuses : [$statuses]);
            $statusValues = array_map(fn ($s) => $s instanceof \BackedEnum ? $s->value : $s, $statusArray);

            $query->where(function ($q) use ($statusValues) {
                $q->whereIn('requests.status', $statusValues)
                    ->orWhereHas('requestFacilities', fn ($q2) => $q2->whereIn('status', $statusValues));
            });
        }

        if ($search) {
            $query->where('title', 'like', "%{$search}%");
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

        $paginated = $query->paginate($perPage);

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
            'files',
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

            // Detect before any approval: approve() puts losers on hold, and
            // on-hold requests are excluded from scans, so detecting after
            // would come back empty and mislabel the buckets.
            $this->detectAndStoreConflicts($facilityRequest);

            if ($priorityLevel === PriorityLevel::Government) {
                $approved = $this->approve($facilityRequest->id);

                return $approved->fresh() ?? $approved;
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

            // Self-resubmit after a conflict hold: a hold with a holder is a
            // "go reschedule" signal, and resubmitting is exactly that — so
            // release it and recompute conflicts from scratch. A manual hold
            // (no holder) still blocks editing.
            if ($facilityRequest->on_hold && $facilityRequest->held_by_request_id !== null) {
                $facilityRequest->update([
                    'on_hold' => false,
                    'held_by_request_id' => null,
                ]);
            }

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
            $deletedRfIds = $facilityRequest->requestFacilities()->pluck('id')->toArray();
            $facilityRequest->requestFacilities()->delete();

            $keptIds = array_map('intval', $validated['existing_file_ids'] ?? []);
            foreach ($facilityRequest->files as $file) {
                if (! in_array($file->id, $keptIds)) {
                    try {
                        app(\App\Services\StorageService::class)->deleteByPath($file->path);
                    } catch (\Throwable $e) {
                        // ignore
                    }
                    $this->auditLogger::requestFileRemoved($facilityRequest, $file);
                    $file->delete();
                }
            }

            if (! empty($validated['files'])) {
                $this->handleFileUploads($facilityRequest, $validated['files']);
            }

            $this->syncBookingsAndEquipment($facilityRequest, $validated['facility_bookings']);

            $this->purgeDeletedConflictRefs($deletedRfIds, $facilityRequest->id);

            $facilityRequest->load('requestFacilities.facility');

            $this->detectAndStoreConflicts($facilityRequest);

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
        foreach ($bookings as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

            // 1. Create the facility line-item
            $requestFacility = $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $dateOnly,
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
                'expected_capacity' => $booking['expected_capacity'] ?? null,
                'has_outsiders' => $booking['has_outsiders'] ?? false,
            ]);

            // 2. Attach external equipment in a single bulk insert
            $externalItems = collect($booking['external_equipment'] ?? [])
                ->map(fn ($externalItem) => ['name' => $externalItem['name']])
                ->all();

            if ($externalItems) {
                $requestFacility->externalEquipments()->createMany($externalItems);
            }

            // 3. Attach standard + borrowed equipment in a single bulk insert
            $equipmentRows = [];

            foreach ($booking['equipment'] ?? [] as $equipment) {
                $equipmentRows[] = [
                    'request_id' => $facilityRequest->id,
                    'request_facility_id' => $requestFacility->id,
                    'equipment_id' => $equipment['equipment_id'],
                    'quantity_needed' => $equipment['quantity_needed'],
                    'is_borrowed' => false,
                    'source_facility_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            foreach ($booking['borrowed_equipment'] ?? [] as $equipment) {
                $equipmentRows[] = [
                    'request_id' => $facilityRequest->id,
                    'request_facility_id' => $requestFacility->id,
                    'equipment_id' => $equipment['equipment_id'],
                    'quantity_needed' => $equipment['quantity_needed'],
                    'is_borrowed' => true,
                    'source_facility_id' => $equipment['source_facility_id'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            if ($equipmentRows) {
                DB::table('request_equipment')->insert($equipmentRows);
            }
        }
    }

    public function checkForConflicts(array $bookings, ?array $statuses = null, ?int $excludeRequestId = null, ?bool $crossFacility = false): array
    {
        $conflicts = [];

        if ($statuses === null) {
            $statuses = [RequestStatus::APPROVED];
        }

        // Enhance status enum conversion to always produce plain strings
        $statusValues = collect($statuses)->map(function ($s) {
            if ($s instanceof RequestStatus) {
                return $s->value;
            }
            if (is_string($s)) {
                return $s;
            }

            return (string) $s;
        })->toArray();
        $facilityIds = collect($bookings)->pluck('facility_id')->unique();
        $dates = collect($bookings)->pluck('date')->map(fn ($d) => Carbon::parse($d)->format('Y-m-d'))->unique();

        // Build query - optionally skip facility filtering for cross-facility checks
        $query = RequestFacility::whereIn('date_requested', $dates)
            ->whereIn('status', $statusValues)
            ->whereHas('request', function ($query) use ($excludeRequestId) {
                $query->where('on_hold', false)
                    ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId));
            })
            ->with(['facility', 'request']);

        // Only filter by facility_id when not doing cross-facility check
        if (! $crossFacility) {
            $query->whereIn('facility_id', $facilityIds);
        }

        $existingBookings = $query->get();

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
                    // Classify by the booking row's own status: per-facility
                    // decisions can leave it diverged from the parent request.
                    $status = $existing->status ?? $existing->request?->status;
                    $statusValue = $status instanceof RequestStatus ? $status->value : $status;
                    $conflicts[] = [
                        'request_id' => $existing->request_id,
                        'request_facility_id' => $existing->id,
                        'request_title' => $existing->request?->title ?? $existing->title,
                        'date' => $existing->date_requested,
                        'time_start' => $existing->time_start,
                        'time_end' => $existing->time_end,
                        'status' => $statusValue,
                        'message' => sprintf(
                            'Time conflict for %s on %s: Your booking (%s - %s) overlaps with an existing %s booking (%s - %s)',
                            $existing->facility->name,
                            Carbon::parse($requestedDate)->format('F j, Y'),
                            $requestedStart->format('g:i A'),
                            $requestedEnd->format('g:i A'),
                            strtolower($statusValue),
                            $existingStart->format('g:i A'),
                            $existingEnd->format('g:i A')
                        ),
                    ];
                }
            }
        }

        return $conflicts;
    }

    public function detectAndStoreConflicts(FacilityRequest $request): void
    {
        $request->loadMissing([
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment' => fn ($q) => $q->withPivot(['quantity_needed', 'is_borrowed', 'source_facility_id']),
            'equipment.facilities',
        ]);

        $this->attachPerFacilityEquipment($request);

        $bookings = $request->requestFacilities->map(fn ($rf) => [
            'facility_id' => $rf->facility_id,
            'date' => $rf->date_requested,
            'time_start' => $rf->time_start,
            'time_end' => $rf->time_end,
            'equipment' => $rf->equipment?->toArray() ?? [],
            'borrowed_equipment' => $rf->borrowed_equipment?->toArray() ?? [],
            'external_equipment' => $rf->externalEquipments?->toArray() ?? [],
        ])->toArray();

        $conflicts = $this->checkForConflicts(
            $bookings,
            self::BLOCKING_STATUSES,
            $request->id
        );

        $pendingConflicts = collect($conflicts)->filter(fn ($c) => $c['status'] === RequestStatus::PENDING->value)->values();
        // Approved and Conditionally Approved both occupy the slot.
        $approvedConflicts = collect($conflicts)->filter(fn ($c) => in_array($c['status'], [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value], true))->values();

        $pendingConflictRfIds = self::normalizeConflictIds($pendingConflicts->pluck('request_facility_id')->all());
        $approvedConflictRfIds = self::normalizeConflictIds($approvedConflicts->pluck('request_facility_id')->all());

        $equipmentConflicts = $this->checkForEquipmentConflicts(
            $bookings,
            self::BLOCKING_STATUSES,
            $request->id
        );

        $pendingEquipmentConflicts = collect($equipmentConflicts)->filter(fn ($c) => $c['status'] === RequestStatus::PENDING->value)->values();
        $approvedEquipmentConflicts = collect($equipmentConflicts)->filter(fn ($c) => in_array($c['status'], [RequestStatus::APPROVED->value, RequestStatus::CONDITIONALLY_APPROVED->value], true))->values();

        $pendingEquipmentRequestIds = self::normalizeConflictIds($pendingEquipmentConflicts->pluck('request_id')->all());
        $approvedEquipmentRequestIds = self::normalizeConflictIds($approvedEquipmentConflicts->pluck('request_id')->all());

        $request->update([
            'pending_conflict_rf_ids' => $pendingConflictRfIds,
            'approved_conflict_rf_ids' => $approvedConflictRfIds,
            'pending_equipment_conflict_request_ids' => $pendingEquipmentRequestIds,
            'approved_equipment_conflict_request_ids' => $approvedEquipmentRequestIds,
        ]);

        $savedRequestRfIds = $request->requestFacilities()->pluck('id')->map(fn ($id) => (int) $id)->all();

        $pendingConflicts
            ->pluck('request_id')
            ->unique()
            ->each(function ($conflictingRequestId) use ($savedRequestRfIds) {
                $conflictingRequest = FacilityRequest::find($conflictingRequestId);
                if (! $conflictingRequest) {
                    return;
                }

                $existing = self::normalizeConflictIds($conflictingRequest->pending_conflict_rf_ids ?? []);
                $merged = array_values(array_unique(array_merge($existing, $savedRequestRfIds)));

                $conflictingRequest->update([
                    'pending_conflict_rf_ids' => $merged,
                    'recommended_action' => RequestStatus::FOR_RESCHEDULE,
                    'recommended_action_reason' => 'Time conflict with pending requests',
                ]);
            });

        // Promote equipment conflicts to the other side, mirroring time
        // conflicts: only the pending side records the ids.
        $pendingEquipmentConflicts
            ->pluck('request_id')
            ->unique()
            ->each(function ($conflictingRequestId) use ($request) {
                $conflictingRequest = FacilityRequest::find($conflictingRequestId);
                if (! $conflictingRequest) {
                    return;
                }

                $existing = self::normalizeConflictIds($conflictingRequest->pending_equipment_conflict_request_ids ?? []);
                $merged = array_values(array_unique(array_merge($existing, [(int) $request->id])));

                if ($merged !== $existing) {
                    $conflictingRequest->update([
                        'pending_equipment_conflict_request_ids' => $merged,
                    ]);
                }
            });

        $this->removeStalePendingConflictRefs($request, $pendingConflictRfIds, $pendingEquipmentRequestIds);
    }

    private function removeStalePendingConflictRefs(FacilityRequest $saved_request, array $currentPendingRfIds, array $currentPendingEquipmentRequestIds = []): void
    {
        $savedRfIds = $saved_request->requestFacilities()->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (empty($savedRfIds)) {
            return;
        }

        // Map the saved request's still-conflicting RF ids to their owning
        // request ids in one query instead of an EXISTS query per candidate.
        $stillConflictingRequestIds = RequestFacility::whereIn('id', $currentPendingRfIds)
            ->pluck('request_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $candidateRequests = FacilityRequest::where('id', '!=', $saved_request->id)
            ->whereNotNull('pending_conflict_rf_ids')
            ->get()
            ->filter(fn ($r) => ! empty(array_intersect(self::normalizeConflictIds($r->pending_conflict_rf_ids ?? []), $savedRfIds)));

        foreach ($candidateRequests as $candidate) {
            if (in_array((int) $candidate->id, $stillConflictingRequestIds, true)) {
                continue;
            }

            $candidate->update([
                'pending_conflict_rf_ids' => array_values(array_diff(self::normalizeConflictIds($candidate->pending_conflict_rf_ids ?? []), $savedRfIds)),
            ]);
        }

        // Prune this request's id from other requests' pending equipment
        // conflict lists when it is no longer an equipment conflict for them.
        $equipmentCandidates = FacilityRequest::where('id', '!=', $saved_request->id)
            ->whereNotNull('pending_equipment_conflict_request_ids')
            ->get()
            ->filter(fn ($r) => in_array((int) $saved_request->id, self::normalizeConflictIds($r->pending_equipment_conflict_request_ids ?? []), true));

        foreach ($equipmentCandidates as $candidate) {
            if (in_array((int) $candidate->id, array_map('intval', $currentPendingEquipmentRequestIds), true)) {
                continue;
            }

            $candidate->update([
                'pending_equipment_conflict_request_ids' => array_values(array_diff(
                    self::normalizeConflictIds($candidate->pending_equipment_conflict_request_ids ?? []),
                    [(int) $saved_request->id]
                )),
            ]);
        }
    }

    private function purgeDeletedConflictRefs(array $deletedRfIds, int $excludeRequestId): void
    {
        if (empty($deletedRfIds)) {
            return;
        }

        FacilityRequest::where('id', '!=', $excludeRequestId)
            ->where(function ($query) {
                $query->whereNotNull('pending_conflict_rf_ids')
                    ->orWhereNotNull('approved_conflict_rf_ids');
            })
            ->get(['id', 'pending_conflict_rf_ids', 'approved_conflict_rf_ids'])
            ->each(function ($candidate) use ($deletedRfIds) {
                $pending = array_values(array_diff($candidate->pending_conflict_rf_ids ?? [], $deletedRfIds));
                $approved = array_values(array_diff($candidate->approved_conflict_rf_ids ?? [], $deletedRfIds));

                if ($pending !== ($candidate->pending_conflict_rf_ids ?? []) || $approved !== ($candidate->approved_conflict_rf_ids ?? [])) {
                    $candidate->update([
                        'pending_conflict_rf_ids' => $pending,
                        'approved_conflict_rf_ids' => $approved,
                    ]);
                }
            });
    }

    /**
     * Strip a request's references out of every other request's stored
     * conflict arrays. Called when the request leaves the blocking pool
     * (denied, marked for reschedule) so ghosts don't linger.
     */
    public function clearConflictRefsForRequest(FacilityRequest $request): void
    {
        $rfIds = $request->requestFacilities()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $requestId = (int) $request->id;

        $candidates = FacilityRequest::where('id', '!=', $request->id)
            ->where(function ($query) {
                $query->whereNotNull('pending_conflict_rf_ids')
                    ->orWhereNotNull('approved_conflict_rf_ids')
                    ->orWhereNotNull('pending_equipment_conflict_request_ids')
                    ->orWhereNotNull('approved_equipment_conflict_request_ids');
            })
            ->get(['id', 'pending_conflict_rf_ids', 'approved_conflict_rf_ids', 'pending_equipment_conflict_request_ids', 'approved_equipment_conflict_request_ids', 'recommended_action', 'recommended_action_reason']);

        foreach ($candidates as $candidate) {
            $pending = array_values(array_diff(self::normalizeConflictIds($candidate->pending_conflict_rf_ids ?? []), $rfIds));
            $approved = array_values(array_diff(self::normalizeConflictIds($candidate->approved_conflict_rf_ids ?? []), $rfIds));
            $pendingEquipment = array_values(array_diff(self::normalizeConflictIds($candidate->pending_equipment_conflict_request_ids ?? []), [$requestId]));
            $approvedEquipment = array_values(array_diff(self::normalizeConflictIds($candidate->approved_equipment_conflict_request_ids ?? []), [$requestId]));

            $payload = [
                'pending_conflict_rf_ids' => $pending,
                'approved_conflict_rf_ids' => $approved,
                'pending_equipment_conflict_request_ids' => $pendingEquipment,
                'approved_equipment_conflict_request_ids' => $approvedEquipment,
            ];

            if (empty($pending) && empty($approved) && empty($pendingEquipment) && empty($approvedEquipment)) {
                $payload['recommended_action'] = null;
                $payload['recommended_action_reason'] = null;
            }

            $candidate->update($payload);
        }
    }

    /**
     * Release requests held by the given holder (approved request denied or
     * sent back for reschedule): clear the hold flags so they re-enter
     * conflict scans. Status and history are left for admin review.
     *
     * @return Collection<int, FacilityRequest> the requests that were released.
     */
    public function releaseHeldRequests(int $holderId): Collection
    {
        $released = FacilityRequest::where('held_by_request_id', $holderId)
            ->where('on_hold', true)
            ->get();

        if ($released->isEmpty()) {
            return collect();
        }

        FacilityRequest::where('held_by_request_id', $holderId)
            ->where('on_hold', true)
            ->update([
                'on_hold' => false,
                'held_by_request_id' => null,
            ]);

        return $released;
    }

    /**
     * Move a newly approved request's slot ids from every other request's
     * pending buckets to its approved buckets (time + equipment). Approval
     * does not hold pending time-overlaps, so without this sweep their
     * stored buckets would describe an approved request as pending forever.
     */
    private function migrateConflictBucketsForApproval(FacilityRequest $approvedRequest): void
    {
        $winnerRfIds = $approvedRequest->requestFacilities()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $winnerId = (int) $approvedRequest->id;

        if (empty($winnerRfIds)) {
            return;
        }

        $candidates = FacilityRequest::where('id', '!=', $approvedRequest->id)
            ->where(function ($query) {
                $query->whereNotNull('pending_conflict_rf_ids')
                    ->orWhereNotNull('pending_equipment_conflict_request_ids');
            })
            ->get(['id', 'pending_conflict_rf_ids', 'approved_conflict_rf_ids', 'pending_equipment_conflict_request_ids', 'approved_equipment_conflict_request_ids']);

        foreach ($candidates as $candidate) {
            $pending = self::normalizeConflictIds($candidate->pending_conflict_rf_ids ?? []);
            $move = array_values(array_intersect($pending, $winnerRfIds));

            $pendingEquipment = self::normalizeConflictIds($candidate->pending_equipment_conflict_request_ids ?? []);
            $moveEquipment = in_array($winnerId, $pendingEquipment, true);

            if (empty($move) && ! $moveEquipment) {
                continue;
            }

            $payload = [];
            if (! empty($move)) {
                $payload['pending_conflict_rf_ids'] = array_values(array_diff($pending, $winnerRfIds));
                $payload['approved_conflict_rf_ids'] = array_values(array_unique(array_merge(
                    self::normalizeConflictIds($candidate->approved_conflict_rf_ids ?? []),
                    $move
                )));
            }
            if ($moveEquipment) {
                $payload['pending_equipment_conflict_request_ids'] = array_values(array_diff($pendingEquipment, [$winnerId]));
                $approvedEquipment = self::normalizeConflictIds($candidate->approved_equipment_conflict_request_ids ?? []);
                if (! in_array($winnerId, $approvedEquipment, true)) {
                    $approvedEquipment[] = $winnerId;
                }
                $payload['approved_equipment_conflict_request_ids'] = array_values($approvedEquipment);
            }

            $candidate->update($payload);
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

            foreach ($request->requestFacilities as $rf) {
                if ($rf->status !== RequestStatus::DENIED) { // Don't override already denied items
                    $rf->update(['status' => RequestStatus::APPROVED]);
                    // Push into conflict handler array to resolve all at once
                }
            }

            $request->update([
                'status' => RequestStatus::APPROVED,
                'on_hold' => false,
                'held_by_request_id' => null,
                'processed_by' => Auth::id(),
                'processed_at' => Carbon::now(),
            ]);

            $this->auditLogger::requestApproved($request);

            // Collect every request displaced by this approval so callers can
            // notify each affected owner (winner + losers + equipment losers).
            $affectedRequestIds = collect();

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
                $affectedRequestIds->push($conflicting->id);
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
                $affectedRequestIds->push($conflicting->id);
            }

            // The winner is now Approved: relabel its slot ids in every other
            // request's pending buckets as approved buckets (Option 1: migrate).
            $this->migrateConflictBucketsForApproval($request);

            $fresh = $request->fresh();
            $fresh->setAttribute('held_request_ids', $affectedRequestIds->unique()->values()->all());

            return $fresh;
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
                ->whereIn('status', [RequestStatus::APPROVED, RequestStatus::CONDITIONALLY_APPROVED])
                ->whereHas('request', function ($query) use ($excludeRequestId) {
                    $query->where('on_hold', false)
                        ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId));
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
            // Store locally first so the request can return quickly; the
            // ProcessRequestFiles job migrates the file to Cloudinary off-request.
            $path = $file->store('request-files', 'public');

            $requestFile = $facilityRequest->files()->create([
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
            ]);

            $this->auditLogger::requestFileUploaded($facilityRequest, $requestFile);

            \App\Jobs\ProcessRequestFiles::dispatch($requestFile);
        }
    }

    public function deleteFiles(FacilityRequest $facilityRequest): void
    {
        foreach ($facilityRequest->files as $file) {
            try {
                app(\App\Services\StorageService::class)->deleteByPath($file->path);
            } catch (\Throwable $e) {
                // ignore deletion errors
            }

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

    /**
     * Admin status transition for non-approve decisions (deny, conditional
     * approval, reschedule). Flips parent + facility rows together and, when
     * the request leaves the blocking pool, strips its references out of
     * other requests' conflict arrays and releases requests it was holding.
     */
    public function applyStatusTransition(int $id, RequestStatus $status): FacilityRequest
    {
        return DB::transaction(function () use ($id, $status) {
            $request = FacilityRequest::lockForUpdate()->findOrFail($id);
            $request->update([
                'status' => $status,
                'processed_by' => Auth::id(),
                'processed_at' => now(),
            ]);
            $request->requestFacilities()->update(['status' => $status]);

            if (in_array($status, [RequestStatus::DENIED, RequestStatus::FOR_RESCHEDULE], true)) {
                $this->clearConflictRefsForRequest($request->fresh());
                $releasedIds = $this->releaseHeldRequests($request->id)->pluck('id')->all();
            }

            match ($status) {
                RequestStatus::DENIED => $this->auditLogger::requestDenied($request),
                RequestStatus::CONDITIONALLY_APPROVED => $this->auditLogger::requestConditionallyApproved($request),
                RequestStatus::FOR_RESCHEDULE => $this->auditLogger::requestMarkedForReschedule($request),
                default => null,
            };

            $fresh = $request->fresh();
            // Requests un-held by this transition so callers can notify
            // owners whose hold was lifted.
            $fresh->setAttribute('released_request_ids', $releasedIds ?? []);

            return $fresh;
        });
    }

    /**
     * Manual hold toggle. Releasing a conflict hold also drops the holder
     * link so the request doesn't linger as a phantom blocker.
     */
    public function toggleHold(int $id): FacilityRequest
    {
        return DB::transaction(function () use ($id) {
            $request = FacilityRequest::lockForUpdate()->findOrFail($id);
            $onHold = ! $request->on_hold;
            $request->update([
                'on_hold' => $onHold,
                'held_by_request_id' => $onHold ? $request->held_by_request_id : null,
            ]);
            $this->auditLogger::requestHoldToggled($request, $onHold);

            return $request->fresh();
        });
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

        $target->comments()->create([
            'user_id' => Auth::id(),
            'body' => 'Marked for reschedule — '.$reason,
        ]);

        $this->auditLogger::requestHeld($target, $heldBy);
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
            'status' => $detail->status->value,
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

                    $dateOnly = Carbon::parse($rf->date_requested)->format('Y-m-d');
                    $timeStart = substr($rf->time_start, 0, 5);
                    $timeEnd = substr($rf->time_end, 0, 5);

                    $scheduleConflicts = RequestFacility::where('facility_id', $rf->facility_id)
                        ->where('date_requested', $dateOnly)
                        ->where('id', '!=', $rf->id)
                        ->whereIn('status', [RequestStatus::PENDING, RequestStatus::APPROVED, RequestStatus::CONDITIONALLY_APPROVED])
                        ->where('time_start', '<', $timeEnd)
                        ->where('time_end', '>', $timeStart)
                        ->whereHas('request', fn ($q) => $q->where('on_hold', false)->where('id', '!=', $detail->id))
                        ->with('request')
                        ->get()
                        ->map(fn ($conflictRf) => [
                            'request_id' => $conflictRf->request_id,
                            'request_title' => $conflictRf->request->title ?? '',
                            'status' => $conflictRf->request->status,
                            'time_start' => substr($conflictRf->time_start, 0, 5),
                            'time_end' => substr($conflictRf->time_end, 0, 5),
                        ])
                        ->values();

                    return [
                        'facility_id' => $rf->facility_id,
                        'facility_name' => $rf->facility->name ?? '',
                        'date' => $rf->date_requested,
                        'time_start' => $rf->time_start,
                        'time_end' => $rf->time_end,
                        'expected_capacity' => $rf->expected_capacity,
                        'facility_capacity' => $rf->facility->capacity ?? null,
                        'external_equipment' => $rf->externalEquipments->map(fn ($e) => ['name' => $e->name])->values(),
                        'equipment' => $ownEquipment,
                        'borrowed_equipment' => $borrowedEquipment,
                        'conflicts' => $scheduleConflicts,
                        'has_outsiders' => (bool) $rf->has_outsiders,
                        'request_facility_status' => $rf->status?->value,
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
                        // Normalize: status is enum-cast on the model, but
                        // consumers partition on plain string values.
                        'status' => $conflicting->status instanceof RequestStatus ? $conflicting->status->value : $conflicting->status,
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

    public function approveFacility(int $requestFacilityId): RequestFacility
    {
        return DB::transaction(function () use ($requestFacilityId) {
            $rf = RequestFacility::with('request')->lockForUpdate()->findOrFail($requestFacilityId);
            // Lock the parent so concurrent facility decisions can't interleave.
            $rf->request()->lockForUpdate()->firstOrFail();
            $rf->update(['status' => RequestStatus::APPROVED]);
            $affected = $this->handleFacilityLevelConflicts($rf->fresh());
            $affected = $affected->merge($this->displaceEquipmentForFacility($rf->fresh()))->unique()->values();
            $this->syncParentRequestStatus($rf->request()->firstOrFail());
            $this->migrateConflictBucketsForFacilityApproval($rf->fresh());
            // Loser parent ids displaced by this single-facility approval so
            // callers can notify each affected owner.
            $rf->setAttribute('held_request_ids', $affected->all());

            return $rf;
        });
    }

    /**
     * Recompute a parent request's aggregate status from its facility rows
     * (for per-facility decisions made outside approveFacility).
     */
    public function refreshParentStatus(int $requestId): FacilityRequest
    {
        return DB::transaction(function () use ($requestId) {
            $request = FacilityRequest::lockForUpdate()->findOrFail($requestId);
            $this->syncParentRequestStatus($request->fresh());

            return $request->fresh();
        });
    }

    private function syncParentRequestStatus(FacilityRequest $request): void
    {
        $facilities = $request->requestFacilities;
        $total = $facilities->count();
        $approved = $facilities->where('status', RequestStatus::APPROVED)->count();
        $denied = $facilities->where('status', RequestStatus::DENIED)->count();
        $conditionallyApproved = $facilities->where('status', RequestStatus::CONDITIONALLY_APPROVED)->count();
        $forReschedule = $facilities->where('status', RequestStatus::FOR_RESCHEDULE)->count();

        if ($approved === $total) {
            $newStatus = RequestStatus::APPROVED;
        } elseif ($denied === $total) {
            $newStatus = RequestStatus::DENIED;
        } elseif ($approved > 0) {
            $newStatus = RequestStatus::PARTIALLY_APPROVED;
        } elseif ($conditionallyApproved === $total && $total > 0) {
            $newStatus = RequestStatus::CONDITIONALLY_APPROVED;
        } elseif ($forReschedule > 0) {
            $newStatus = RequestStatus::FOR_RESCHEDULE;
        } else {
            $newStatus = RequestStatus::PENDING;
        }

        $request->update(['status' => $newStatus]);
    }

    /**
     * Time-conflict overwrite scoped to a single approved facility row: flip
     * only the overlapping loser rows to For Reschedule and hold their
     * parents (which resync to Partially Approved when sibling rows are
     * unaffected) instead of holding whole requests.
     *
     * @return Collection<int, int> affected loser parent request ids.
     */
    private function handleFacilityLevelConflicts(RequestFacility $approvedRf): Collection
    {
        $approvedRf->loadMissing('facility', 'request');

        $booking = [
            [
                'facility_id' => $approvedRf->facility_id,
                'date' => $approvedRf->date_requested,
                'time_start' => $approvedRf->time_start,
                'time_end' => $approvedRf->time_end,
            ],
        ];

        $conflictingRfs = $this->getConflictingApprovedFacilities($booking, $approvedRf->request_id);

        $affectedIds = collect();

        if ($conflictingRfs->isEmpty()) {
            return $affectedIds;
        }

        $winner = $approvedRf->request;
        $reason = 'Conflict with approved facility: '.$approvedRf->facility->name
            .' on '.Carbon::parse($approvedRf->date_requested)->format('F j, Y');

        foreach ($conflictingRfs->groupBy('request_id')->sortKeys() as $loserRequestId => $rfs) {
            if ((int) $loserRequestId === (int) $approvedRf->request_id) {
                continue;
            }

            $loser = FacilityRequest::lockForUpdate()->find($loserRequestId);

            if (! $loser || $loser->on_hold) {
                continue;
            }

            foreach ($rfs as $loserRf) {
                if (! in_array($loserRf->status, [RequestStatus::APPROVED, RequestStatus::CONDITIONALLY_APPROVED], true)) {
                    continue;
                }

                $loserRf->update(['status' => RequestStatus::FOR_RESCHEDULE]);
            }

            $this->putOnHold($loser, $winner, $reason);
            $this->syncParentRequestStatus($loser->fresh());
            $affectedIds->push($loser->id);
        }

        return $affectedIds;
    }

    /**
     * Row-level counterpart of getConflictingApprovedRequests: returns the
     * overlapping approved/conditionally-approved facility rows (with parents)
     * instead of just the parent requests, so single-facility approvals can
     * overwrite only the conflicting rows.
     */
    private function getConflictingApprovedFacilities(array $bookings, int $excludeRequestId): Collection
    {
        $conflictingRfIds = collect();

        foreach ($bookings as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = $this->parseBookingDateTime($dateOnly, $booking['time_start']);
            $requestedEnd = $this->parseBookingDateTime($dateOnly, $booking['time_end']);

            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereIn('status', [RequestStatus::APPROVED, RequestStatus::CONDITIONALLY_APPROVED])
                ->whereHas('request', function ($query) use ($excludeRequestId) {
                    $query->where('on_hold', false)
                        ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId));
                })
                ->with('request')
                ->lockForUpdate()
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = $this->parseBookingDateTime($dateOnly, $existing->time_start);
                $existingEnd = $this->parseBookingDateTime($dateOnly, $existing->time_end);

                if ($requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart)) {
                    $conflictingRfIds->push($existing->id);
                }
            }
        }

        if ($conflictingRfIds->isEmpty()) {
            return collect();
        }

        return RequestFacility::whereIn('id', $conflictingRfIds->unique())->with('request')->get();
    }

    /**
     * Equipment counterpart of handleFacilityLevelConflicts, scoped to a
     * single approved facility row: hold overlapping pending requests whose
     * equipment is no longer available, with comment + audit like approve().
     *
     * @return Collection<int, int> affected loser parent request ids.
     */
    private function displaceEquipmentForFacility(RequestFacility $approvedRf): Collection
    {
        $request = $approvedRf->request;
        $request->loadMissing('equipment');
        $date = Carbon::parse($approvedRf->date_requested)->format('Y-m-d');
        $timeStart = substr($approvedRf->time_start, 0, 5);
        $timeEnd = substr($approvedRf->time_end, 0, 5);

        $affectedIds = collect();

        foreach ($request->equipment as $equipment) {
            if ($equipment->quantityAvailable($date, $timeStart, $timeEnd, null) >= 0) {
                continue;
            }

            $displaced = FacilityRequest::whereIn('status', [RequestStatus::PENDING, RequestStatus::CONDITIONALLY_APPROVED])
                ->where('on_hold', false)
                ->where('id', '!=', $request->id)
                ->whereHas('equipment', fn ($q) => $q->where('equipments.id', $equipment->id))
                ->whereHas('requestFacilities', fn ($q) => $q
                    ->where('date_requested', $date)
                    ->where('time_start', '<', $timeEnd)
                    ->where('time_end', '>', $timeStart))
                ->get();

            foreach ($displaced as $conflicting) {
                if ($conflicting->on_hold) {
                    continue;
                }

                $conflicting->update([
                    'status' => RequestStatus::FOR_RESCHEDULE,
                    'on_hold' => true,
                    'held_by_request_id' => $request->id,
                    'recommended_action' => RequestStatus::DENIED,
                    'recommended_action_reason' => 'Equipment no longer available — superseded by approved facility: "'.$request->title.'"',
                    'processed_by' => null,
                    'processed_at' => null,
                ]);

                $conflicting->comments()->create([
                    'user_id' => Auth::id(),
                    'body' => 'Marked for reschedule — equipment taken by approved facility: "'.$request->title.'"',
                ]);

                $this->auditLogger::requestHeld($conflicting, $request);
                $affectedIds->push($conflicting->id);
            }
        }

        return $affectedIds;
    }

    /**
     * Scoped counterpart of migrateConflictBucketsForApproval for a single
     * approved facility row: only the approved row id (not every sibling row
     * of the winner) moves from pending buckets to approved buckets.
     */
    private function migrateConflictBucketsForFacilityApproval(RequestFacility $approvedRf): void
    {
        $winnerId = (int) $approvedRf->request_id;
        $winnerRfId = (int) $approvedRf->id;

        $candidates = FacilityRequest::where('id', '!=', $winnerId)
            ->where(function ($query) {
                $query->whereNotNull('pending_conflict_rf_ids')
                    ->orWhereNotNull('pending_equipment_conflict_request_ids');
            })
            ->get(['id', 'pending_conflict_rf_ids', 'approved_conflict_rf_ids', 'pending_equipment_conflict_request_ids', 'approved_equipment_conflict_request_ids']);

        foreach ($candidates as $candidate) {
            $pending = self::normalizeConflictIds($candidate->pending_conflict_rf_ids ?? []);
            $move = in_array($winnerRfId, $pending, true);

            $pendingEquipment = self::normalizeConflictIds($candidate->pending_equipment_conflict_request_ids ?? []);
            $moveEquipment = in_array($winnerId, $pendingEquipment, true);

            if (! $move && ! $moveEquipment) {
                continue;
            }

            $payload = [];
            if ($move) {
                $payload['pending_conflict_rf_ids'] = array_values(array_diff($pending, [$winnerRfId]));
                $payload['approved_conflict_rf_ids'] = array_values(array_unique(array_merge(
                    self::normalizeConflictIds($candidate->approved_conflict_rf_ids ?? []),
                    [$winnerRfId]
                )));
            }
            if ($moveEquipment) {
                $payload['pending_equipment_conflict_request_ids'] = array_values(array_diff($pendingEquipment, [$winnerId]));
                $approvedEquipment = self::normalizeConflictIds($candidate->approved_equipment_conflict_request_ids ?? []);
                if (! in_array($winnerId, $approvedEquipment, true)) {
                    $approvedEquipment[] = $winnerId;
                }
                $payload['approved_equipment_conflict_request_ids'] = array_values($approvedEquipment);
            }

            $candidate->update($payload);
        }
    }

    public function isSlotAvailable(int $facilityId, string $date, string $start, string $end): bool
    {
        // Checks for conflicts with both PENDING and APPROVED requests
        // Cross-facility checking enabled to detect conflicts even when facility_id differs
        $conflicts = $this->checkForConflicts(
            [
                [
                    'facility_id' => $facilityId,
                    'date' => $date,
                    'time_start' => $start,
                    'time_end' => $end,
                ],
            ],
            [RequestStatus::PENDING, RequestStatus::APPROVED],
            null,
            true  // Enable cross-facility conflict detection
        );

        return empty($conflicts);
    }
}
