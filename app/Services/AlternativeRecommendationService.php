<?php

namespace App\Services;

use App\Enums\PriorityLevel;
use App\Enums\RequestStatus;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Facility;
use App\Models\Equipment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class AlternativeRecommendationService
{
    private const DATE_RANGE_DAYS = 7;
    private const CACHE_TTL = 300;
    private const MAX_RESULTS_PER_CATEGORY = 5;

    public function __construct(
        protected RequestService $requestService,
    ) {}

    public function findAlternatives(FacilityRequest $request, array $options = []): array
    {
        $includeEquipment = $options['include_equipment'] ?? false;
        $maxResults = $options['max_results'] ?? self::MAX_RESULTS_PER_CATEGORY;

        $cacheKey = $this->buildCacheKey($request->id, $includeEquipment, $maxResults);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($request, $includeEquipment, $maxResults) {
            return $this->computeAlternatives($request, $includeEquipment, $maxResults);
        });
    }

    private function computeAlternatives(FacilityRequest $request, bool $includeEquipment, int $maxResults): array
    {
        $bookingWindow = \App\Services\RequestSettingsService::bookingWindow();
        $minAdvanceDays = \App\Services\RequestSettingsService::minAdvanceDays();

        $higherPriorityPending = $this->getHigherPriorityPendingRequests($request->priority_level->value);
        $equipmentIds = $request->equipment->pluck('id')->toArray();

        $allAlternatives = [];

        foreach ($request->requestFacilities as $rf) {
            $facilityAlternatives = $this->findAlternativesForFacility(
                $rf,
                $request,
                $higherPriorityPending,
                $equipmentIds,
                $bookingWindow,
                $minAdvanceDays,
                $includeEquipment,
                $maxResults
            );

            $allAlternatives[$rf->facility_id] = $facilityAlternatives;
        }

        return [
            'alternatives' => $allAlternatives,
            'metadata' => [
                'include_equipment' => $includeEquipment,
                'max_results' => $maxResults,
                'date_range_days' => self::DATE_RANGE_DAYS,
                'per_facility' => true,
            ],
        ];
    }

    private function findAlternativesForFacility(
        RequestFacility $rf,
        FacilityRequest $request,
        Collection $higherPriorityPending,
        array $equipmentIds,
        array $bookingWindow,
        int $minAdvanceDays,
        bool $includeEquipment,
        int $maxResults
    ): array {
        $originalDate = Carbon::parse($rf->date_requested)->format('Y-m-d');
        $originalStart = substr($rf->time_start, 0, 5);
        $originalEnd = substr($rf->time_end, 0, 5);
        $expectedCapacity = $rf->expected_capacity ?? 0;

        $alternatives = [];

        $alternatives = array_merge($alternatives, $this->findSameFacilityTimeAlternatives(
            $rf->facility_id, $originalDate, $originalStart, $originalEnd,
            $expectedCapacity, $bookingWindow, $higherPriorityPending,
            $equipmentIds, $includeEquipment, $maxResults
        ));

        $alternatives = array_merge($alternatives, $this->findSameFacilityDateAlternatives(
            $rf->facility_id, $originalDate, $originalStart, $originalEnd,
            $expectedCapacity, $bookingWindow, $higherPriorityPending,
            $equipmentIds, $includeEquipment, $minAdvanceDays, $maxResults
        ));

        $alternatives = array_merge($alternatives, $this->findDifferentFacilityAlternatives(
            $rf->facility_id, $originalDate, $originalStart, $originalEnd,
            $expectedCapacity, $bookingWindow, $higherPriorityPending,
            $equipmentIds, $includeEquipment, $maxResults
        ));

        $alternatives = array_merge($alternatives, $this->findDifferentFacilityDateAlternatives(
            $rf->facility_id, $originalDate, $originalStart, $originalEnd,
            $expectedCapacity, $bookingWindow, $higherPriorityPending,
            $equipmentIds, $includeEquipment, $minAdvanceDays, $maxResults
        ));

        return $alternatives;
    }

    private function findSameFacilityTimeAlternatives(
        int $facilityId,
        string $date,
        string $originalStart,
        string $originalEnd,
        int $expectedCapacity,
        array $bookingWindow,
        Collection $higherPriorityPending,
        array $equipmentIds,
        bool $includeEquipment,
        int $maxResults
    ): array {
        $slots = $this->generateTimeSlots($date, $bookingWindow);
        $results = [];

        foreach ($slots as $slot) {
            if (count($results) >= $maxResults) break;

            if ($slot['start'] === $originalStart && $slot['end'] === $originalEnd) {
                continue;
            }

            if ($this->hasHigherPriorityConflict($facilityId, $date, $slot['start'], $slot['end'], $higherPriorityPending)) {
                continue;
            }

            if (!$this->isFacilityAvailable($facilityId, $date, $slot['start'], $slot['end'])) {
                continue;
            }

            if ($includeEquipment && !$this->isEquipmentAvailable($equipmentIds, $date, $slot['start'], $slot['end'])) {
                continue;
            }

            $facility = Facility::find($facilityId);
            if (!$facility) continue;

            $results[] = [
                'facility_id' => $facilityId,
                'facility_name' => $facility->name,
                'facility_capacity' => $facility->capacity,
                'date' => $date,
                'time_start' => $slot['start'],
                'time_end' => $slot['end'],
                'type' => 'same_facility_time',
                'equipment_available' => $this->isEquipmentAvailable($equipmentIds, $date, $slot['start'], $slot['end']),
                'capacity_fit' => $this->buildCapacityLabel($facility->capacity, $expectedCapacity),
            ];
        }

        return $results;
    }

    private function findSameFacilityDateAlternatives(
        int $facilityId,
        string $originalDate,
        string $originalStart,
        string $originalEnd,
        int $expectedCapacity,
        array $bookingWindow,
        Collection $higherPriorityPending,
        array $equipmentIds,
        bool $includeEquipment,
        int $minAdvanceDays,
        int $maxResults
    ): array {
        $results = [];
        $originalDateCarbon = Carbon::parse($originalDate);

        for ($i = 1; $i <= self::DATE_RANGE_DAYS; $i++) {
            if (count($results) >= $maxResults) break;

            foreach ([$originalDateCarbon->copy()->subDays($i), $originalDateCarbon->copy()->addDays($i)] as $candidateDate) {
                if (count($results) >= $maxResults) break;

                $dateStr = $candidateDate->format('Y-m-d');

                if ($candidateDate->diffInDays(Carbon::today(), false) < $minAdvanceDays) {
                    continue;
                }

                if (!in_array($candidateDate->dayOfWeek, $bookingWindow['days_of_week'], true)) {
                    continue;
                }

                if ($this->hasHigherPriorityConflict($facilityId, $dateStr, $originalStart, $originalEnd, $higherPriorityPending)) {
                    continue;
                }

                if (!$this->isFacilityAvailable($facilityId, $dateStr, $originalStart, $originalEnd)) {
                    continue;
                }

                if ($includeEquipment && !$this->isEquipmentAvailable($equipmentIds, $dateStr, $originalStart, $originalEnd)) {
                    continue;
                }

                $facility = Facility::find($facilityId);
                if (!$facility) continue;

                $results[] = [
                    'facility_id' => $facilityId,
                    'facility_name' => $facility->name,
                    'facility_capacity' => $facility->capacity,
                    'date' => $dateStr,
                    'time_start' => $originalStart,
                    'time_end' => $originalEnd,
                    'type' => 'same_facility_date',
                    'equipment_available' => $this->isEquipmentAvailable($equipmentIds, $dateStr, $originalStart, $originalEnd),
                    'capacity_fit' => $this->buildCapacityLabel($facility->capacity, $expectedCapacity),
                ];
            }
        }

        return $results;
    }

    private function findDifferentFacilityAlternatives(
        int $currentFacilityId,
        string $date,
        string $originalStart,
        string $originalEnd,
        int $expectedCapacity,
        array $bookingWindow,
        Collection $higherPriorityPending,
        array $equipmentIds,
        bool $includeEquipment,
        int $maxResults
    ): array {
        $facilities = Facility::where('id', '!=', $currentFacilityId)
            ->where('capacity', '>=', $expectedCapacity)
            ->get();

        $results = [];

        foreach ($facilities as $facility) {
            if (count($results) >= $maxResults) break;

            if ($this->hasHigherPriorityConflict($facility->id, $date, $originalStart, $originalEnd, $higherPriorityPending)) {
                continue;
            }

            if (!$this->isFacilityAvailable($facility->id, $date, $originalStart, $originalEnd)) {
                continue;
            }

            if ($includeEquipment && !$this->isEquipmentAvailable($equipmentIds, $date, $originalStart, $originalEnd)) {
                continue;
            }

            $results[] = [
                'facility_id' => $facility->id,
                'facility_name' => $facility->name,
                'facility_capacity' => $facility->capacity,
                'date' => $date,
                'time_start' => $originalStart,
                'time_end' => $originalEnd,
                'type' => 'different_facility',
                'equipment_available' => $this->isEquipmentAvailable($equipmentIds, $date, $originalStart, $originalEnd),
                'capacity_fit' => $this->buildCapacityLabel($facility->capacity, $expectedCapacity),
            ];
        }

        return $results;
    }

    private function findDifferentFacilityDateAlternatives(
        int $currentFacilityId,
        string $originalDate,
        string $originalStart,
        string $originalEnd,
        int $expectedCapacity,
        array $bookingWindow,
        Collection $higherPriorityPending,
        array $equipmentIds,
        bool $includeEquipment,
        int $minAdvanceDays,
        int $maxResults
    ): array {
        $facilities = Facility::where('id', '!=', $currentFacilityId)
            ->where('capacity', '>=', $expectedCapacity)
            ->get();

        $results = [];
        $originalDateCarbon = Carbon::parse($originalDate);

        for ($i = 1; $i <= self::DATE_RANGE_DAYS; $i++) {
            if (count($results) >= $maxResults) break;

            foreach ([$originalDateCarbon->copy()->subDays($i), $originalDateCarbon->copy()->addDays($i)] as $candidateDate) {
                if (count($results) >= $maxResults) break;

                $dateStr = $candidateDate->format('Y-m-d');

                if ($candidateDate->diffInDays(Carbon::today(), false) < $minAdvanceDays) {
                    continue;
                }

                if (!in_array($candidateDate->dayOfWeek, $bookingWindow['days_of_week'], true)) {
                    continue;
                }

                foreach ($facilities as $facility) {
                    if (count($results) >= $maxResults) break;

                    if ($this->hasHigherPriorityConflict($facility->id, $dateStr, $originalStart, $originalEnd, $higherPriorityPending)) {
                        continue;
                    }

                    if (!$this->isFacilityAvailable($facility->id, $dateStr, $originalStart, $originalEnd)) {
                        continue;
                    }

                    if ($includeEquipment && !$this->isEquipmentAvailable($equipmentIds, $dateStr, $originalStart, $originalEnd)) {
                        continue;
                    }

                    $results[] = [
                        'facility_id' => $facility->id,
                        'facility_name' => $facility->name,
                        'facility_capacity' => $facility->capacity,
                        'date' => $dateStr,
                        'time_start' => $originalStart,
                        'time_end' => $originalEnd,
                        'type' => 'different_facility_date',
                        'equipment_available' => $this->isEquipmentAvailable($equipmentIds, $dateStr, $originalStart, $originalEnd),
                        'capacity_fit' => $this->buildCapacityLabel($facility->capacity, $expectedCapacity),
                    ];
                }
            }
        }

        return $results;
    }

    private function generateTimeSlots(string $date, array $bookingWindow): array
    {
        $slots = [];
        $startTime = Carbon::parse("{$date} {$bookingWindow['start_time']}");
        $endTime = Carbon::parse("{$date} {$bookingWindow['end_time']}");
        $stepMinutes = $bookingWindow['step_minutes'];

        $current = $startTime->copy();
        while ($current->lt($endTime)) {
            $slotEnd = $current->copy()->addMinutes($stepMinutes);
            if ($slotEnd->gt($endTime)) {
                $slotEnd = $endTime->copy();
            }

            $slots[] = [
                'start' => $current->format('H:i'),
                'end' => $slotEnd->format('H:i'),
            ];

            $current = $slotEnd->copy();
        }

        return $slots;
    }

    private function getHigherPriorityPendingRequests(int $priority): Collection
    {
        return FacilityRequest::whereIn('status', [RequestStatus::PENDING])
            ->where('on_hold', false)
            ->whereRaw('priority_level > ?', [$priority])
            ->with('requestFacilities')
            ->get();
    }

    private function hasHigherPriorityConflict(
        int $facilityId,
        string $date,
        string $start,
        string $end,
        Collection $higherPriorityPending
    ): bool {
        foreach ($higherPriorityPending as $pending) {
            foreach ($pending->requestFacilities as $pendingRf) {
                if ($pendingRf->facility_id !== $facilityId) continue;
                if ($pendingRf->date_requested !== $date) continue;

                $pendingStart = substr($pendingRf->time_start, 0, 5);
                $pendingEnd = substr($pendingRf->time_end, 0, 5);

                if ($start < $pendingEnd && $end > $pendingStart) {
                    return true;
                }
            }
        }
        return false;
    }

    private function isFacilityAvailable(int $facilityId, string $date, string $start, string $end): bool
    {
        return $this->requestService->isSlotAvailable($facilityId, $date, $start, $end);
    }

    private function isEquipmentAvailable(array $equipmentIds, string $date, string $start, string $end): bool
    {
        if (empty($equipmentIds)) {
            return true;
        }

        foreach ($equipmentIds as $eqId) {
            $equipment = Equipment::find($eqId);
            if (!$equipment) continue;
            if ($equipment->quantityAvailable($date, $start, $end) <= 0) {
                return false;
            }
        }
        return true;
    }

    private function buildCapacityLabel(int $facilityCapacity, int $expectedCapacity): string
    {
        if ($facilityCapacity === $expectedCapacity) return 'exact';
        return $facilityCapacity > $expectedCapacity ? 'larger' : 'smaller';
    }

    private function buildCacheKey(int $requestId, bool $includeEquipment, int $maxResults): string
    {
        return "alternatives:{$requestId}:eq" . ($includeEquipment ? '1' : '0') . ":max{$maxResults}";
    }
}