<?php

namespace App\Services\Chat;

use App\Models\Equipment;
use App\Models\Facility;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class ChatHelperService
{
    public function normalizePositiveIntValue(mixed $value): ?int
    {
        if (is_int($value) && $value > 0) {
            return $value;
        }

        if (is_string($value)) {
            $candidate = trim($value);
            if ($candidate !== '' && ctype_digit($candidate)) {
                $parsed = (int) $candidate;

                return $parsed > 0 ? $parsed : null;
            }
        }

        if (is_numeric($value)) {
            $parsed = (int) $value;

            return $parsed > 0 ? $parsed : null;
        }

        return null;
    }

    public function normalizeDateValue(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $candidate = trim($value);
        if ($candidate === '') {
            return $value;
        }

        try {
            return Carbon::parse($candidate)->format('Y-m-d');
        } catch (\Exception) {
            return $value;
        }
    }

    public function normalizeTimeValue(mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $candidate = trim($value);
        if ($candidate === '') {
            return $value;
        }

        if (preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $candidate, $matches)) {
            return sprintf('%02d:%02d', (int) $matches[1], (int) $matches[2]);
        }

        $normalizedMeridian = strtoupper(preg_replace('/\s+/', ' ', $candidate));
        foreach (['g:i A', 'g:iA', 'g A', 'gA', 'h:i A', 'h:iA', 'h A', 'hA'] as $format) {
            try {
                return Carbon::createFromFormat($format, $normalizedMeridian)->format('H:i');
            } catch (\Exception) {
                continue;
            }
        }

        return $value;
    }

    public function toMinuteOfDay(string $time): ?int
    {
        $normalized = $this->normalizeTimeValue($time);
        if (! is_string($normalized) || ! preg_match('/^\d{2}:\d{2}$/', $normalized)) {
            return null;
        }

        [$hour, $minute] = array_map('intval', explode(':', $normalized));

        return ($hour * 60) + $minute;
    }

    public function getLatestUserMessageContent(array $messages): ?string
    {
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if (($messages[$i]['role'] ?? null) === 'user') {
                return trim((string) ($messages[$i]['content'] ?? ''));
            }
        }

        return null;
    }

    public function extractTimeRangeFromMessage(?string $message): array
    {
        if (! $message) {
            return ['time_start' => null, 'time_end' => null];
        }

        $timePattern = '(?:[0-9]{1,2}:[0-9]{2}\s*(?:am|pm)?|[0-9]{1,2}\s*(?:am|pm))';
        $patterns = [
            "/\bfrom\s+(".$timePattern.")\s*(?:to|until|-)\s*(".$timePattern.")\b/i",
            "/\b(".$timePattern.")\s+to\s+(".$timePattern.")\b/i",
            "/\b(".$timePattern.")\s*-\s*(".$timePattern.")\b/i",
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $message, $matches)) {
                continue;
            }

            $start = $this->normalizeTimeValue($matches[1] ?? null);
            $end = $this->normalizeTimeValue($matches[2] ?? null);

            return [
                'time_start' => is_string($start) ? $start : null,
                'time_end' => is_string($end) ? $end : null,
            ];
        }

        return ['time_start' => null, 'time_end' => null];
    }

    public function normalizeEquipmentSelections(array $equipmentSelections, ?int $facilityId = null): array
    {
        $normalized = [];

        foreach ($equipmentSelections as $equipmentKey => $equipmentValue) {
            if (is_array($equipmentValue)) {
                if (! isset($equipmentValue['equipment_id']) && isset($equipmentValue['id'])) {
                    $equipmentValue['equipment_id'] = $equipmentValue['id'];
                }

                if (! isset($equipmentValue['quantity_needed']) && isset($equipmentValue['quantity'])) {
                    $equipmentValue['quantity_needed'] = $equipmentValue['quantity'];
                }

                $resolvedEquipmentId = $this->resolveEquipmentIdFromValue(
                    $equipmentValue['equipment_id'] ?? null,
                    $facilityId
                );
                $quantityNeeded = isset($equipmentValue['quantity_needed'])
                    ? (int) $equipmentValue['quantity_needed']
                    : 0;
                $sourceFacilityId = null;
                if (isset($equipmentValue['source_facility_id'])) {
                    $resolvedSourceFacilityId = $this->resolveFacilityIdFromValue($equipmentValue['source_facility_id']);
                    $sourceFacilityId = is_numeric($resolvedSourceFacilityId) ? (int) $resolvedSourceFacilityId : null;
                } elseif (isset($equipmentValue['facility_id'])) {
                    $resolvedSelectionFacilityId = $this->resolveFacilityIdFromValue($equipmentValue['facility_id']);
                    $sourceFacilityId = is_numeric($resolvedSelectionFacilityId) ? (int) $resolvedSelectionFacilityId : null;
                }

                $isBorrowed = false;
                if ($sourceFacilityId && (! $facilityId || $sourceFacilityId !== $facilityId)) {
                    $isBorrowed = true;
                } elseif (array_key_exists('is_borrowed', $equipmentValue)) {
                    $parsedBorrowed = filter_var($equipmentValue['is_borrowed'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    $isBorrowed = $parsedBorrowed === true;
                }

                if (is_numeric($resolvedEquipmentId) && $quantityNeeded > 0) {
                    $normalizedItem = [
                        'equipment_id' => (int) $resolvedEquipmentId,
                        'quantity_needed' => $quantityNeeded,
                    ];

                    if ($isBorrowed && $sourceFacilityId && (! $facilityId || $sourceFacilityId !== $facilityId)) {
                        $normalizedItem['is_borrowed'] = true;
                        $normalizedItem['source_facility_id'] = $sourceFacilityId;
                    }

                    $normalized[] = $normalizedItem;
                }

                continue;
            }

            if (! is_numeric($equipmentKey) || ! is_numeric($equipmentValue)) {
                continue;
            }

            $quantityNeeded = (int) $equipmentValue;
            if ($quantityNeeded <= 0) {
                continue;
            }

            $resolvedEquipmentId = $this->resolveEquipmentIdFromValue((int) $equipmentKey, $facilityId);
            if (! is_numeric($resolvedEquipmentId)) {
                continue;
            }

            $normalized[] = [
                'equipment_id' => (int) $resolvedEquipmentId,
                'quantity_needed' => $quantityNeeded,
            ];
        }

        return $this->mergeNormalizedEquipment([], $normalized);
    }

    public function mergeNormalizedEquipment(array $base, array $extra): array
    {
        $totals = [];
        $meta = [];

        foreach (array_merge($base, $extra) as $selection) {
            if (! is_array($selection)) {
                continue;
            }

            $equipmentId = isset($selection['equipment_id']) ? (int) $selection['equipment_id'] : 0;
            $quantityNeeded = isset($selection['quantity_needed']) ? (int) $selection['quantity_needed'] : 0;
            $sourceFacilityId = isset($selection['source_facility_id']) ? (int) $selection['source_facility_id'] : 0;
            $isBorrowed = isset($selection['is_borrowed'])
                ? (bool) $selection['is_borrowed']
                : ($sourceFacilityId > 0);

            if ($equipmentId <= 0 || $quantityNeeded <= 0) {
                continue;
            }

            if ($isBorrowed && $sourceFacilityId <= 0) {
                continue;
            }

            $bucketKey = $equipmentId.':'.(($isBorrowed && $sourceFacilityId > 0) ? $sourceFacilityId : 0);
            $totals[$bucketKey] = ($totals[$bucketKey] ?? 0) + $quantityNeeded;
            $meta[$bucketKey] = [
                'equipment_id' => $equipmentId,
                'is_borrowed' => $isBorrowed && $sourceFacilityId > 0,
                'source_facility_id' => $sourceFacilityId > 0 ? $sourceFacilityId : null,
            ];
        }

        $merged = [];
        foreach ($totals as $bucketKey => $quantityNeeded) {
            $equipmentId = (int) ($meta[$bucketKey]['equipment_id'] ?? 0);
            $isBorrowed = (bool) ($meta[$bucketKey]['is_borrowed'] ?? false);
            $sourceFacilityId = $meta[$bucketKey]['source_facility_id'] ?? null;

            $mergedItem = [
                'equipment_id' => $equipmentId,
                'quantity_needed' => (int) $quantityNeeded,
            ];

            if ($isBorrowed && is_numeric($sourceFacilityId)) {
                $mergedItem['is_borrowed'] = true;
                $mergedItem['source_facility_id'] = (int) $sourceFacilityId;
            }

            $merged[] = $mergedItem;
        }

        return $merged;
    }

    public function resolveFacilityIdFromValue(mixed $facilityValue): mixed
    {
        if (is_int($facilityValue) || (is_string($facilityValue) && ctype_digit(trim($facilityValue)))) {
            return (int) $facilityValue;
        }

        if (! is_string($facilityValue) || trim($facilityValue) === '') {
            return $facilityValue;
        }

        $normalizedValue = trim($facilityValue);

        if (preg_match('/\b(?:facility\s*)?id\s*(\d+)\b/i', $normalizedValue, $matches)) {
            return (int) $matches[1];
        }

        $facility = Facility::query()
            ->orderByRaw('LENGTH(name) DESC')
            ->get(['id', 'name'])
            ->first(function ($facility) use ($normalizedValue) {
                $facilityName = (string) $facility->name;

                return strcasecmp($facilityName, $normalizedValue) === 0
                    || stripos($facilityName, $normalizedValue) !== false
                    || stripos($normalizedValue, $facilityName) !== false;
            });

        return $facility?->id ?? $facilityValue;
    }

    public function resolveEquipmentIdFromValue(mixed $equipmentValue, ?int $facilityId = null): mixed
    {
        if (is_int($equipmentValue) || (is_string($equipmentValue) && ctype_digit(trim($equipmentValue)))) {
            return (int) $equipmentValue;
        }

        if (! $equipmentValue) {
            return $equipmentValue;
        }

        $normalizedValue = trim($equipmentValue);

        if (preg_match('/\b(?:equipment\s*)?id\s*(\d+)\b/i', $normalizedValue, $matches)) {
            return (int) $matches[1];
        }

        $query = Equipment::query()->orderByRaw('LENGTH(name) DESC');

        if ($facilityId) {
            $query->whereHas('facilities', fn ($q) => $q->where('facilities.id', $facilityId));
        }

        $equipment = $query->get(['id', 'name'])->first(function ($equipment) use ($normalizedValue) {
            $equipmentName = (string) $equipment->name;

            return strcasecmp($equipmentName, $normalizedValue) === 0
                || stripos($equipmentName, $normalizedValue) !== false
                || stripos($normalizedValue, $equipmentName) !== false;
        });

        return $equipment?->id ?? $equipmentValue;
    }
}
