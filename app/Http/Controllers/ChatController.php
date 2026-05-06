<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Http\File as HttpFile;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use App\Models\Request as RequestModel;
use App\Models\Rule as RuleModel;
use App\Models\Facility;
use App\Models\Equipment;
use App\Enums\RequestStatus;
use App\Enums\PriorityLevel;
use App\Services\ChatbotLogService;
use App\Services\OllamaModelResolver;
use App\Services\RAG\FaqMatchingService;
use App\Jobs\ProcessRequestRecommendation;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    private string $ollamaUrl;
    private string $model;

    private const SESSION_TTL_MINUTES = 15;

    public function __construct(
        protected ChatbotLogService $chatbotLogService,
        protected FaqMatchingService $faqMatchingService,
        protected OllamaModelResolver $ollamaModelResolver
    )
    {
        $this->ollamaUrl = config('ollama-laravel.url');
        $this->model     = config('ollama-laravel.model', 'qwen2.5:3b');
    }

    private function chatModel(): string
    {
        return $this->ollamaModelResolver->resolve($this->ollamaUrl, $this->model);
    }

    private function sessionCacheKey(): string
    {
        return 'chat_session_' . Auth::id();
    }

    private function faqStateCacheKey(): string
    {
        return 'chat_faq_state_' . Auth::id();
    }

    private function saveSession(array $userMessages): void
    {
        Cache::put(
            $this->sessionCacheKey(),
            $userMessages,
            now()->addMinutes(self::SESSION_TTL_MINUTES)
        );
    }

    private function loadSession(): array
    {
        return Cache::get($this->sessionCacheKey(), []);
    }

    public function getSession(): JsonResponse
    {
        $messages = $this->loadSession();
        return response()->json(['messages' => $messages]);
    }

    private function clearSession(): void
    {
        Cache::forget($this->sessionCacheKey());
        Cache::forget($this->faqStateCacheKey());
    }

    public function newSession(): JsonResponse
    {
        $this->clearSession();
        return response()->json(['message' => 'Session cleared.']);
    }

    private function getFaqState(): array
    {
        $state = Cache::get($this->faqStateCacheKey(), []);
        return is_array($state) ? $state : [];
    }

    private function saveFaqState(array $state): void
    {
        Cache::put(
            $this->faqStateCacheKey(),
            $state,
            now()->addMinutes(self::SESSION_TTL_MINUTES)
        );
    }

    private function clearFaqState(): void
    {
        Cache::forget($this->faqStateCacheKey());
    }

    private function normalizePositiveIntValue(mixed $value): ?int
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

    private function validateFacilityParticipantCapacity(array $facilityBookings, ?int $globalParticipantCount = null): array
    {
        $errors = [];
        $facilityIds = collect($facilityBookings)
            ->map(fn($booking) => isset($booking['facility_id']) ? (int) $booking['facility_id'] : 0)
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($facilityIds)) {
            return $errors;
        }

        $facilities = Facility::whereIn('id', $facilityIds)->get(['id', 'name', 'capacity'])->keyBy('id');

        foreach ($facilityBookings as $bookingIndex => $booking) {
            $facilityId = isset($booking['facility_id']) ? (int) $booking['facility_id'] : 0;
            if ($facilityId <= 0) {
                continue;
            }

            $facility = $facilities->get($facilityId);
            if (!$facility) {
                continue;
            }

            $bookingParticipantCount = $this->normalizePositiveIntValue($booking['expected_capacity'] ?? null)
                ?? $this->normalizePositiveIntValue($globalParticipantCount);

            if (!$bookingParticipantCount) {
                continue;
            }

            if ($bookingParticipantCount > (int) $facility->capacity) {
                $errors["facility_bookings.{$bookingIndex}.expected_capacity"][] =
                    "Participant count ({$bookingParticipantCount}) exceeds the capacity of {$facility->name} ({$facility->capacity}).";
            }
        }

        return $errors;
    }

    private function getLatestUserMessageContent(array $messages): ?string
    {
        for ($i = count($messages) - 1; $i >= 0; $i--) {
            if (($messages[$i]['role'] ?? null) === 'user') {
                return trim((string) ($messages[$i]['content'] ?? ''));
            }
        }

        return null;
    }

    private function extractFacilityAndDateFromMessage(?string $message, $facilities): array
    {
        if (empty($message)) {
            return ['facility' => null, 'date' => null];
        }

        $facility = null;

        if (preg_match('/\b(?:facility\s*)?id\s*(\d+)\b/i', $message, $matches)) {
            $facility = $facilities->firstWhere('id', (int) $matches[1]);
        }

        if (
            !$facility &&
            preg_match('/\b([a-z]{2,6})\s*([0-9]+[a-z])\b/i', $message, $codeMatches)
        ) {
            $requestedCode = strtolower($codeMatches[1] . $codeMatches[2]);
            $facility = $facilities->first(function ($f) use ($requestedCode) {
                $facilityCompactName = (string) Str::of(Str::lower((string) $f->name))
                    ->replaceMatches('/[^a-z0-9]+/', '');

                return $requestedCode !== '' && Str::contains($facilityCompactName, $requestedCode);
            });
        }

        if (!$facility) {
            $normalizedMessage = Str::lower($message);
            $messageSlug = (string) Str::of($normalizedMessage)
                ->replaceMatches('/[^a-z0-9]+/', ' ')
                ->squish();
            $facility = $facilities
                ->sortByDesc(fn($f) => strlen((string) $f->name))
                ->first(function ($f) use ($normalizedMessage, $messageSlug) {
                    $facilityName = Str::lower((string) $f->name);
                    $facilityBaseName = trim((string) preg_replace('/\s*\(.*?\)\s*/', ' ', $facilityName));

                    $facilityNameSlug = (string) Str::of($facilityName)
                        ->replaceMatches('/[^a-z0-9]+/', ' ')
                        ->squish();
                    $facilityBaseSlug = (string) Str::of($facilityBaseName)
                        ->replaceMatches('/[^a-z0-9]+/', ' ')
                        ->squish();

                    return Str::contains($normalizedMessage, $facilityName)
                        || ($facilityBaseName !== '' && Str::contains($normalizedMessage, $facilityBaseName))
                        || ($facilityNameSlug !== '' && Str::contains($messageSlug, $facilityNameSlug))
                        || ($facilityBaseSlug !== '' && Str::contains($messageSlug, $facilityBaseSlug));
                });
        }

        $date = null;

        if (preg_match('/\b\d{4}-\d{2}-\d{2}\b/', $message, $matches)) {
            try {
                $date = Carbon::parse($matches[0])->format('Y-m-d');
            } catch (\Exception $e) {
                $date = null;
            }
        }

        if (!$date && preg_match('/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*|\s+)\d{4}\b/i', $message, $matches)) {
            try {
                $date = Carbon::parse($matches[0])->format('Y-m-d');
            } catch (\Exception $e) {
                $date = null;
            }
        }

        if (!$date && preg_match('/\b(today|tomorrow)\b/i', $message, $matches)) {
            $keyword = strtolower($matches[1]);
            $date = $keyword === 'tomorrow'
                ? Carbon::tomorrow()->format('Y-m-d')
                : Carbon::today()->format('Y-m-d');
        }

        return ['facility' => $facility, 'date' => $date];
    }

    private function normalizeDateValue(mixed $value): mixed
    {
        if (!is_string($value)) {
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

    private function normalizeTimeValue(mixed $value): mixed
    {
        if (!is_string($value)) {
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

    private function toMinuteOfDay(string $time): ?int
    {
        $normalized = $this->normalizeTimeValue($time);
        if (!is_string($normalized) || !preg_match('/^\d{2}:\d{2}$/', $normalized)) {
            return null;
        }

        [$hour, $minute] = array_map('intval', explode(':', $normalized));
        return ($hour * 60) + $minute;
    }

    private function extractTimeRangeFromMessage(?string $message): array
    {
        if (!$message) {
            return ['time_start' => null, 'time_end' => null];
        }

        $timePattern = '(?:[0-9]{1,2}:[0-9]{2}\s*(?:am|pm)?|[0-9]{1,2}\s*(?:am|pm))';
        $patterns = [
            "/\bfrom\s+($timePattern)\s*(?:to|until|-)\s*($timePattern)\b/i",
            "/\b($timePattern)\s+to\s+($timePattern)\b/i",
            "/\b($timePattern)\s*-\s*($timePattern)\b/i",
        ];

        foreach ($patterns as $pattern) {
            if (!preg_match($pattern, $message, $matches)) {
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

    private function getEquipmentContextRows(int $limit = 50): array
    {
        return Equipment::with(['facilities:id,name'])
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get(['id', 'name', 'quantity'])
            ->flatMap(function ($equipment) {
                if ($equipment->facilities->isEmpty()) {
                    return [[
                        'id' => $equipment->id,
                        'name' => $equipment->name,
                        'facility_id' => null,
                        'facility' => null,
                        'quantity' => 0,
                        'line' => "ID {$equipment->id}: {$equipment->name} (No facility assignment, Available: 0)",
                    ]];
                }

                return $equipment->facilities->map(function ($facility) use ($equipment) {
                    $facilityQuantity = (int) ($facility->pivot->quantity ?? 0);

                    return [
                        'id' => $equipment->id,
                        'name' => $equipment->name,
                        'facility_id' => $facility->id,
                        'facility' => $facility->name,
                        'quantity' => $facilityQuantity,
                        'line' => "ID {$equipment->id}: {$equipment->name} (Facility: {$facility->name}, Facility ID: {$facility->id}, Available: {$facilityQuantity})",
                    ];
                })->values();
            })
            ->values()
            ->all();
    }

    private function resolveFacilityIdFromValue(mixed $facilityValue): mixed
    {
        if (is_int($facilityValue) || (is_string($facilityValue) && ctype_digit(trim($facilityValue)))) {
            return (int) $facilityValue;
        }

        if (!is_string($facilityValue) || trim($facilityValue) === '') {
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

    private function resolveEquipmentIdFromValue(mixed $equipmentValue, ?int $facilityId = null): mixed
    {
        if (is_int($equipmentValue) || (is_string($equipmentValue) && ctype_digit(trim($equipmentValue)))) {
            return (int) $equipmentValue;
        }

        if (!is_string($equipmentValue) || trim($equipmentValue) === '') {
            return $equipmentValue;
        }

        $normalizedValue = trim($equipmentValue);

        if (preg_match('/\b(?:equipment\s*)?id\s*(\d+)\b/i', $normalizedValue, $matches)) {
            return (int) $matches[1];
        }

        $query = Equipment::query()
            ->orderByRaw('LENGTH(name) DESC');

        if ($facilityId) {
            $query->whereHas('facilities', fn($q) => $q->where('facilities.id', $facilityId));
        }

        $equipment = $query
            ->get(['id', 'name'])
            ->first(function ($equipment) use ($normalizedValue) {
                $equipmentName = (string) $equipment->name;

                return strcasecmp($equipmentName, $normalizedValue) === 0
                    || stripos($equipmentName, $normalizedValue) !== false
                    || stripos($normalizedValue, $equipmentName) !== false;
            });

        return $equipment?->id ?? $equipmentValue;
    }

    private function resolveBorrowSourceFacilityId(
        Equipment $equipment,
        int $selectedFacilityId,
        string $date,
        string $timeStart,
        string $timeEnd,
        int $quantityNeeded
    ): ?int {
        $candidates = $equipment->facilities
            ->filter(fn($facility) => (int) $facility->id !== $selectedFacilityId)
            ->map(function ($facility) use ($equipment, $date, $timeStart, $timeEnd) {
                $slotAvailability = $equipment->slotAvailabilityInFacility(
                    (int) $facility->id,
                    $date,
                    $timeStart,
                    $timeEnd
                );

                return [
                    'id' => (int) $facility->id,
                    'remaining' => (int) ($slotAvailability['remaining_quantity'] ?? 0),
                ];
            })
            ->filter(fn($candidate) => $candidate['remaining'] > 0)
            ->values()
            ->all();

        if (empty($candidates)) {
            return null;
        }

        usort($candidates, function ($left, $right) use ($quantityNeeded) {
            $leftFits = $left['remaining'] >= $quantityNeeded ? 1 : 0;
            $rightFits = $right['remaining'] >= $quantityNeeded ? 1 : 0;
            if ($leftFits !== $rightFits) {
                return $rightFits <=> $leftFits;
            }

            if ($left['remaining'] !== $right['remaining']) {
                return $right['remaining'] <=> $left['remaining'];
            }

            return $left['id'] <=> $right['id'];
        });

        return (int) $candidates[0]['id'];
    }

    private function validateFacilityEquipmentSelections(array &$facilityBookings): array
    {
        $errors = [];

        foreach ($facilityBookings as $bookingIndex => &$booking) {
            $facilityId = (int) ($booking['facility_id'] ?? 0);
            if ($facilityId <= 0 || empty($booking['equipment']) || !is_array($booking['equipment'])) {
                continue;
            }

            $date = Carbon::parse($booking['date'])->format('Y-m-d');
            $timeStart = (string) ($this->normalizeTimeValue($booking['time_start'] ?? '') ?? '');
            $timeEnd = (string) ($this->normalizeTimeValue($booking['time_end'] ?? '') ?? '');

            foreach ($booking['equipment'] as $equipmentIndex => &$selection) {
                $equipmentId = (int) ($selection['equipment_id'] ?? 0);
                $quantityNeeded = (int) ($selection['quantity_needed'] ?? 0);
                if ($equipmentId <= 0 || $quantityNeeded <= 0) {
                    continue;
                }

                $equipment = Equipment::with('facilities:id')->find($equipmentId);
                if (!$equipment) {
                    continue;
                }

                $sourceFacilityId = isset($selection['source_facility_id']) && is_numeric($selection['source_facility_id'])
                    ? (int) $selection['source_facility_id']
                    : (isset($selection['facility_id']) && is_numeric($selection['facility_id'])
                        ? (int) $selection['facility_id']
                        : 0);

                $isAssignedToSelectedFacility = $equipment->facilities->contains('id', $facilityId);
                if ((!$sourceFacilityId || $sourceFacilityId === $facilityId) && !$isAssignedToSelectedFacility) {
                    $resolvedSourceFacilityId = $this->resolveBorrowSourceFacilityId(
                        $equipment,
                        $facilityId,
                        $date,
                        $timeStart,
                        $timeEnd,
                        $quantityNeeded
                    );

                    if ($resolvedSourceFacilityId) {
                        $sourceFacilityId = $resolvedSourceFacilityId;
                        $selection['source_facility_id'] = $resolvedSourceFacilityId;
                        $selection['is_borrowed'] = true;
                    }
                }

                if ($sourceFacilityId <= 0) {
                    $sourceFacilityId = $facilityId;
                }

                $isBorrowed = $sourceFacilityId > 0 && $sourceFacilityId !== $facilityId;
                $validationFacilityId = $isBorrowed ? $sourceFacilityId : $facilityId;

                if (!$equipment->facilities->contains('id', $validationFacilityId)) {
                    $errors["facility_bookings.{$bookingIndex}.equipment.{$equipmentIndex}.equipment_id"][] =
                        $isBorrowed
                            ? "{$equipment->name} is not assigned to the source facility (ID {$validationFacilityId}) for borrowing."
                            : "{$equipment->name} is not assigned to the selected facility.";
                    continue;
                }

                $slotAvailability = $equipment->slotAvailabilityInFacility($validationFacilityId, $date, $timeStart, $timeEnd);
                $available = (int) ($slotAvailability['remaining_quantity'] ?? 0);
                if ($quantityNeeded > $available) {
                    $errors["facility_bookings.{$bookingIndex}.equipment.{$equipmentIndex}.quantity_needed"][] =
                        $isBorrowed
                            ? "{$equipment->name}: requested {$quantityNeeded} borrowed unit(s), available quantity is {$available} unit(s) from facility ID {$validationFacilityId} for the selected time slot."
                            : "{$equipment->name}: requested {$quantityNeeded} unit(s), available quantity is {$available} unit(s) in this facility for the selected time slot.";
                }
            }

            unset($selection);
        }

        unset($booking);

        return $errors;
    }

    private function lockFacilityEquipmentRows(array $facilityBookings): void
    {
        $pairs = collect($facilityBookings)
            ->flatMap(function ($booking) {
                $facilityId = isset($booking['facility_id']) ? (int) $booking['facility_id'] : 0;
                $equipmentRows = $booking['equipment'] ?? [];

                if ($facilityId <= 0 || !is_array($equipmentRows)) {
                    return [];
                }

                return collect($equipmentRows)
                    ->map(function ($selection) use ($facilityId) {
                        $equipmentId = isset($selection['equipment_id']) ? (int) $selection['equipment_id'] : 0;
                        if ($equipmentId <= 0) {
                            return null;
                        }

                        $sourceFacilityId = isset($selection['source_facility_id']) && is_numeric($selection['source_facility_id'])
                            ? (int) $selection['source_facility_id']
                            : (isset($selection['facility_id']) && is_numeric($selection['facility_id'])
                                ? (int) $selection['facility_id']
                                : $facilityId);
                        $lockFacilityId = ($sourceFacilityId > 0 && $sourceFacilityId !== $facilityId)
                            ? $sourceFacilityId
                            : $facilityId;

                        return [
                            'facility_id' => $lockFacilityId,
                            'equipment_id' => $equipmentId,
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();
            })
            ->unique(fn($pair) => "{$pair['facility_id']}:{$pair['equipment_id']}")
            ->values();

        foreach ($pairs as $pair) {
            DB::table('facility_equipment')
                ->where('facility_id', $pair['facility_id'])
                ->where('equipment_id', $pair['equipment_id'])
                ->lockForUpdate()
                ->first();
        }
    }

    private function normalizeEquipmentSelections(array $equipmentSelections, ?int $facilityId = null): array
    {
        $normalized = [];

        foreach ($equipmentSelections as $equipmentKey => $equipmentValue) {
            if (is_array($equipmentValue)) {
                if (!isset($equipmentValue['equipment_id']) && isset($equipmentValue['id'])) {
                    $equipmentValue['equipment_id'] = $equipmentValue['id'];
                }

                if (!isset($equipmentValue['quantity_needed']) && isset($equipmentValue['quantity'])) {
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
                if ($sourceFacilityId && (!$facilityId || $sourceFacilityId !== $facilityId)) {
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

                    if ($isBorrowed && $sourceFacilityId && (!$facilityId || $sourceFacilityId !== $facilityId)) {
                        $normalizedItem['is_borrowed'] = true;
                        $normalizedItem['source_facility_id'] = $sourceFacilityId;
                    }

                    $normalized[] = $normalizedItem;
                }

                continue;
            }

            if (!is_numeric($equipmentKey) || !is_numeric($equipmentValue)) {
                continue;
            }

            $quantityNeeded = (int) $equipmentValue;
            if ($quantityNeeded <= 0) {
                continue;
            }

            $resolvedEquipmentId = $this->resolveEquipmentIdFromValue((int) $equipmentKey, $facilityId);
            if (!is_numeric($resolvedEquipmentId)) {
                continue;
            }

            $normalized[] = [
                'equipment_id' => (int) $resolvedEquipmentId,
                'quantity_needed' => $quantityNeeded,
            ];
        }

        return $this->mergeNormalizedEquipment([], $normalized);
    }

    private function mergeNormalizedEquipment(array $base, array $extra): array
    {
        $totals = [];
        $meta = [];

        foreach (array_merge($base, $extra) as $selection) {
            if (!is_array($selection)) {
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

            $bucketKey = $equipmentId . ':' . (($isBorrowed && $sourceFacilityId > 0) ? $sourceFacilityId : 0);
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

    private function normalizeCreateRequestPayload(array $input): array
    {
        $normalized = $input;
        $orphanEquipmentSelections = [];
        $globalParticipantCount = $this->normalizePositiveIntValue($normalized['participant_count'] ?? null);

        if ($globalParticipantCount) {
            $normalized['participant_count'] = $globalParticipantCount;
        } else {
            unset($normalized['participant_count']);
        }

        if (!empty($normalized['facility_bookings']) && is_array($normalized['facility_bookings'])) {
            $normalizedBookings = [];

            foreach ($normalized['facility_bookings'] as $booking) {
                if (!is_array($booking)) {
                    continue;
                }

                if (!isset($booking['time_start']) && isset($booking['start_time'])) {
                    $booking['time_start'] = $booking['start_time'];
                }

                if (!isset($booking['time_end']) && isset($booking['end_time'])) {
                    $booking['time_end'] = $booking['end_time'];
                }

                if (!isset($booking['expected_capacity']) && isset($booking['participant_count'])) {
                    $booking['expected_capacity'] = $booking['participant_count'];
                }

                if (isset($booking['date'])) {
                    $booking['date'] = $this->normalizeDateValue($booking['date']);
                }

                if (isset($booking['time_start'])) {
                    $booking['time_start'] = $this->normalizeTimeValue($booking['time_start']);
                }

                if (isset($booking['time_end'])) {
                    $booking['time_end'] = $this->normalizeTimeValue($booking['time_end']);
                }

                if (isset($booking['facility_id'])) {
                    $booking['facility_id'] = $this->resolveFacilityIdFromValue($booking['facility_id']);
                }

                $bookingParticipantCount = $this->normalizePositiveIntValue($booking['expected_capacity'] ?? null)
                    ?? $globalParticipantCount;
                if ($bookingParticipantCount) {
                    $booking['expected_capacity'] = $bookingParticipantCount;
                } else {
                    unset($booking['expected_capacity']);
                }

                $facilityId = isset($booking['facility_id']) && is_numeric($booking['facility_id'])
                    ? (int) $booking['facility_id']
                    : null;
                $normalizedOwnEquipment = !empty($booking['equipment']) && is_array($booking['equipment'])
                    ? $this->normalizeEquipmentSelections($booking['equipment'], $facilityId)
                    : [];
                $normalizedBorrowedEquipment = !empty($booking['borrowed_equipment']) && is_array($booking['borrowed_equipment'])
                    ? $this->normalizeEquipmentSelections($booking['borrowed_equipment'], $facilityId)
                    : [];
                $normalizedEquipment = $this->mergeNormalizedEquipment($normalizedOwnEquipment, $normalizedBorrowedEquipment);

                if (!empty($normalizedEquipment)) {
                    $booking['equipment'] = $normalizedEquipment;
                } else {
                    unset($booking['equipment']);
                }
                unset($booking['borrowed_equipment']);

                if ($facilityId && $facilityId > 0) {
                    $booking['facility_id'] = $facilityId;
                    $normalizedBookings[] = $booking;
                    continue;
                }

                if (!empty($normalizedEquipment)) {
                    $orphanEquipmentSelections = array_merge($orphanEquipmentSelections, $normalizedEquipment);
                }
            }

            if (!empty($normalizedBookings) && !empty($orphanEquipmentSelections)) {
                $firstFacilityId = (int) ($normalizedBookings[0]['facility_id'] ?? 0);
                $resolvedOrphans = $this->normalizeEquipmentSelections($orphanEquipmentSelections, $firstFacilityId > 0 ? $firstFacilityId : null);
                $normalizedBookings[0]['equipment'] = $this->mergeNormalizedEquipment(
                    $normalizedBookings[0]['equipment'] ?? [],
                    $resolvedOrphans
                );
            }

            if (!empty($normalizedBookings)) {
                $normalized['facility_bookings'] = array_values($normalizedBookings);
            }
        }

        if (!empty($normalized['equipment']) && is_array($normalized['equipment']) && !empty($normalized['facility_bookings'][0])) {
            $firstFacilityId = isset($normalized['facility_bookings'][0]['facility_id']) && is_numeric($normalized['facility_bookings'][0]['facility_id'])
                ? (int) $normalized['facility_bookings'][0]['facility_id']
                : null;

            $topLevelEquipment = $this->normalizeEquipmentSelections(
                $normalized['equipment'],
                $firstFacilityId
            );

            $normalized['facility_bookings'][0]['equipment'] = $this->mergeNormalizedEquipment(
                $normalized['facility_bookings'][0]['equipment'] ?? [],
                $topLevelEquipment
            );

            unset($normalized['equipment']);
        }

        if (!empty($normalized['borrowed_equipment']) && is_array($normalized['borrowed_equipment']) && !empty($normalized['facility_bookings'][0])) {
            $firstFacilityId = isset($normalized['facility_bookings'][0]['facility_id']) && is_numeric($normalized['facility_bookings'][0]['facility_id'])
                ? (int) $normalized['facility_bookings'][0]['facility_id']
                : null;

            $topLevelBorrowedEquipment = $this->normalizeEquipmentSelections(
                $normalized['borrowed_equipment'],
                $firstFacilityId
            );

            $normalized['facility_bookings'][0]['equipment'] = $this->mergeNormalizedEquipment(
                $normalized['facility_bookings'][0]['equipment'] ?? [],
                $topLevelBorrowedEquipment
            );

            unset($normalized['borrowed_equipment']);
        }

        return $normalized;
    }

    private function isAvailabilityIntent(?string $message): bool
    {
        if (!$message) {
            return false;
        }

        $normalized = trim((string) $message);
        if ($normalized === '') {
            return false;
        }

        $hasAvailabilityKeyword = (bool) preg_match(
            '/\b(available|availability|free|open|booked|occupied|conflict|overlap|overlapping)\b/i',
            $normalized
        );

        if (!$hasAvailabilityKeyword) {
            return false;
        }

        $hasAvailabilityAction = (bool) preg_match(
            '/\b(check|verify|confirm|re-?check|double check|is|are|can|could|show)\b/i',
            $normalized
        );

        $hasBookingEntity = (bool) preg_match(
            '/\b(room|facility|hall|avr|mph|slot|schedule|booking|date|time)\b/i',
            $normalized
        );

        $isLikelyMetaDiscussion = (bool) preg_match(
            '/\b(logic|module|function|regex|prompt|controller|backend|frontend|intent|code|implementation|system)\b/i',
            $normalized
        );

        if ($isLikelyMetaDiscussion && !$hasBookingEntity) {
            return false;
        }

        return $hasAvailabilityAction || $hasBookingEntity;
    }

    private function shouldRunDeterministicAvailabilityCheck(?string $latestUserMessage, array $resolved, $facilities): bool
    {
        if (!$latestUserMessage || !$this->isAvailabilityIntent($latestUserMessage)) {
            return false;
        }

        if (empty($resolved['facility']) || empty($resolved['date'])) {
            return false;
        }

        $latestParsed = $this->extractFacilityAndDateFromMessage($latestUserMessage, $facilities);
        $latestRange = $this->extractTimeRangeFromMessage($latestUserMessage);

        $messageHasDirectBookingDetails =
            !empty($latestParsed['facility']) ||
            !empty($latestParsed['date']) ||
            !empty($latestRange['time_start']) ||
            !empty($latestRange['time_end']);

        $messageHasReferentialFollowUp = (bool) preg_match(
            '/\b(it|that|same (room|facility|slot|time|date)|same schedule|same booking)\b/i',
            $latestUserMessage
        );

        return $messageHasDirectBookingDetails || $messageHasReferentialFollowUp;
    }

    private function resolveFacilityAndDateFromConversation(array $messages, $facilities): array
    {
        $facility = null;
        $date = null;
        $timeStart = null;
        $timeEnd = null;

        for ($i = count($messages) - 1; $i >= 0; $i--) {
            $role = $messages[$i]['role'] ?? null;
            // Prefer user-authored context to avoid matching facility names listed by the assistant.
            if ($role !== 'user') {
                continue;
            }

            $content = trim((string) ($messages[$i]['content'] ?? ''));
            if ($content === '') {
                continue;
            }

            $parsed = $this->extractFacilityAndDateFromMessage($content, $facilities);

            if (!$facility && !empty($parsed['facility'])) {
                $facility = $parsed['facility'];
            }

            if (!$date && !empty($parsed['date'])) {
                $date = $parsed['date'];
            }

            if (!$timeStart || !$timeEnd) {
                $timeRange = $this->extractTimeRangeFromMessage($content);
                if (!$timeStart && !empty($timeRange['time_start'])) {
                    $timeStart = $timeRange['time_start'];
                }
                if (!$timeEnd && !empty($timeRange['time_end'])) {
                    $timeEnd = $timeRange['time_end'];
                }
            }

            if ($facility && $date && $timeStart && $timeEnd) {
                break;
            }
        }

        return [
            'facility' => $facility,
            'date' => $date,
            'time_start' => $timeStart,
            'time_end' => $timeEnd,
        ];
    }

    private function hasTimeOverlap(string $date, string $requestedStart, string $requestedEnd, string $existingStart, string $existingEnd): bool
    {
        try {
            $requestedStartAt = Carbon::parse("{$date} {$requestedStart}");
            $requestedEndAt = Carbon::parse("{$date} {$requestedEnd}");
            $existingStartAt = Carbon::parse("{$date} {$existingStart}");
            $existingEndAt = Carbon::parse("{$date} {$existingEnd}");
        } catch (\Exception) {
            return false;
        }

        return $requestedStartAt->lt($existingEndAt) && $requestedEndAt->gt($existingStartAt);
    }

    private function buildAvailabilityResponse($facility, string $date, $allRequests, ?string $requestedStart = null, ?string $requestedEnd = null): string
    {
        $approvedBookings = $allRequests
            ->filter(fn($r) => $r->status->value === 'Approved')
            ->flatMap(function ($r) use ($facility) {
                return $r->requestFacilities
                    ->where('facility_id', $facility->id)
                    ->map(function ($rf) use ($r) {
                        return [
                            'request_id' => $r->id,
                            'title' => $r->title,
                            'date' => $rf->date_requested,
                            'time_start' => $rf->time_start,
                            'time_end' => $rf->time_end,
                        ];
                    });
            })
            ->where('date', $date)
            ->sortBy('time_start')
            ->values();

        $normalizedRequestedStart = is_string($requestedStart) ? $this->normalizeTimeValue($requestedStart) : null;
        $normalizedRequestedEnd = is_string($requestedEnd) ? $this->normalizeTimeValue($requestedEnd) : null;

        if (is_string($normalizedRequestedStart) && is_string($normalizedRequestedEnd)) {
            try {
                $requestedStartAt = Carbon::parse("{$date} {$normalizedRequestedStart}");
                $requestedEndAt = Carbon::parse("{$date} {$normalizedRequestedEnd}");
            } catch (\Exception) {
                return "I can check availability for {$facility->name} on {$date}, but I couldn't understand the requested time format. Please provide start and end time in HH:MM or AM/PM format.";
            }

            if ($requestedEndAt->lte($requestedStartAt)) {
                return "The requested time window for {$facility->name} on {$date} is invalid because the end time is not after the start time. Please provide a valid time range.";
            }

            if ($approvedBookings->isEmpty()) {
                return "{$facility->name} is available on {$date} from {$normalizedRequestedStart} to {$normalizedRequestedEnd}. I do not see any approved booking that overlaps that time slot.";
            }

            $conflicts = $approvedBookings
                ->filter(fn($booking) => $this->hasTimeOverlap(
                    $date,
                    $normalizedRequestedStart,
                    $normalizedRequestedEnd,
                    (string) $booking['time_start'],
                    (string) $booking['time_end'],
                ))
                ->values();

            if ($conflicts->isEmpty()) {
                return "{$facility->name} is available on {$date} from {$normalizedRequestedStart} to {$normalizedRequestedEnd}. Existing approved bookings on that date do not overlap your requested time.";
            }

            $conflictLines = $conflicts->map(function ($booking) {
                return "- {$booking['time_start']} - {$booking['time_end']} | Request #{$booking['request_id']} | {$booking['title']}";
            })->implode("\n");

            return "{$facility->name} is NOT available on {$date} from {$normalizedRequestedStart} to {$normalizedRequestedEnd} because it overlaps with these approved bookings:\n{$conflictLines}\n\nIf you want, I can help find another time slot or facility.";
        }

        if ($approvedBookings->isEmpty()) {
            return "{$facility->name} is available on {$date} based on the current approved bookings. I do not see any approved booking for that room on that date.\n\nIf you want, I can help you continue with the booking details.";
        }

        $bookingLines = $approvedBookings->map(function ($booking) {
            return "- {$booking['time_start']} - {$booking['time_end']} | Request #{$booking['request_id']} | {$booking['title']}";
        })->implode("\n");

        return "{$facility->name} has approved bookings on {$date} during these time slots:\n{$bookingLines}\n\nI cannot say the room is unavailable for the whole day based on this alone. If you tell me your preferred start and end time, I can check whether your time slot overlaps with any existing booking.";
    }

    private function buildAvailabilityCheckResult(
        $facility,
        string $date,
        $allRequests,
        ?string $requestedStart = null,
        ?string $requestedEnd = null
    ): array {
        $content = $this->buildAvailabilityResponse($facility, $date, $allRequests, $requestedStart, $requestedEnd);

        $status = 'info';
        $reason = 'informational';
        $actions = ['change_time_slot', 'other_facility', 'cancel'];

        if (Str::contains($content, ' is NOT available on ')) {
            $status = 'unavailable';
            $reason = 'overlap_conflict';
            $actions = ['change_time_slot', 'other_facility', 'cancel'];
        } elseif (Str::contains($content, ' is available on ')) {
            $status = 'available';
            $reason = 'no_conflict';
            $actions = ['proceed_booking', 'change_time_slot', 'other_facility', 'cancel'];
        } elseif (Str::contains($content, "couldn't understand the requested time format")) {
            $status = 'needs_time_format';
            $reason = 'invalid_time_format';
            $actions = ['change_time_slot', 'cancel'];
        } elseif (Str::contains($content, 'end time is not after the start time')) {
            $status = 'invalid_time_range';
            $reason = 'invalid_time_range';
            $actions = ['change_time_slot', 'cancel'];
        } elseif (Str::contains($content, 'If you tell me your preferred start and end time')) {
            $status = 'needs_time_slot';
            $reason = 'time_required';
            $actions = ['change_time_slot', 'cancel'];
        }

        return [
            'content' => $content,
            'deterministic' => [
                'source' => 'deterministic_check',
                'check' => 'availability',
                'status' => $status,
                'reason' => $reason,
                'actions' => $actions,
                'facility_id' => (int) ($facility->id ?? 0),
                'facility_name' => (string) ($facility->name ?? ''),
                'date' => $date,
                'time_start' => is_string($requestedStart) ? $this->normalizeTimeValue($requestedStart) : null,
                'time_end' => is_string($requestedEnd) ? $this->normalizeTimeValue($requestedEnd) : null,
            ],
        ];
    }

    private function tryFaqSemanticMatch(?string $latestUserMessage, bool $faqMode): ?array
    {
        $match = $this->faqMatchingService->match($latestUserMessage);
        if (!$match) {
            return null;
        }

        $matchType = (string) ($match['match_type'] ?? 'semantic');
        $isLexical = $matchType === 'lexical';
        $source = $isLexical ? 'faq_lexical_fallback' : 'faq_semantic_match';
        $reason = $isLexical ? 'lexical_fallback' : 'semantic_similarity';

        return [
            'content' => $match['answer'],
            'deterministic' => [
                'source' => $source,
                'check' => 'faq',
                'status' => 'matched',
                'reason' => $reason,
                'faq_mode' => $faqMode,
                'rule_id' => (int) $match['rule_id'],
                'question' => (string) $match['question'],
                'similarity' => (float) $match['similarity'],
                'match_type' => $matchType,
            ],
            'context' => [
                'faq_mode' => $faqMode,
                'faq_match_rule_id' => (int) $match['rule_id'],
                'faq_match_question' => Str::limit((string) $match['question'], 250),
                'faq_match_similarity' => round((float) $match['similarity'], 4),
                'faq_match_type' => $matchType,
                'response_source' => $source,
            ],
        ];
    }

    private function isFaqSuggestionConfirmation(?string $latestUserMessage): bool
    {
        $message = Str::lower(trim((string) $latestUserMessage));
        if ($message === '') {
            return false;
        }

        return (bool) preg_match('/^(yes|y|yep|yeah|correct|right|sure|ok|okay|go ahead|please do)[.!?]*$/', $message);
    }

    private function isFaqSuggestionRejection(?string $latestUserMessage): bool
    {
        $message = Str::lower(trim((string) $latestUserMessage));
        if ($message === '') {
            return false;
        }

        return (bool) preg_match('/^(no|n|nope|nah|not that|different one|other one|wrong)[.!?]*$/', $message);
    }

    private function classifyFaqSuggestionIntent(?string $latestUserMessage, string $suggestedQuestion): string
    {
        $reply = trim((string) $latestUserMessage);
        if ($reply === '') {
            return 'other';
        }

        $messages = [
            [
                'role' => 'system',
                'content' => "You classify user intent for FAQ suggestion confirmation.\n"
                    . "Given a user's reply to a suggested FAQ question, return ONLY strict JSON with one key:\n"
                    . "{\"intent\":\"confirm_suggestion\"|\"reject_suggestion\"|\"other\"}\n"
                    . "Rules:\n"
                    . "- confirm_suggestion: user agrees to use suggested FAQ (e.g., yes, yeah, that's it, that one, go with that).\n"
                    . "- reject_suggestion: user rejects suggestion (e.g., no, not that, different one, wrong).\n"
                    . "- other: unclear or unrelated.\n"
                    . "Output JSON only. No extra text.",
            ],
            [
                'role' => 'user',
                'content' => "Suggested FAQ question: {$suggestedQuestion}\nUser reply: {$reply}",
            ],
        ];

        try {
            $client = new Client(['timeout' => 60]);
            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model' => $this->chatModel(),
                    'messages' => $messages,
                    'stream' => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);
            $raw = trim((string) ($data['message']['content'] ?? $data['response'] ?? ''));
            $parsed = json_decode($raw, true);

            $intent = is_array($parsed) ? trim((string) ($parsed['intent'] ?? '')) : '';
            return in_array($intent, ['confirm_suggestion', 'reject_suggestion', 'other'], true)
                ? $intent
                : 'other';
        } catch (\Throwable $exception) {
            \Log::warning('FAQ suggestion intent classifier failed: ' . $exception->getMessage());
            return 'other';
        }
    }

    private function extractLatestFaqSuggestedQuestion(array $messages): ?string
    {
        for ($index = count($messages) - 1; $index >= 0; $index--) {
            $message = $messages[$index] ?? [];
            if (($message['role'] ?? null) !== 'assistant') {
                continue;
            }

            $content = trim((string) ($message['content'] ?? ''));
            if ($content === '') {
                continue;
            }

            if (preg_match('/Did you mean:\s*"([^"]+)"/i', $content, $matches)) {
                $suggestedQuestion = trim((string) ($matches[1] ?? ''));
                return $suggestedQuestion !== '' ? $suggestedQuestion : null;
            }
        }

        return null;
    }

    private function resolveFaqFromSuggestionConfirmation(array $messages, ?string $latestUserMessage, bool $faqMode): ?array
    {
        if (!$faqMode) {
            return null;
        }

        $suggestedQuestion = $this->extractLatestFaqSuggestedQuestion($messages);
        if (!$suggestedQuestion) {
            return null;
        }

        $confirmationSource = 'pattern';
        $classifierIntent = null;
        $confirmed = $this->isFaqSuggestionConfirmation($latestUserMessage);

        if (!$confirmed) {
            if ($this->isFaqSuggestionRejection($latestUserMessage)) {
                return null;
            }

            $classifierIntent = $this->classifyFaqSuggestionIntent($latestUserMessage, $suggestedQuestion);
            $confirmationSource = 'classifier';
            $confirmed = $classifierIntent === 'confirm_suggestion';
        }

        if (!$confirmed) {
            return null;
        }

        $match = $this->faqMatchingService->findByQuestion($suggestedQuestion);
        if (!$match) {
            return null;
        }

        return [
            'content' => $match['answer'],
            'deterministic' => [
                'source' => 'faq_suggestion_confirmation',
                'check' => 'faq',
                'status' => 'matched',
                'reason' => $confirmationSource === 'classifier'
                    ? 'near_match_confirmation_classifier'
                    : 'near_match_confirmation',
                'faq_mode' => true,
                'rule_id' => (int) $match['rule_id'],
                'question' => (string) $match['question'],
                'similarity' => (float) $match['similarity'],
                'match_type' => 'suggestion_confirmation',
            ],
            'context' => [
                'faq_mode' => true,
                'faq_match_rule_id' => (int) $match['rule_id'],
                'faq_match_question' => Str::limit((string) $match['question'], 250),
                'faq_match_similarity' => round((float) $match['similarity'], 4),
                'faq_match_type' => 'suggestion_confirmation',
                'faq_near_match_confirmed' => true,
                'faq_near_match_confirmation_source' => $confirmationSource,
                'faq_near_match_confirmation_intent' => $classifierIntent,
                'response_source' => 'faq_suggestion_confirmation',
            ],
        ];
    }

    private function getFaqConversationMessages(array $messages, int $limit = 12): array
    {
        $conversation = array_values(array_filter($messages, function ($message) {
            $role = $message['role'] ?? null;
            if (!in_array($role, ['user', 'assistant'], true)) {
                return false;
            }

            return trim((string) ($message['content'] ?? '')) !== '';
        }));

        return array_slice($conversation, -$limit);
    }

    private function buildFaqKnowledgeBlock(array $retrievedFaqs): string
    {
        if (empty($retrievedFaqs)) {
            return '(No FAQ snippets retrieved for this turn.)';
        }

        $lines = [];
        foreach ($retrievedFaqs as $index => $faq) {
            $ruleId = (int) ($faq['rule_id'] ?? 0);
            $question = trim((string) ($faq['question'] ?? ''));
            $answer = trim((string) ($faq['answer'] ?? ''));
            $similarity = isset($faq['similarity']) ? round((float) $faq['similarity'], 4) : null;

            $lines[] = "FAQ #" . ($index + 1)
                . " (rule_id={$ruleId}" . ($similarity !== null ? ", similarity={$similarity}" : '') . ")\n"
                . "Question: {$question}\n"
                . "Answer: {$answer}";
        }

        return implode("\n\n", $lines);
    }

    private function buildFaqRetrievalMeta(array $retrievedFaqs): array
    {
        $ruleIds = [];
        $similarities = [];

        foreach ($retrievedFaqs as $faq) {
            $ruleId = (int) ($faq['rule_id'] ?? 0);
            if ($ruleId > 0) {
                $ruleIds[] = $ruleId;
            }

            if (isset($faq['similarity'])) {
                $similarities[] = round((float) $faq['similarity'], 4);
            }
        }

        return [
            'rule_ids' => array_slice($ruleIds, 0, 5),
            'similarities' => array_slice($similarities, 0, 5),
        ];
    }

    private function prioritizeFaqCandidates(array $retrievedFaqs, array $primaryMatch): array
    {
        $primaryRuleId = (int) ($primaryMatch['rule_id'] ?? 0);
        if ($primaryRuleId <= 0) {
            return $retrievedFaqs;
        }

        $primary = [
            'rule_id' => $primaryRuleId,
            'question' => (string) ($primaryMatch['question'] ?? ''),
            'answer' => (string) ($primaryMatch['answer'] ?? ''),
            'similarity' => isset($primaryMatch['similarity']) ? (float) $primaryMatch['similarity'] : 1.0,
        ];

        $rest = array_values(array_filter($retrievedFaqs, fn(array $faq) => (int) ($faq['rule_id'] ?? 0) !== $primaryRuleId));
        array_unshift($rest, $primary);

        return array_slice($rest, 0, 5);
    }

    private function generateFaqConversationalAnswer(
        array $messages,
        ?string $latestUserMessage,
        array $retrievedFaqs,
        ?array $primaryMatch = null
    ): ?string {
        if (empty($retrievedFaqs)) {
            return null;
        }

        $knowledgeBlock = $this->buildFaqKnowledgeBlock($retrievedFaqs);
        $primaryHint = '';
        if ($primaryMatch) {
            $primaryQuestion = trim((string) ($primaryMatch['question'] ?? ''));
            if ($primaryQuestion !== '') {
                $primaryHint = "\nLikely primary FAQ for this turn: {$primaryQuestion}";
            }
        }

        $faqConversationMessages = $this->getFaqConversationMessages($messages);
        $llmMessages = array_merge(
            [[
                'role' => 'system',
                'content' => "You are the assistant in FAQ mode.\n"
                    . "You must answer conversationally using ONLY the FAQ snippets below as source-of-truth.\n"
                    . "Do not invent facts, steps, approvals, IDs, or requirements not present in snippets.\n"
                    . "If user asks outside FAQ knowledge, politely state FAQ mode is limited to FAQ content and suggest exiting FAQ mode for booking/availability help.\n"
                    . "Do not cite FAQ IDs unless user explicitly asks for source.\n"
                    . "Keep the answer natural and concise.\n\n"
                    . "FAQ SNIPPETS:\n{$knowledgeBlock}{$primaryHint}",
            ]],
            $faqConversationMessages
        );

        if (
            $latestUserMessage
            && (
                empty($faqConversationMessages)
                || (($faqConversationMessages[array_key_last($faqConversationMessages)]['role'] ?? null) !== 'user')
            )
        ) {
            $llmMessages[] = ['role' => 'user', 'content' => $latestUserMessage];
        }

        try {
            $client = new Client(['timeout' => 120]);
            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model' => $this->chatModel(),
                    'messages' => $llmMessages,
                    'stream' => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);
            $content = trim((string) ($data['message']['content'] ?? $data['response'] ?? ''));
            return $content !== '' ? $content : null;
        } catch (\Throwable $exception) {
            \Log::warning('FAQ conversational response failed: ' . $exception->getMessage());
            return null;
        }
    }

    private function generateFaqClarifyingResponse(
        array $messages,
        ?string $latestUserMessage,
        array $retrievedFaqs,
        ?array $nearMatch = null
    ): string {
        $nearQuestion = trim((string) ($nearMatch['question'] ?? ''));
        $faqTitles = array_slice(array_map(
            fn(array $faq) => trim((string) ($faq['question'] ?? '')),
            $retrievedFaqs
        ), 0, 5);
        $faqTitles = array_values(array_filter($faqTitles, fn(string $title) => $title !== ''));

        $fallback = $nearQuestion !== ''
            ? 'Are you asking about "' . $nearQuestion . '"?'
            : 'Could you clarify which FAQ topic you want help with?';

        $conversation = $this->getFaqConversationMessages($messages, 10);
        $llmMessages = array_merge(
            [[
                'role' => 'system',
                'content' => "You are in FAQ mode. Ask ONE concise clarifying question only.\n"
                    . "Do not answer yet.\n"
                    . "Use the candidate FAQ titles to narrow intent.\n"
                    . "Keep tone natural and helpful.\n"
                    . "Write as the assistant addressing the user directly.\n"
                    . "Do NOT write from the user's perspective (avoid lines like 'How can I...').\n"
                    . "Prefer phrasing like: 'Are you asking ...?'\n"
                    . "Use at most two short sentences.\n"
                    . "Output plain text only.",
            ]],
            $conversation,
            [[
                'role' => 'user',
                'content' => "User message: " . trim((string) $latestUserMessage) . "\n"
                    . "Candidate FAQ titles:\n- " . (!empty($faqTitles) ? implode("\n- ", $faqTitles) : '(none)')
                    . ($nearQuestion !== '' ? "\nClosest title: {$nearQuestion}" : ''),
            ]]
        );

        $content = null;

        try {
            $client = new Client(['timeout' => 60]);
            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model' => $this->chatModel(),
                    'messages' => $llmMessages,
                    'stream' => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);
            $content = trim((string) ($data['message']['content'] ?? $data['response'] ?? ''));
        } catch (\Throwable $exception) {
            \Log::warning('FAQ clarification response generation failed: ' . $exception->getMessage());
        }

        if ($content === null || $content === '') {
            $content = $fallback;
        }

        $content = trim((string) preg_replace('/\s+/', ' ', $content));

        // If the model accidentally writes as the user (first-person intent), rewrite to assistant voice.
        if (preg_match('/^\s*(how|what|can|could|should|do)\s+i\b/i', $content)) {
            $content = $fallback;
        }

        if ($nearQuestion !== '') {
            $hasDidYouMean = preg_match('/did you mean/i', $content) === 1;
            $mentionsNearQuestion = Str::contains(Str::lower($content), Str::lower($nearQuestion));

            if (!$hasDidYouMean && !$mentionsNearQuestion) {
                $content = rtrim($content, " \t\n\r\0\x0B.?");
                $content .= '? Or did you mean: "' . $nearQuestion . '"?';
            }
        }

        return $content;
    }

    private function buildFaqClarifierAnchorKey(?array $nearMatch, array $retrievedFaqs, ?string $latestUserMessage): string
    {
        $nearRuleId = (int) (($nearMatch['rule_id'] ?? 0));
        if ($nearRuleId > 0) {
            return "rule:{$nearRuleId}";
        }

        $topRuleId = (int) (($retrievedFaqs[0]['rule_id'] ?? 0));
        if ($topRuleId > 0) {
            return "rule:{$topRuleId}";
        }

        $normalizedMessage = Str::lower(trim((string) $latestUserMessage));
        return 'msg:' . substr(md5($normalizedMessage), 0, 12);
    }

    private function handleFaqModeConversation(array $messages, ?string $latestUserMessage): array
    {
        $topK = max(1, min(20, (int) config('ollama-laravel.faq_mode_top_k', 5)));
        $retrievedFaqs = $this->faqMatchingService->retrieveCandidates($latestUserMessage, $topK);
        $retrievalMeta = $this->buildFaqRetrievalMeta($retrievedFaqs);

        $suggestionConfirmation = $this->resolveFaqFromSuggestionConfirmation($messages, $latestUserMessage, true);
        if ($suggestionConfirmation) {
            $primaryMatch = [
                'rule_id' => (int) ($suggestionConfirmation['deterministic']['rule_id'] ?? 0),
                'question' => (string) ($suggestionConfirmation['deterministic']['question'] ?? ''),
                'answer' => (string) ($suggestionConfirmation['content'] ?? ''),
                'similarity' => (float) ($suggestionConfirmation['deterministic']['similarity'] ?? 1.0),
            ];
            $retrievedWithPrimary = $this->prioritizeFaqCandidates($retrievedFaqs, $primaryMatch);
            $content = $this->generateFaqConversationalAnswer(
                $messages,
                $latestUserMessage,
                $retrievedWithPrimary,
                $primaryMatch
            ) ?? (string) ($suggestionConfirmation['content'] ?? '');

            $this->clearFaqState();

            return [
                'content' => $content,
                'deterministic' => [
                    'source' => 'faq_conversational_rag',
                    'check' => 'faq',
                    'status' => 'grounded_answer',
                    'reason' => 'suggestion_confirmation',
                    'faq_mode' => true,
                    'rule_id' => $primaryMatch['rule_id'],
                    'question' => $primaryMatch['question'],
                    'similarity' => $primaryMatch['similarity'],
                    'match_type' => 'suggestion_confirmation',
                    'retrieved_rule_ids' => $retrievalMeta['rule_ids'],
                    'retrieved_similarities' => $retrievalMeta['similarities'],
                ],
                'context' => array_merge(
                    ['faq_mode' => true],
                    $suggestionConfirmation['context'] ?? [],
                    [
                        'faq_paraphrased' => false,
                        'faq_no_match' => false,
                        'faq_clarifier_asked' => false,
                        'faq_retrieval_rule_ids' => $retrievalMeta['rule_ids'],
                        'faq_retrieval_similarities' => $retrievalMeta['similarities'],
                        'response_source' => 'faq_conversational_rag',
                    ]
                ),
            ];
        }

        $matchedFaq = $this->faqMatchingService->match($latestUserMessage);
        if ($matchedFaq) {
            $retrievedWithPrimary = $this->prioritizeFaqCandidates($retrievedFaqs, $matchedFaq);
            $content = $this->generateFaqConversationalAnswer(
                $messages,
                $latestUserMessage,
                $retrievedWithPrimary,
                $matchedFaq
            ) ?? (string) ($matchedFaq['answer'] ?? '');

            $this->clearFaqState();

            return [
                'content' => $content,
                'deterministic' => [
                    'source' => 'faq_conversational_rag',
                    'check' => 'faq',
                    'status' => 'grounded_answer',
                    'reason' => 'grounded_match',
                    'faq_mode' => true,
                    'rule_id' => (int) $matchedFaq['rule_id'],
                    'question' => (string) $matchedFaq['question'],
                    'similarity' => (float) $matchedFaq['similarity'],
                    'match_type' => (string) ($matchedFaq['match_type'] ?? 'semantic'),
                    'retrieved_rule_ids' => $retrievalMeta['rule_ids'],
                    'retrieved_similarities' => $retrievalMeta['similarities'],
                ],
                'context' => [
                    'faq_mode' => true,
                    'faq_match_rule_id' => (int) $matchedFaq['rule_id'],
                    'faq_match_question' => Str::limit((string) $matchedFaq['question'], 250),
                    'faq_match_similarity' => round((float) $matchedFaq['similarity'], 4),
                    'faq_match_type' => (string) ($matchedFaq['match_type'] ?? 'semantic'),
                    'faq_paraphrased' => false,
                    'faq_no_match' => false,
                    'faq_clarifier_asked' => false,
                    'faq_retrieval_rule_ids' => $retrievalMeta['rule_ids'],
                    'faq_retrieval_similarities' => $retrievalMeta['similarities'],
                    'response_source' => 'faq_conversational_rag',
                ],
            ];
        }

        $nearMatch = $this->faqMatchingService->suggestNearMatch($latestUserMessage);
        $anchorKey = $this->buildFaqClarifierAnchorKey($nearMatch, $retrievedFaqs, $latestUserMessage);
        $faqState = $this->getFaqState();
        $clarifierAlreadyAsked = (bool) ($faqState['clarifier_asked'] ?? false)
            && ((string) ($faqState['anchor_key'] ?? '') === $anchorKey);

        if (!$clarifierAlreadyAsked) {
            $content = $this->generateFaqClarifyingResponse($messages, $latestUserMessage, $retrievedFaqs, $nearMatch);
            $this->saveFaqState([
                'clarifier_asked' => true,
                'anchor_key' => $anchorKey,
                'updated_at' => now()->toIso8601String(),
            ]);

            return [
                'content' => $content,
                'deterministic' => [
                    'source' => 'faq_conversational_rag',
                    'check' => 'faq',
                    'status' => 'needs_clarification',
                    'reason' => 'low_confidence',
                    'faq_mode' => true,
                    'near_match_question' => trim((string) ($nearMatch['question'] ?? '')) ?: null,
                    'near_match_similarity' => isset($nearMatch['similarity']) ? (float) $nearMatch['similarity'] : null,
                    'near_match_type' => trim((string) ($nearMatch['match_type'] ?? '')) ?: null,
                    'retrieved_rule_ids' => $retrievalMeta['rule_ids'],
                    'retrieved_similarities' => $retrievalMeta['similarities'],
                ],
                'context' => [
                    'faq_mode' => true,
                    'faq_paraphrased' => false,
                    'faq_no_match' => false,
                    'faq_clarifier_asked' => true,
                    'faq_near_match_question' => !empty($nearMatch['question']) ? Str::limit((string) $nearMatch['question'], 250) : null,
                    'faq_near_match_similarity' => isset($nearMatch['similarity']) ? round((float) $nearMatch['similarity'], 4) : null,
                    'faq_near_match_type' => !empty($nearMatch['match_type']) ? (string) $nearMatch['match_type'] : null,
                    'faq_retrieval_rule_ids' => $retrievalMeta['rule_ids'],
                    'faq_retrieval_similarities' => $retrievalMeta['similarities'],
                    'response_source' => 'faq_conversational_rag',
                ],
            ];
        }

        $faqNoMatch = $this->buildFaqNoMatchResponse(true, $nearMatch);
        $this->clearFaqState();
        $faqNoMatch['deterministic']['source'] = 'faq_conversational_rag';
        $faqNoMatch['deterministic']['reason'] = 'low_confidence_after_clarification';
        $faqNoMatch['deterministic']['retrieved_rule_ids'] = $retrievalMeta['rule_ids'];
        $faqNoMatch['deterministic']['retrieved_similarities'] = $retrievalMeta['similarities'];
        $faqNoMatch['context'] = array_merge($faqNoMatch['context'] ?? [], [
            'faq_clarifier_asked' => true,
            'faq_retrieval_rule_ids' => $retrievalMeta['rule_ids'],
            'faq_retrieval_similarities' => $retrievalMeta['similarities'],
            'response_source' => 'faq_conversational_rag',
        ]);

        return $faqNoMatch;
    }

    private function buildFaqNoMatchResponse(bool $faqMode, ?array $nearMatch = null): array
    {
        $nearQuestion = trim((string) ($nearMatch['question'] ?? ''));
        $nearSimilarity = isset($nearMatch['similarity']) ? (float) $nearMatch['similarity'] : null;
        $nearType = trim((string) ($nearMatch['match_type'] ?? ''));

        $content = 'No FAQ match found. Please rephrase your question so I can match it to our configured FAQs.';
        if ($nearQuestion !== '') {
            $content .= " Did you mean: \"{$nearQuestion}\"?";
        }

        return [
            'content' => $content,
            'deterministic' => [
                'source' => 'faq_no_match',
                'check' => 'faq',
                'status' => 'no_match',
                'reason' => 'no_confident_faq_match',
                'faq_mode' => $faqMode,
                'near_match_question' => $nearQuestion !== '' ? $nearQuestion : null,
                'near_match_similarity' => $nearSimilarity,
                'near_match_type' => $nearType !== '' ? $nearType : null,
            ],
            'context' => [
                'faq_mode' => $faqMode,
                'faq_paraphrased' => false,
                'faq_no_match' => true,
                'faq_near_match_question' => $nearQuestion !== '' ? Str::limit($nearQuestion, 250) : null,
                'faq_near_match_similarity' => $nearSimilarity !== null ? round($nearSimilarity, 4) : null,
                'faq_near_match_type' => $nearType !== '' ? $nearType : null,
                'response_source' => 'faq_no_match',
            ],
        ];
    }

    private function streamTextTokens(string $content, int $chunkSize = 3, int $delayMicroseconds = 8000): void
    {
        $text = (string) $content;
        if ($text === '') {
            return;
        }

        $length = strlen($text);
        for ($offset = 0; $offset < $length; $offset += $chunkSize) {
            $token = substr($text, $offset, $chunkSize);
            echo "data: " . json_encode(['token' => $token]) . "\n\n";
            ob_flush();
            flush();

            if ($delayMicroseconds > 0) {
                usleep($delayMicroseconds);
            }
        }
    }

    private function storeAssistantReply(array $incomingMessages, string $content): void
    {
        $userAndAssistantMessages = array_filter($incomingMessages, fn($m) => in_array($m['role'], ['user', 'assistant']));
        $userAndAssistantMessages[] = [
            'role' => 'assistant',
            'content' => $content,
        ];
        $this->saveSession(array_values($userAndAssistantMessages));
    }

    private function extractSelectedContext(?string $latestUserMessage, $allFacilities): array
    {
        $parsed = $this->extractFacilityAndDateFromMessage($latestUserMessage, $allFacilities);

        return [
            'selected_facility' => $parsed['facility']
                ? [
                    'id' => $parsed['facility']->id,
                    'name' => $parsed['facility']->name,
                ]
                : null,
            'selected_date' => $parsed['date'],
        ];
    }

    private function buildLogContext(
        ?string $latestUserMessage,
        mixed $participantCount,
        mixed $bookingContext,
        $allRequests,
        $allFacilities,
        int $equipmentCount,
        int $rulesCount,
        bool $rulesInjected,
        bool $approvedBookingContextInjected,
        bool $deterministicAvailabilityInjected,
        bool $facilityFilterApplied,
        array $extra = [],
    ): array {
        $bookingContextText = trim((string) $bookingContext);
        $routingSource = null;
        if ($bookingContextText !== '') {
            $routingSource = Str::contains(Str::lower($bookingContextText), ['guided', 'quick reply context'])
                ? 'guided_step'
                : 'chat_input';
        }

        return array_merge([
            'participant_count' => is_numeric($participantCount) ? (int) $participantCount : null,
            'booking_context' => $bookingContext ? Str::limit(trim((string) $bookingContext), 500) : null,
            'routing_source' => $routingSource,
            'rules_injected' => $rulesInjected,
            'rules_loaded' => $rulesCount,
            'approved_booking_context_injected' => $approvedBookingContextInjected,
            'deterministic_availability_injected' => $deterministicAvailabilityInjected,
            'facility_filter_applied' => $facilityFilterApplied,
            'facility_count_loaded' => $allFacilities->count(),
            'equipment_count_loaded' => $equipmentCount,
            'request_count_loaded' => $allRequests->count(),
            'approved_request_count' => $allRequests->filter(fn($request) => $request->status->value === 'Approved')->count(),
            ...$this->extractSelectedContext($latestUserMessage, $allFacilities),
        ], $extra);
    }

    private function applyBookingPolicyToRules(array $rules): array
    {
        return array_values(array_filter($rules, function ($rule) {
            $normalizedRule = trim((string) $rule);
            if ($normalizedRule === '') {
                return false;
            }

            // Description/additional information is optional in current policy.
            if (preg_match(
                '/(\bdescription\b.*\b(required|must|required field)\b)|(\b(required|must|required field)\b.*\bdescription\b)/i',
                $normalizedRule
            )) {
                return false;
            }

            // Equipment availability is backend-authoritative at submit-time.
            // Drop chat-time refusal rules that block equipment quantity collection.
            if (preg_match(
                '/\bequipment\b.*\b(available|availability|stock|remaining|exceed|limit|quantity|qty|insufficient|not enough|cannot|can\'t|do not|don\'t)\b/i',
                $normalizedRule
            ) || preg_match(
                '/\b(available|availability|stock|remaining|exceed|limit|quantity|qty|insufficient|not enough|cannot|can\'t|do not|don\'t)\b.*\bequipment\b/i',
                $normalizedRule
            )) {
                return false;
            }

            return true;
        }));
    }

    private function extractStructuredPayload(?string $assistantMessage): ?array
    {
        if (!$assistantMessage) {
            return null;
        }

        $trimmed = trim($assistantMessage);
        $decoded = json_decode($trimmed, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && isset($decoded['facility_bookings'])) {
            return $decoded;
        }

        $length = strlen($assistantMessage);
        $depth = 0;
        $start = null;

        for ($i = 0; $i < $length; $i++) {
            $char = $assistantMessage[$i];

            if ($char === '{') {
                if ($depth === 0) {
                    $start = $i;
                }
                $depth++;
                continue;
            }

            if ($char !== '}' || $depth === 0) {
                continue;
            }

            $depth--;
            if ($depth !== 0 || $start === null) {
                continue;
            }

            $candidate = substr($assistantMessage, $start, $i - $start + 1);
            $parsed = json_decode($candidate, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($parsed) && isset($parsed['facility_bookings'])) {
                return $parsed;
            }

            $start = null;
        }

        return null;
    }

    public function chat(Request $request): JsonResponse
    {
        try {
            set_time_limit(300);

            $sessionMessages  = $this->loadSession();
            $incomingMessages = $request->input('messages', []);
            $latestUserMessage = $this->getLatestUserMessageContent($incomingMessages);
            $sessionId = $request->session()->getId();
            $faqMode = $request->boolean('faq_mode');
            if (!$faqMode) {
                $this->clearFaqState();
            }

            $sessionMessages = array_filter($sessionMessages, function($msg) {
                $content = $msg['content'] ?? '';
                $isStaleContext = 
                    strpos($content, 'APPROVED BOOKINGS TABLE') !== false ||
                    strpos($content, 'CURRENT FACILITY REQUESTS') !== false ||
                    strpos($content, 'Available Facilities') !== false ||
                    strpos($content, 'Available Equipment') !== false ||
                    strpos($content, 'FACILITY CAPACITY MATCHING') !== false ||
                    strpos($content, 'DETERMINISTIC AVAILABILITY CHECK') !== false ||
                    strpos($content, 'IMPORTANT REQUEST CREATION CAPABILITY') !== false ||
                    strpos($content, 'When the user asks whether a facility is available') !== false;
                
                return $msg['role'] !== 'system' || !$isStaleContext;
            });

            $messages = array_merge($sessionMessages, $incomingMessages);

            $participantCount = $request->input('participant_count');
            $bookingContext   = $request->input('booking_context');
            $allRequests      = collect();
            $allFacilities    = collect();
            $rules = [];
            $rulesInjected = false;
            $approvedBookingContextInjected = false;
            $deterministicAvailabilityInjected = false;
            $facilityFilterApplied = false;
            $equipmentCount = 0;

            try {
                // Fetch recent requests (both pending and approved) for context
                $allRequests = RequestModel::with(['user', 'requestFacilities', 'facilities'])
                    ->whereIn('status', ['Pending', 'Approved'])
                    ->latest()
                    ->limit(30)
                    ->get();

                // Keep request data for deterministic backend checks and logging only.
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch requests for chat: ' . $e->getMessage());
            }

            try {
                $allFacilities = Facility::orderBy('id', 'asc')->limit(50)->get(['id', 'name', 'building', 'capacity']);
                $facilities = $allFacilities->map(function ($f) {
                    return "ID {$f->id}: {$f->name} (Building: {$f->building}, Capacity: {$f->capacity})";
                })->toArray();

                if (!empty($facilities)) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "Available Facilities:\n- " . implode("\n- ", $facilities),
                    ]);
                }

                $equipmentRows = $this->getEquipmentContextRows(50);
                $equipment = array_map(fn($row) => $row['line'], $equipmentRows);
                $equipmentCount = count($equipmentRows);

                if (!empty($equipment)) {
                    array_unshift($messages, [
                        'role'    => 'system',
                        'content' => "Available Equipment:\n- " . implode("\n- ", $equipment),
                    ]);
                }
                if ($latestUserMessage) {
                    if ($faqMode) {
                        $faqModeResult = $this->handleFaqModeConversation($messages, $latestUserMessage);
                        $content = (string) ($faqModeResult['content'] ?? '');
                        $this->storeAssistantReply($incomingMessages, $content);
                        $this->chatbotLogService->logAssistantReply(
                            $latestUserMessage,
                            $content,
                            $this->buildLogContext(
                                $latestUserMessage,
                                $participantCount,
                                $bookingContext,
                                $allRequests,
                                $allFacilities,
                                $equipmentCount,
                                count($rules),
                                $rulesInjected,
                                $approvedBookingContextInjected,
                                $deterministicAvailabilityInjected,
                                $facilityFilterApplied,
                                array_merge(['faq_mode' => true], $faqModeResult['context'] ?? [])
                            ),
                            $sessionId,
                            'faq_answer',
                            'faq',
                        );

                        return response()->json([
                            'message' => [
                                'role' => 'assistant',
                                'content' => $content,
                            ],
                            'deterministic' => $faqModeResult['deterministic'] ?? [
                                'source' => 'faq_conversational_rag',
                                'check' => 'faq',
                                'status' => 'info',
                                'faq_mode' => true,
                            ],
                        ]);
                    }

                    $resolved = $this->resolveFacilityAndDateFromConversation($messages, $allFacilities);
                    $shouldRunAvailability = $this->shouldRunDeterministicAvailabilityCheck($latestUserMessage, $resolved, $allFacilities);

                    if (!$faqMode && $shouldRunAvailability) {
                        $availabilityResult = $this->buildAvailabilityCheckResult(
                            $resolved['facility'],
                            $resolved['date'],
                            $allRequests,
                            $resolved['time_start'] ?? null,
                            $resolved['time_end'] ?? null
                        );
                        $content = $availabilityResult['content'];
                        $this->storeAssistantReply($incomingMessages, $content);
                        $this->chatbotLogService->logAssistantReply(
                            $latestUserMessage,
                            $content,
                            $this->buildLogContext(
                                $latestUserMessage,
                                $participantCount,
                                $bookingContext,
                                $allRequests,
                                $allFacilities,
                                $equipmentCount,
                                count($rules),
                                $rulesInjected,
                                $approvedBookingContextInjected,
                                $deterministicAvailabilityInjected,
                                $facilityFilterApplied,
                                ['response_source' => 'deterministic_check', 'faq_mode' => false]
                            ),
                            $sessionId,
                            'deterministic_check',
                            'availability_check',
                        );

                        return response()->json([
                            'message' => [
                                'role' => 'assistant',
                                'content' => $content,
                            ],
                            'deterministic' => $availabilityResult['deterministic'],
                        ]);
                    }

                    if (!$faqMode) {
                        $faqResult = $this->tryFaqSemanticMatch($latestUserMessage, false);
                        if ($faqResult) {
                            $content = (string) $faqResult['content'];
                            $this->storeAssistantReply($incomingMessages, $content);
                            $this->chatbotLogService->logAssistantReply(
                                $latestUserMessage,
                                $content,
                                $this->buildLogContext(
                                    $latestUserMessage,
                                    $participantCount,
                                    $bookingContext,
                                    $allRequests,
                                    $allFacilities,
                                    $equipmentCount,
                                    count($rules),
                                    $rulesInjected,
                                    $approvedBookingContextInjected,
                                    $deterministicAvailabilityInjected,
                                    $facilityFilterApplied,
                                    array_merge(['faq_mode' => false], $faqResult['context'])
                                ),
                                $sessionId,
                                'faq_answer',
                                'faq',
                            );

                            return response()->json([
                                'message' => [
                                    'role' => 'assistant',
                                    'content' => $content,
                                ],
                                'deterministic' => $faqResult['deterministic'],
                            ]);
                        }
                    }

                }

                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "PARTICIPANT COUNT GUIDANCE:\nIf the user shares participant count, use it only for helpful guidance (for example, suggest rooms whose capacities are close to the count).\nDo NOT reject or block a booking based on participant count in chat.\nDo NOT claim final capacity approval in chat.\nFinal participant-capacity validation is performed by the backend during request submission.",
                ]);

                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "AI ROLE BOUNDARY (STRICT):\nYou are an assistant and rationale layer only.\n- Never compute or decide final operational truth for availability, conflicts, participant-capacity limits, or equipment slot limits.\n- Never refuse or approve requests based on your own calculations.\n- Deterministic backend checks and submission validation are the source of truth.\n- When backend deterministic output is available, explain it clearly and suggest next valid actions.",
                ]);

                array_unshift($messages, [
                    'role' => 'system',
                    'content' => "IMPORTANT REQUEST CREATION CAPABILITY:\nYou can create facility requests for the user. When they ask to create a request, collect the following information in this order:\n1. Title (brief request name)\n2. Participant Count (OPTIONAL, numeric; include if user provided it)\n3. Facility ID (from the available facilities list above)\n4. Equipment (optional list of equipment IDs and quantities needed, from the available equipment list above)\n5. Date (YYYY-MM-DD format)\n6. Start Time (HH:MM format in 24-hour)\n7. End Time (HH:MM format in 24-hour)\n8. Event Type (IMPORTANT - determine from context):\n   - 0 = Academic (default, regular academic events)\n   - 1 = Organizational (official school activities, department events)\n   - 2 = University (university-wide events)\n   - 3 = Government (government officials, external government events, high-authority visits)\n   *Map the selected Event Type to a priority level as follows: Academic=0, Organizational=1, University=1, Government=2.*\n9. Description (OPTIONAL)\n10. Additional Message (OPTIONAL)\n\nPARTICIPANT COUNT POLICY:\n- Participant count is guidance only during chat.\n- Never refuse a request purely because of participant count.\n- Backend validation is the final source of truth for participant-capacity checks at submission.\n\nEQUIPMENT POLICY:\n- During chat, never refuse equipment quantities based on availability math.\n- Do not say \"cannot fulfill\" due to stock/remaining quantity while collecting details.\n- If the user requests equipment, capture the requested equipment ID and quantity and continue.\n- Backend submission validation is the only source of truth for slot-aware equipment limits.\n- If submission fails, relay the backend validation message (including available quantity) and ask for an updated quantity.\n\nCRITICAL FACILITY ID RULE:\n- `facility_id` in the JSON must be a NUMERIC facility ID only\n- Never use a facility name, label, abbreviation, or room code string in `facility_id`\n- If the selected facility is MPH 6D (CEIT Small room), use its numeric ID from the Available Facilities list, not \"MPH 6D\"\n\nPRIORITY OVERRIDE SYSTEM: If the user's event is Organizational (type 1) or University (type 2) or Government (type 3), and there are existing requests at the same time with lower priority, the system will AUTOMATICALLY put those lower-priority requests on hold.\n\nFILE ATTACHMENT (OPTIONAL): Users may optionally upload supporting documents (JPG, PNG, PDF, DOC, XLSX, PPTX - max 10MB each). Files are not required to proceed with the request. If files are available, include them in the submission. If no files are provided, proceed without them.\n\nAfter collecting all required information and any optional files, construct the JSON payload exactly as shown below and present it to the user for confirmation. Ensure the JSON includes the correct `priority_level` based on the Event Type mapping above:\n{\"title\": \"...\", \"description\": \"...\", \"priority_level\": 0, \"participant_count\": 120, \"facility_bookings\": [{\"facility_id\": 6, \"date\": \"YYYY-MM-DD\", \"time_start\": \"HH:MM\", \"time_end\": \"HH:MM\", \"expected_capacity\": 120, \"equipment\": [{\"equipment_id\": ID, \"quantity_needed\": number}]}]}\n\nWait for the user to confirm 'yes' or 'proceed' before submitting the JSON. Once confirmed, output ONLY the JSON payload (no additional text) to trigger automatic submission to the database.",
                ]);
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch facilities/equipment for chat: ' . $e->getMessage());
            }

            try {
                $limitRules = max(1, min(200, (int) $request->input('rules_limit', 50)));
                $rules = RuleModel::policy()->orderBy('priority')->orderBy('id')->limit($limitRules)->get(['id', 'rule'])
                    ->map(fn($r) => trim($r->rule))->filter()->toArray();
                $rules = $this->applyBookingPolicyToRules($rules);

                $rulesListText = !empty($rules) ? implode("\n- ", $rules) : '';
                $rulesSummary  = "Please be aware of the following facility booking guidelines. If a request is directly relevant to these guidelines and would clearly violate one, politely explain the issue and guide toward a valid solution. If a guideline is vague, unrelated to the booking process, or would unnecessarily block a valid facility reservation, use your judgment to allow the request.";
                $rulesSummary .= !empty($rulesListText) ? "\nGuidelines:\n- " . $rulesListText : "\n(There are currently no configured guidelines.)";

                array_unshift($messages, ['role' => 'system', 'content' => $rulesSummary]);
                $rulesInjected = true;
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch Rules for chat: ' . $e->getMessage());
                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => 'Please be aware of facility booking guidelines stored in the system. If a request directly violates a relevant guideline, explain the issue politely and guide toward a valid solution. Do not unnecessarily block valid facility reservations.',
                ]);
            }

            if (!empty($bookingContext)) {
                array_unshift($messages, [
                    'role'    => 'system',
                    'content' => "BOOKING FLOW CONTEXT (HIGHEST PRIORITY):\n" . $bookingContext . "\n\nIMPORTANT: The user is currently in the middle of a structured booking process. Do NOT restart the process. Only assist based on the collected data and current step.",
                ]);
            }

            if (empty($messages)) {
                return response()->json(['error' => 'No messages provided'], 400);
            }

            $client   = new Client(['timeout' => 580]);
            $response = $client->post($this->ollamaUrl . '/api/chat', [
                'json' => [
                    'model'    => $this->chatModel(),
                    'messages' => $messages,
                    'stream'   => false,
                ],
            ]);

            $data = json_decode($response->getBody(), true);

            $userAndAssistantMessages = array_filter($incomingMessages, fn($m) => in_array($m['role'], ['user', 'assistant']));
            if (isset($data['message']['content'])) {
                $userAndAssistantMessages[] = [
                    'role'    => 'assistant',
                    'content' => $data['message']['content'],
                ];
            }
            $this->saveSession(array_values($userAndAssistantMessages));

            // Rule validation
            if (!empty($rules)) {
                try {
                    $assistantText = $data['message']['content'] ?? $data['response'] ?? (is_string($data) ? $data : '');

                    $validatorMessages = [
                        [
                            'role'    => 'system',
                            'content' => "You are a careful rules validator. Analyze if the assistant response CLEARLY AND DIRECTLY VIOLATES any hard constraints in the rules. Important distinctions:\n\n- VIOLATIONS (hard constraints): Explicit prohibitions like 'do not mention X', 'never do Y', 'forbidden topic', 'cannot discuss Z'\n- NOT VIOLATIONS (soft guidelines): Style preferences like 'be brief', 'be concise', 'use simple language', 'be friendly'\n\nPolicy override for this system:\n- Missing request description/additional information is NOT a violation. Description is optional.\n\nOnly flag something as a violation if it DIRECTLY contradicts a strict prohibition. Return ONLY valid JSON with key \"violations\" (array of rule indices, 0-based). Example: {\"violations\": [0,2]} or {\"violations\": []}. No extra text.",
                        ],
                        [
                            'role'    => 'user',
                            'content' => "Rules:\n- " . implode("\n- ", $rules) . "\n\nAssistant Response:\n" . $assistantText,
                        ],
                    ];

                    try {
                        $validatorResp = $client->post($this->ollamaUrl . '/api/chat', [
                            'json' => ['model' => $this->chatModel(), 'messages' => $validatorMessages, 'stream' => false],
                        ]);

                        if ($validatorResp->getStatusCode() >= 400) {
                            \Log::warning('Validator API returned error status: ' . $validatorResp->getStatusCode());
                            return response()->json($data);
                        }

                        $validatorData = json_decode($validatorResp->getBody(), true);
                        $jsonText      = $validatorData['message']['content'] ?? $validatorData['response'] ?? (is_string($validatorData) ? $validatorData : '');
                        $parsed        = @json_decode($jsonText, true);

                        if (is_array($parsed) && !empty($parsed['violations'])) {
                            $violationDetails = [];
                            foreach ($parsed['violations'] as $ruleIndex) {
                                if (isset($rules[$ruleIndex])) {
                                    $violationDetails[] = 'Rule #' . ($ruleIndex + 1) . ': ' . $rules[$ruleIndex];
                                }
                            }
                            $data = [
                                'message' => [
                                    'content' => "I cannot comply with that request because it would violate the following rules:\n\n" . implode("\n\n", $violationDetails),
                                    'role'    => 'assistant',
                                ],
                            ];
                        }
                    } catch (RequestException $ve) {
                        \Log::warning('Validator API request failed: ' . $ve->getMessage());
                        return response()->json($data);
                    }
                } catch (\Exception $e) {
                    \Log::warning('Rule validation failed: ' . $e->getMessage());
                }
            }

            $assistantMessage = $data['message']['content'] ?? $data['response'] ?? null;
            $logContext = $this->buildLogContext(
                $latestUserMessage,
                $participantCount,
                $bookingContext,
                $allRequests,
                $allFacilities,
                $equipmentCount,
                count($rules),
                $rulesInjected,
                $approvedBookingContextInjected,
                $deterministicAvailabilityInjected,
                $facilityFilterApplied,
                ['faq_mode' => $faqMode]
            );
            $payload = $this->extractStructuredPayload($assistantMessage);

            if ($payload) {
                $this->chatbotLogService->logPayloadGenerated(
                    $latestUserMessage,
                    $assistantMessage,
                    $payload,
                    array_merge($logContext, ['generated_payload' => true, 'request_creation' => true]),
                    $sessionId
                );
            } else {
                $this->chatbotLogService->logAssistantReply(
                    $latestUserMessage,
                    $assistantMessage,
                    array_merge($logContext, ['response_source' => 'ai_rationale']),
                    $sessionId,
                    'ai_rationale',
                    'ai_rationale'
                );
            }

            return response()->json($data);

        } catch (RequestException $e) {
            \Log::error('Chat error: ' . $e->getMessage());
            $this->chatbotLogService->logError(
                $latestUserMessage ?? null,
                $e->getMessage(),
                [],
                $request->session()->getId(),
            );
            return response()->json([
                'error'   => 'Failed to connect to Ollama',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        } catch (\Exception $e) {
            \Log::error('Chat error: ' . $e->getMessage());
            $this->chatbotLogService->logError(
                $latestUserMessage ?? null,
                $e->getMessage(),
                [],
                $request->session()->getId(),
            );
            return response()->json([
                'error'   => 'Failed to process chat request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function stream(Request $request): StreamedResponse
    {
        // Collect all the same context as chat()
            $messages         = $request->input('messages', []);
            $participantCount = $request->input('participant_count');
            $bookingContext   = $request->input('booking_context');
            $allRequests      = collect();
            $allFacilities    = collect();
            $latestUserMessage = $this->getLatestUserMessageContent($request->input('messages', []));
            $sessionId = $request->session()->getId();
            $faqMode = $request->boolean('faq_mode');
            if (!$faqMode) {
                $this->clearFaqState();
            }
            $rulesInjected = false;
            $approvedBookingContextInjected = false;
            $deterministicAvailabilityInjected = false;
            $equipmentCount = 0;
            $facilityFilterApplied = false;

        // Load session history and merge
        $sessionMessages = $this->loadSession();
        
        $sessionMessages = array_filter($sessionMessages, function($msg) {
            $content = $msg['content'] ?? '';
            $isStaleContext = 
                strpos($content, 'APPROVED BOOKINGS TABLE') !== false ||
                strpos($content, 'CURRENT FACILITY REQUESTS') !== false ||
                strpos($content, 'Available Facilities') !== false ||
                strpos($content, 'Available Equipment') !== false ||
                strpos($content, 'FACILITY CAPACITY MATCHING') !== false ||
                strpos($content, 'DETERMINISTIC AVAILABILITY CHECK') !== false ||
                strpos($content, 'IMPORTANT REQUEST CREATION CAPABILITY') !== false ||
                strpos($content, 'When the user asks whether a facility is available') !== false;
            
            return $msg['role'] !== 'system' || !$isStaleContext;
        });
        
        $messages = array_merge($sessionMessages, $messages);

        // Inject DB context 
        try {
            $allRequests = RequestModel::with(['user', 'requestFacilities', 'facilities'])
                ->whereIn('status', ['Pending', 'Approved'])
                ->latest()->limit(30)->get();

            // Keep request data for deterministic backend checks and logging only.
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch requests: ' . $e->getMessage());
        }

        try {
            $allFacilities       = Facility::orderBy('id', 'asc')->limit(50)->get(['id', 'name', 'building', 'capacity']);
            $facilities = $allFacilities->map(fn($f) => "ID {$f->id}: {$f->name} (Building: {$f->building}, Capacity: {$f->capacity})")->toArray();

            if (!empty($facilities)) {
                array_unshift($messages, ['role' => 'system', 'content' => "Available Facilities:\n- " . implode("\n- ", $facilities)]);
            }

            $equipmentRows = $this->getEquipmentContextRows(50);
            $equipment = array_map(fn($row) => $row['line'], $equipmentRows);
            $equipmentCount = count($equipmentRows);

            if (!empty($equipment)) {
                array_unshift($messages, ['role' => 'system', 'content' => "Available Equipment:\n- " . implode("\n- ", $equipment)]);
            }
            if ($latestUserMessage) {
                if ($faqMode) {
                    $faqModeResult = $this->handleFaqModeConversation($messages, $latestUserMessage);
                    $content = (string) ($faqModeResult['content'] ?? '');
                    $incomingMessages = $request->input('messages', []);
                    $this->storeAssistantReply($incomingMessages, $content);
                    $this->chatbotLogService->logAssistantReply(
                        $latestUserMessage,
                        $content,
                        $this->buildLogContext(
                            $latestUserMessage,
                            $participantCount,
                            $bookingContext,
                            $allRequests,
                            $allFacilities,
                            $equipmentCount,
                            0,
                            $rulesInjected,
                            $approvedBookingContextInjected,
                            $deterministicAvailabilityInjected,
                            $facilityFilterApplied,
                            array_merge(['faq_mode' => true], $faqModeResult['context'] ?? [])
                        ),
                        $sessionId,
                        'faq_answer',
                        'faq',
                    );

                    $deterministic = $faqModeResult['deterministic'] ?? [
                        'source' => 'faq_conversational_rag',
                        'check' => 'faq',
                        'status' => 'info',
                        'faq_mode' => true,
                    ];

                    return response()->stream(function () use ($content, $deterministic) {
                        $this->streamTextTokens($content);
                        echo "data: " . json_encode(['deterministic' => $deterministic]) . "\n\n";
                        ob_flush();
                        flush();
                        echo "data: " . json_encode(['done' => true]) . "\n\n";
                        ob_flush();
                        flush();
                    }, 200, [
                        'Content-Type'      => 'text/event-stream',
                        'Cache-Control'     => 'no-cache',
                        'X-Accel-Buffering' => 'no',
                        'Connection'        => 'keep-alive',
                    ]);
                }

                $resolved = $this->resolveFacilityAndDateFromConversation($messages, $allFacilities);
                $shouldRunAvailability = $this->shouldRunDeterministicAvailabilityCheck($latestUserMessage, $resolved, $allFacilities);

                if (!$faqMode && $shouldRunAvailability) {
                    $availabilityResult = $this->buildAvailabilityCheckResult(
                        $resolved['facility'],
                        $resolved['date'],
                        $allRequests,
                        $resolved['time_start'] ?? null,
                        $resolved['time_end'] ?? null
                    );
                    $content = $availabilityResult['content'];
                    $incomingMessages = $request->input('messages', []);
                    $this->storeAssistantReply($incomingMessages, $content);
                    $this->chatbotLogService->logAssistantReply(
                        $latestUserMessage,
                        $content,
                        $this->buildLogContext(
                            $latestUserMessage,
                            $participantCount,
                            $bookingContext,
                            $allRequests,
                            $allFacilities,
                            $equipmentCount,
                            0,
                            $rulesInjected,
                            $approvedBookingContextInjected,
                            $deterministicAvailabilityInjected,
                            $facilityFilterApplied,
                            ['response_source' => 'deterministic_check', 'faq_mode' => false]
                        ),
                        $sessionId,
                        'deterministic_check',
                        'availability_check',
                    );

                    return response()->stream(function () use ($content, $availabilityResult) {
                        echo "data: " . json_encode(['token' => $content]) . "\n\n";
                        ob_flush();
                        flush();
                        echo "data: " . json_encode(['deterministic' => $availabilityResult['deterministic']]) . "\n\n";
                        ob_flush();
                        flush();
                        echo "data: " . json_encode(['done' => true]) . "\n\n";
                        ob_flush();
                        flush();
                    }, 200, [
                        'Content-Type'      => 'text/event-stream',
                        'Cache-Control'     => 'no-cache',
                        'X-Accel-Buffering' => 'no',
                        'Connection'        => 'keep-alive',
                    ]);
                }

                if (!$faqMode) {
                    $faqResult = $this->tryFaqSemanticMatch($latestUserMessage, false);
                    if ($faqResult) {
                        $content = (string) $faqResult['content'];
                        $incomingMessages = $request->input('messages', []);
                        $this->storeAssistantReply($incomingMessages, $content);
                        $this->chatbotLogService->logAssistantReply(
                            $latestUserMessage,
                            $content,
                            $this->buildLogContext(
                                $latestUserMessage,
                                $participantCount,
                                $bookingContext,
                                $allRequests,
                                $allFacilities,
                                $equipmentCount,
                                0,
                                $rulesInjected,
                                $approvedBookingContextInjected,
                                $deterministicAvailabilityInjected,
                                $facilityFilterApplied,
                                array_merge(['faq_mode' => false], $faqResult['context'])
                            ),
                            $sessionId,
                            'faq_answer',
                            'faq',
                        );

                        return response()->stream(function () use ($content, $faqResult) {
                            $this->streamTextTokens($content);
                            echo "data: " . json_encode(['deterministic' => $faqResult['deterministic']]) . "\n\n";
                            ob_flush();
                            flush();
                            echo "data: " . json_encode(['done' => true]) . "\n\n";
                            ob_flush();
                            flush();
                        }, 200, [
                            'Content-Type'      => 'text/event-stream',
                            'Cache-Control'     => 'no-cache',
                            'X-Accel-Buffering' => 'no',
                            'Connection'        => 'keep-alive',
                        ]);
                    }
                }

            }

            array_unshift($messages, ['role' => 'system', 'content' => "PARTICIPANT COUNT GUIDANCE:\nIf the user shares participant count, use it only for helpful guidance (for example, suggest rooms whose capacities are close to the count).\nDo NOT reject or block a booking based on participant count in chat.\nDo NOT claim final capacity approval in chat.\nFinal participant-capacity validation is performed by the backend during request submission."]);
            array_unshift($messages, ['role' => 'system', 'content' => "AI ROLE BOUNDARY (STRICT):\nYou are an assistant and rationale layer only.\n- Never compute or decide final operational truth for availability, conflicts, participant-capacity limits, or equipment slot limits.\n- Never refuse or approve requests based on your own calculations.\n- Deterministic backend checks and submission validation are the source of truth.\n- When backend deterministic output is available, explain it clearly and suggest next valid actions."]);
            // Updated flow: ask for event type and map to priority level, no separate priority reason
            // Updated order: Description moved after Event Type, and Additional Message retained at end.
                // Updated file attachment handling: files are optional. If provided, include them; otherwise proceed without prompting.
                array_unshift($messages, ['role' => 'system', 'content' => "IMPORTANT REQUEST CREATION CAPABILITY:\nYou can create facility requests for the user. When they ask to create a request, collect the following information in this order:\n1. Title (brief request name)\n2. Participant Count (OPTIONAL, numeric; include if user provided it)\n3. Facility ID (from the available facilities list above)\n4. Equipment (optional list of equipment IDs and quantities needed, from the available equipment list above)\n5. Date (YYYY-MM-DD format)\n6. Start Time (HH:MM format in 24-hour)\n7. End Time (HH:MM format in 24-hour)\n8. Event Type (IMPORTANT - determine from context):\n   - 0 = Academic (default, regular academic events)\n   - 1 = Organizational (official school activities, department events)\n   - 2 = University (university-wide events)\n   - 3 = Government (government officials, external government events, high-authority visits)\n   *Map the selected Event Type to a priority level as follows: Academic=0, Organizational=1, University=1, Government=2.*\n9. Description (OPTIONAL)\n10. Additional Message (OPTIONAL)\n\nPARTICIPANT COUNT POLICY:\n- Participant count is guidance only during chat.\n- Never refuse a request purely because of participant count.\n- Backend validation is the final source of truth for participant-capacity checks at submission.\n\nEQUIPMENT POLICY:\n- During chat, never refuse equipment quantities based on availability math.\n- Do not say \"cannot fulfill\" due to stock/remaining quantity while collecting details.\n- If the user requests equipment, capture the requested equipment ID and quantity and continue.\n- Backend submission validation is the only source of truth for slot-aware equipment limits.\n- If submission fails, relay the backend validation message (including available quantity) and ask for an updated quantity.\n\nCRITICAL FACILITY ID RULE:\n- `facility_id` in the JSON must be a NUMERIC facility ID only\n- Never use a facility name, label, abbreviation, or room code string in `facility_id`\n- If the selected facility is MPH 6D (CEIT Small room), use its numeric ID from the Available Facilities list, not \"MPH 6D\"\n\nPRIORITY OVERRIDE SYSTEM: If the user's event is Organizational (type 1) or University (type 2) or Government (type 3), and there are existing requests at the same time with lower priority, the system will AUTOMATICALLY put those lower-priority requests on hold.\n\nFILE ATTACHMENT (OPTIONAL): Users may optionally upload supporting documents (JPG, PNG, PDF, DOC, XLSX, PPTX - max 10MB each). Files are not required to proceed with the request. If files are available, include them in the submission. If no files are provided, proceed without them.\n\nAfter collecting all required information and any optional files, construct the JSON payload exactly as shown below and present it to the user for confirmation. Ensure the JSON includes the correct `priority_level` based on the Event Type mapping above:\n{\"title\": \"...\", \"description\": \"...\", \"priority_level\": 0, \"participant_count\": 120, \"facility_bookings\": [{\"facility_id\": 6, \"date\": \"YYYY-MM-DD\", \"time_start\": \"HH:MM\", \"time_end\": \"HH:MM\", \"expected_capacity\": 120, \"equipment\": [{\"equipment_id\": ID, \"quantity_needed\": number}]}]}\n\nWait for the user to confirm 'yes' or 'proceed' before submitting the JSON. Once confirmed, output ONLY the JSON payload (no additional text) to trigger automatic submission to the database."]);
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch facilities/equipment: ' . $e->getMessage());
        }

        $rules = [];
        try {
            $rules = RuleModel::policy()->orderBy('priority')->orderBy('id')->limit(50)->get(['id', 'rule'])
                ->map(fn($r) => trim($r->rule))->filter()->toArray();
            $rules = $this->applyBookingPolicyToRules($rules);

            $rulesSummary = "You MUST follow the following rules exactly. If a user request would violate any rule, you MUST refuse and reply with a short explanation stating which rule would be violated. Do NOT provide prohibited content.";
            $rulesSummary .= !empty($rules) ? "\nRules:\n- " . implode("\n- ", $rules) : "\n(There are currently no configured rules.)";
            array_unshift($messages, ['role' => 'system', 'content' => $rulesSummary]);
            $rulesInjected = true;
        } catch (\Exception $e) {
            \Log::warning('Stream: Failed to fetch rules: ' . $e->getMessage());
        }

        if (!empty($bookingContext)) {
            array_unshift($messages, ['role' => 'system', 'content' => "BOOKING FLOW CONTEXT (HIGHEST PRIORITY):\n" . $bookingContext . "\n\nIMPORTANT: The user is currently in the middle of a structured booking process. Do NOT restart the process."]);
        }

        // Capture incoming user messages to save to session ltr
        $incomingMessages = $request->input('messages', []);

        $logContext = $this->buildLogContext(
            $latestUserMessage,
            $participantCount,
            $bookingContext,
            $allRequests,
            $allFacilities,
            $equipmentCount,
            count($rules),
            $rulesInjected,
            $approvedBookingContextInjected,
            $deterministicAvailabilityInjected,
            $facilityFilterApplied,
            ['faq_mode' => $faqMode]
        );

        return response()->stream(function () use ($messages, $incomingMessages, $rules, $latestUserMessage, $sessionId, $logContext) {
            set_time_limit(300);

            $client = new Client(['timeout' => 580]);
            $fullContent = '';
            $generatedPayload = null;

            try {
                $response = $client->post($this->ollamaUrl . '/api/chat', [
                    'json' => [
                        'model'    => $this->chatModel(),
                        'messages' => $messages,
                        'stream'   => true,
                    ],
                    'stream' => true, 
                ]);

                $body = $response->getBody();

                $isCapturingJson = false;
                $jsonBuffer = '';

                while (!$body->eof()) {
                    $line = '';

                    while (!$body->eof()) {
                        $char = $body->read(1);
                        if ($char === "\n") break;
                        $line .= $char;
                    }

                    $line = trim($line);
                    if (empty($line)) continue;

                    $chunk = @json_decode($line, true);
                    if (!is_array($chunk)) continue;

                    $token = $chunk['message']['content'] ?? '';
                    $done  = $chunk['done'] ?? false;

                    if ($token !== '') {
                        $fullContent .= $token;

                        // Detect start of JSON
                        if (!$isCapturingJson && preg_match('/^\s*\{/', $token)) {
                            $isCapturingJson = true;
                            $jsonBuffer = $token;
                            // Don't send JSON tokens to UI
                            continue;
                        }

                        // Continue capturing JSON
                        if ($isCapturingJson) {
                            $jsonBuffer .= $token;
                            
                            // Try to parse complete JSON
                            try {
                                $parsed = json_decode($jsonBuffer, true);
                                if ($parsed !== null && is_array($parsed) && isset($parsed['facility_bookings'])) {
                                    // Valid JSON found - send as booking_payload
                                    $generatedPayload = $parsed;
                                    echo "data: " . json_encode(['booking_payload' => $jsonBuffer]) . "\n\n";
                                    ob_flush();
                                    flush();
                                    
                                    $isCapturingJson = false;
                                    $jsonBuffer = '';
                                }
                            } catch (\Exception $e) {
                                // Not valid JSON yet, keep accumulating
                            }
                            
                            // Don't send JSON tokens to UI
                            continue;
                        }

                        // Regular token (not JSON)
                        echo "data: " . json_encode(['token' => $token]) . "\n\n";
                        ob_flush();
                        flush();
                    }

                    if ($done) break;
                }

                if ($isCapturingJson && $jsonBuffer !== '') {
                    $parsed = json_decode($jsonBuffer, true);
                    if (is_array($parsed) && isset($parsed['facility_bookings'])) {
                        $generatedPayload = $parsed;
                        echo "data: " . json_encode(['booking_payload' => $jsonBuffer]) . "\n\n";
                        ob_flush();
                        flush();
                    }
                    $isCapturingJson = false;
                    $jsonBuffer = '';
                }

                // Rule validation on full content
                if (!empty($rules)) {
                    try {
                        $validatorMessages = [
                            ['role' => 'system', 'content' => "You are a careful rules validator. Analyze if the assistant response CLEARLY AND DIRECTLY VIOLATES any hard constraints in the rules.\n\n- VIOLATIONS: Explicit prohibitions like 'do not mention X', 'never do Y'\n- NOT VIOLATIONS: Style preferences like 'be brief', 'be friendly'\n\nPolicy override for this system:\n- Missing request description/additional information is NOT a violation. Description is optional.\n\nReturn ONLY valid JSON with key \"violations\" (array of rule indices, 0-based). No extra text."],
                            ['role' => 'user',   'content' => "Rules:\n- " . implode("\n- ", $rules) . "\n\nAssistant Response:\n" . $fullContent],
                        ];

                        $validatorResp = $client->post($this->ollamaUrl . '/api/chat', [
                            'json' => ['model' => $this->chatModel(), 'messages' => $validatorMessages, 'stream' => false],
                        ]);

                        $validatorData = json_decode($validatorResp->getBody(), true);
                        $jsonText      = $validatorData['message']['content'] ?? '';
                        $parsed        = @json_decode($jsonText, true);

                        if (!empty($parsed['violations'])) {
                            $violationDetails = [];
                            foreach ($parsed['violations'] as $idx) {
                                if (isset($rules[$idx])) {
                                    $violationDetails[] = 'Rule #' . ($idx + 1) . ': ' . $rules[$idx];
                                }
                            }
                            $violationMessage = "I cannot comply with that request because it would violate the following rules:\n\n" . implode("\n\n", $violationDetails);

                            // Override the streamed content with the violation message
                            echo "data: " . json_encode(['violation' => $violationMessage]) . "\n\n";
                            ob_flush();
                            flush();

                            $fullContent = $violationMessage;
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Stream: Rule validation failed: ' . $e->getMessage());
                    }
                }

                if (!is_array($generatedPayload)) {
                    $generatedPayload = $this->extractStructuredPayload($fullContent);
                    if (is_array($generatedPayload)) {
                        echo "data: " . json_encode(['booking_payload' => json_encode($generatedPayload)]) . "\n\n";
                        ob_flush();
                        flush();
                    }
                }

                // Save session
                $userAndAssistant = array_filter($incomingMessages, fn($m) => in_array($m['role'], ['user', 'assistant']));
                $userAndAssistant[] = ['role' => 'assistant', 'content' => $fullContent];
                $this->saveSession(array_values($userAndAssistant));

                if (is_array($generatedPayload) && isset($generatedPayload['facility_bookings'])) {
                    $this->chatbotLogService->logPayloadGenerated(
                        $latestUserMessage,
                        $fullContent,
                        $generatedPayload,
                        array_merge($logContext, ['generated_payload' => true, 'request_creation' => true]),
                        $sessionId
                    );
                } else {
                    $this->chatbotLogService->logAssistantReply(
                        $latestUserMessage,
                        $fullContent,
                        array_merge($logContext, ['response_source' => 'ai_rationale']),
                        $sessionId,
                        'ai_rationale',
                        'ai_rationale'
                    );
                }

                echo "data: " . json_encode(['done' => true]) . "\n\n";
                ob_flush();
                flush();

            } catch (\Exception $e) {
                \Log::error('Stream error: ' . $e->getMessage());
                $this->chatbotLogService->logError(
                    $latestUserMessage,
                    $e->getMessage(),
                    $logContext,
                    $sessionId
                );
                echo "data: " . json_encode(['error' => 'Stream failed']) . "\n\n";
                ob_flush();
                flush();
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache',
            'X-Accel-Buffering' => 'no', 
            'Connection'        => 'keep-alive',
        ]);
    }

    public function testCsrf(): JsonResponse
    {
        try {
            $client   = new Client(['timeout' => 10]);
            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data     = json_decode($response->getBody(), true);

            return response()->json([
                'message'   => 'Connected to Ollama',
                'configured_model' => $this->model,
                'resolved_model' => $this->chatModel(),
                'models'    => $data['models'] ?? [],
                'timestamp' => now(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Ollama connection test failed: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Cannot connect to Ollama at ' . $this->ollamaUrl,
                'message' => config('app.debug') ? $e->getMessage() : 'Connection failed',
            ], 500);
        }
    }

    public function models(): JsonResponse
    {
        try {
            $client   = new Client(['timeout' => 10]);
            $response = $client->get($this->ollamaUrl . '/api/tags');
            $data     = json_decode($response->getBody(), true);

            return response()->json([
                'configured_model' => $this->model,
                'resolved_model' => $this->chatModel(),
                'models' => $data['models'] ?? [],
            ]);
        } catch (\Exception $e) {
            \Log::error('Models fetch error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch models',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function latestRequests(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(20, (int) $request->input('limit', 5)));

            $rows = RequestModel::orderBy('created_at', 'desc')
                ->limit($limit)
                ->get(['id', 'user_id', 'status', 'created_at'])
                ->map(fn($r) => [
                    'id'         => $r->id,
                    'user_id'    => $r->user_id,
                    'status'     => $r->status,
                    'created_at' => $r->created_at->toDateTimeString(),
                ]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Latest requests error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch latest requests',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function rulesList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));

            $rows = RuleModel::policy()->orderBy('priority')->orderBy('id')
                ->limit($limit)
                ->get(['id', 'rule'])
                ->map(fn($r) => ['id' => $r->id, 'rule' => trim($r->rule)]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Rules list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch rules',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function facilitiesList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));

            $rows = Facility::orderBy('id', 'asc')
                ->limit($limit)
                ->get(['id', 'name', 'building', 'capacity'])
                ->map(fn($f) => [
                    'id'       => $f->id,
                    'name'     => $f->name,
                    'building' => $f->building,
                    'capacity' => $f->capacity,
                ]);

            return response()->json(['data' => $rows]);
        } catch (\Exception $e) {
            \Log::error('Facilities list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch facilities',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function equipmentList(Request $request): JsonResponse
    {
        try {
            $limit = max(1, min(200, (int) $request->input('limit', 50)));
            $facilityId = $request->filled('facility_id') ? (int) $request->input('facility_id') : null;
            $sourceMode = strtolower((string) $request->input('source', 'own'));
            $dateValue = $request->input('date');
            $timeStartValue = $request->input('time_start');
            $timeEndValue = $request->input('time_end');

            if (!in_array($sourceMode, ['own', 'borrow'], true)) {
                throw ValidationException::withMessages([
                    'source' => ['Source must be either "own" or "borrow".'],
                ]);
            }

            if ($facilityId !== null) {
                $request->validate([
                    'facility_id' => 'integer|exists:facilities,id',
                ]);
            }

            $hasAnyTimeField = $request->filled('date') || $request->filled('time_start') || $request->filled('time_end');
            $isSlotAwareRequest = false;
            $normalizedDate = null;
            $normalizedTimeStart = null;
            $normalizedTimeEnd = null;

            if ($hasAnyTimeField) {
                $normalizedDate = $this->normalizeDateValue($dateValue);
                $normalizedTimeStart = $this->normalizeTimeValue($timeStartValue);
                $normalizedTimeEnd = $this->normalizeTimeValue($timeEndValue);

                $request->merge([
                    'facility_id' => $facilityId,
                    'date' => $normalizedDate,
                    'time_start' => $normalizedTimeStart,
                    'time_end' => $normalizedTimeEnd,
                ]);

                $request->validate([
                    'facility_id' => 'required|integer|exists:facilities,id',
                    'date' => 'required|date_format:Y-m-d',
                    'time_start' => 'required|regex:/^\d{2}:\d{2}$/',
                    'time_end' => 'required|regex:/^\d{2}:\d{2}$/',
                ]);

                $startMinutes = $this->toMinuteOfDay((string) $normalizedTimeStart);
                $endMinutes = $this->toMinuteOfDay((string) $normalizedTimeEnd);
                if ($startMinutes === null || $endMinutes === null || $startMinutes >= $endMinutes) {
                    throw ValidationException::withMessages([
                        'time_end' => ['End time must be later than start time.'],
                    ]);
                }

                $isSlotAwareRequest = true;
            }

            if ($isSlotAwareRequest && $facilityId) {
                if ($sourceMode === 'borrow') {
                    $rows = Equipment::query()
                        ->whereHas('facilities', fn($q) => $q->where('facilities.id', '!=', $facilityId))
                        ->with([
                            'facilities' => fn($q) => $q
                                ->where('facilities.id', '!=', $facilityId)
                                ->select('facilities.id', 'facilities.name'),
                        ])
                        ->orderBy('equipments.id', 'asc')
                        ->get(['equipments.id', 'equipments.name'])
                        ->flatMap(function (Equipment $equipment) use ($normalizedDate, $normalizedTimeStart, $normalizedTimeEnd) {
                            return $equipment->facilities->map(function ($facility) use ($equipment, $normalizedDate, $normalizedTimeStart, $normalizedTimeEnd) {
                                $slotAvailability = $equipment->slotAvailabilityInFacility(
                                    (int) $facility->id,
                                    (string) $normalizedDate,
                                    (string) $normalizedTimeStart,
                                    (string) $normalizedTimeEnd
                                );

                                return [
                                    'id' => $equipment->id,
                                    'name' => $equipment->name,
                                    'facility_id' => (int) $facility->id,
                                    'facility' => $facility->name,
                                    'total_quantity' => (int) ($slotAvailability['total_quantity'] ?? 0),
                                    'reserved_quantity' => (int) ($slotAvailability['reserved_quantity'] ?? 0),
                                    'remaining_quantity' => (int) ($slotAvailability['remaining_quantity'] ?? 0),
                                    // Legacy compatibility
                                    'quantity' => (int) ($slotAvailability['remaining_quantity'] ?? 0),
                                ];
                            })->values();
                        })
                        ->filter(fn($row) => (int) ($row['remaining_quantity'] ?? 0) > 0)
                        ->take($limit)
                        ->values();
                } else {
                    $rows = Equipment::query()
                        ->whereHas('facilities', fn($q) => $q->where('facilities.id', $facilityId))
                        ->with([
                            'facilities' => fn($q) => $q
                                ->where('facilities.id', $facilityId)
                                ->select('facilities.id', 'facilities.name'),
                        ])
                        ->orderBy('equipments.id', 'asc')
                        ->limit($limit)
                        ->get(['equipments.id', 'equipments.name'])
                        ->map(function (Equipment $equipment) use ($facilityId, $normalizedDate, $normalizedTimeStart, $normalizedTimeEnd) {
                            $facility = $equipment->facilities->first();
                            $slotAvailability = $equipment->slotAvailabilityInFacility(
                                $facilityId,
                                (string) $normalizedDate,
                                (string) $normalizedTimeStart,
                                (string) $normalizedTimeEnd
                            );

                            return [
                                'id' => $equipment->id,
                                'name' => $equipment->name,
                                'facility_id' => $facilityId,
                                'facility' => $facility?->name,
                                'total_quantity' => (int) ($slotAvailability['total_quantity'] ?? 0),
                                'reserved_quantity' => (int) ($slotAvailability['reserved_quantity'] ?? 0),
                                'remaining_quantity' => (int) ($slotAvailability['remaining_quantity'] ?? 0),
                                // Legacy compatibility
                                'quantity' => (int) ($slotAvailability['remaining_quantity'] ?? 0),
                            ];
                        })
                        ->values();
                }
            } else {
                $rows = collect($this->getEquipmentContextRows($limit))
                    ->filter(function ($row) use ($facilityId, $sourceMode) {
                        if ($facilityId === null) {
                            return true;
                        }

                        $rowFacilityId = (int) ($row['facility_id'] ?? 0);
                        if ($sourceMode === 'borrow') {
                            return $rowFacilityId > 0 && $rowFacilityId !== $facilityId;
                        }

                        return $rowFacilityId === $facilityId;
                    })
                    ->map(fn($row) => [
                        'id' => (int) $row['id'],
                        'name' => $row['name'],
                        'facility_id' => $row['facility_id'],
                        'facility' => $row['facility'],
                        'total_quantity' => (int) $row['quantity'],
                        'reserved_quantity' => 0,
                        'remaining_quantity' => (int) $row['quantity'],
                        // Legacy compatibility
                        'quantity' => (int) $row['quantity'],
                    ])
                    ->values();
            }

            return response()->json(['data' => $rows]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Equipment list error: ' . $e->getMessage());
            return response()->json([
                'error'   => 'Failed to fetch equipment',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function uploadFile(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'files' => 'required|array|min:1',
                'files.*' => 'required|file|max:10485760|mimes:jpeg,jpg,png,pdf,doc,docx,xls,xlsx,ppt,pptx',
            ]);

            $uploadedFiles = [];
            $userId = Auth::id();
            $sessionId = session()->getId();
            $tempDir = "chat-uploads/{$userId}/{$sessionId}";

            try {
                if (!Storage::disk('public')->exists($tempDir)) {
                    Storage::disk('public')->makeDirectory($tempDir, 0755, true);
                }
            } catch (\Exception $dirErr) {
                \Log::error("Failed to create temp directory: " . $dirErr->getMessage());
                return response()->json([
                    'success' => false,
                    'error' => 'Failed to create upload directory',
                ], 500);
            }

            foreach ($request->file('files') as $file) {
                try {
                    $fileId = Str::uuid();
                    $extension = $file->getClientOriginalExtension();
                    $filename = $fileId . '.' . $extension;
                    
                    $path = Storage::disk('public')->putFileAs($tempDir, $file, $filename);
                    
                    if (!$path) {
                        \Log::warning("File storage returned false for: {$filename}");
                        continue;
                    }

                    $uploadedFiles[] = [
                        'id' => (string) $fileId,
                        'name' => $file->getClientOriginalName(),
                        'size' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                        'url' => Storage::disk('public')->url($path),
                    ];
                } catch (\Exception $fileErr) {
                    \Log::error("Failed to upload file: " . $fileErr->getMessage());
                    continue;
                }
            }

            if (empty($uploadedFiles)) {
                return response()->json([
                    'success' => false,
                    'error' => 'No files were successfully uploaded',
                ], 422);
            }

            return response()->json([
                'success' => true,
                'files' => $uploadedFiles,
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            $errorMessages = [];
            
            if ($e->has('files.*')) {
                foreach ($request->file('files') as $index => $file) {
                    $errors = $e->errors();
                    if (isset($errors["files.{$index}"])) {
                        foreach ($errors["files.{$index}"] as $error) {
                            $errorMessages[] = "{$file->getClientOriginalName()}: {$error}";
                        }
                    }
                }
            }

            return response()->json([
                'success' => false,
                'error' => 'File validation failed',
                'messages' => !empty($errorMessages) ? $errorMessages : $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            \Log::error('File upload error: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'error' => 'File upload failed',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }

    public function createRequestApi(Request $request): JsonResponse
    {
        $sessionId = $request->session()->getId();
        $latestUserMessage = $this->getLatestUserMessageContent($this->loadSession());

        try {
            $normalizedInput = $this->normalizeCreateRequestPayload($request->all());
            $request->replace($normalizedInput);

            $validated = $request->validate([
                'title'                                           => 'required|string|max:255',
                'description'                                     => 'nullable|string',
                'priority_level'                                  => 'nullable|integer|in:0,1,2,3',
                'priority_reason'                                 => 'nullable|string|max:512',
                'participant_count'                               => 'nullable|integer|min:1',
                'facility_bookings'                               => 'required|array|min:1',
                'facility_bookings.*.facility_id'                 => 'required|exists:facilities,id',
                'facility_bookings.*.date'                        => 'required|date',
                'facility_bookings.*.time_start'                  => 'required|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
                'facility_bookings.*.time_end'                    => 'required|regex:/^\d{1,2}:\d{2}(:\d{2})?$/',
                'facility_bookings.*.expected_capacity'           => 'nullable|integer|min:1',
                'facility_bookings.*.equipment'                   => 'sometimes|nullable|array',
                'facility_bookings.*.equipment.*.equipment_id'    => 'required|exists:equipments,id',
                'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
                'facility_bookings.*.equipment.*.source_facility_id' => 'sometimes|nullable|exists:facilities,id',
                'facility_bookings.*.equipment.*.is_borrowed'     => 'sometimes|boolean',
                'files'                                           => 'nullable|array',
                'files.*'                                         => 'nullable|string',
            ]);

            $bookingsForValidation = $validated['facility_bookings'];
            $equipmentSelectionErrors = $this->validateFacilityEquipmentSelections($bookingsForValidation);
            $validated['facility_bookings'] = $bookingsForValidation;
            if (!empty($equipmentSelectionErrors)) {
                throw ValidationException::withMessages($equipmentSelectionErrors);
            }

            $capacityErrors = $this->validateFacilityParticipantCapacity(
                $validated['facility_bookings'],
                isset($validated['participant_count']) ? (int) $validated['participant_count'] : null
            );
            if (!empty($capacityErrors)) {
                throw ValidationException::withMessages($capacityErrors);
            }

            $priorityLevel  = (int) ($validated['priority_level'] ?? 0);
            $priorityReason = $validated['priority_reason'] ?? null;
            $userId = Auth::id();
            $tempDir = "chat-uploads/{$userId}/{$sessionId}";
            $fileCount = 0;
            $heldCount = 0;
            $facilityRequest = DB::transaction(function () use (
                $validated,
                $priorityLevel,
                $priorityReason,
                $tempDir,
                &$fileCount,
                &$heldCount
            ) {
                $bookingsForValidation = $validated['facility_bookings'];
                $preLockEquipmentErrors = $this->validateFacilityEquipmentSelections($bookingsForValidation);
                if (!empty($preLockEquipmentErrors)) {
                    throw ValidationException::withMessages($preLockEquipmentErrors);
                }

                // Serialize slot-equipment validations (including borrowed source facilities).
                $this->lockFacilityEquipmentRows($bookingsForValidation);

                $lockedEquipmentErrors = $this->validateFacilityEquipmentSelections($bookingsForValidation);
                if (!empty($lockedEquipmentErrors)) {
                    throw ValidationException::withMessages($lockedEquipmentErrors);
                }

                $facilityRequest = RequestModel::create([
                    'user_id'         => Auth::id(),
                    'title'           => $validated['title'],
                    'description'     => $validated['description'] ?? null,
                    'status'          => RequestStatus::PENDING,
                    'priority_level'  => $priorityLevel,
                    'priority_reason' => $priorityReason,
                ]);

                foreach ($bookingsForValidation as $booking) {
                    $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
                    $facilityRequest->requestFacilities()->create([
                        'facility_id'    => $booking['facility_id'],
                        'date_requested' => $dateOnly,
                        'time_start'     => $booking['time_start'],
                        'time_end'       => $booking['time_end'],
                        'expected_capacity' => isset($booking['expected_capacity'])
                            ? (int) $booking['expected_capacity']
                            : (isset($validated['participant_count']) ? (int) $validated['participant_count'] : null),
                    ]);

                    if (!empty($booking['equipment'])) {
                        foreach ($booking['equipment'] as $equipment) {
                            $sourceFacilityId = isset($equipment['source_facility_id']) && is_numeric($equipment['source_facility_id'])
                                ? (int) $equipment['source_facility_id']
                                : null;
                            $isBorrowed = $sourceFacilityId !== null && $sourceFacilityId !== (int) $booking['facility_id'];

                            $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                                'quantity_needed' => $equipment['quantity_needed'],
                                'is_borrowed' => $isBorrowed,
                                'source_facility_id' => $isBorrowed ? $sourceFacilityId : null,
                            ]);
                        }
                    }
                }

                if (!empty($validated['files'])) {
                    foreach ($validated['files'] as $fileId) {
                        try {
                            $tempFiles = Storage::disk('public')->files($tempDir);
                            $tempFilePath = null;

                            foreach ($tempFiles as $file) {
                                if (str_contains($file, $fileId)) {
                                    $tempFilePath = $file;
                                    break;
                                }
                            }

                            if ($tempFilePath) {
                                $originalName = basename($tempFilePath);
                                $permanentPath = "request-files/{$originalName}";

                                $content = Storage::disk('public')->get($tempFilePath);
                                Storage::disk('public')->put($permanentPath, $content);

                                $facilityRequest->files()->create([
                                    'path'          => $permanentPath,
                                    'original_name' => $originalName,
                                    'mime_type'     => Storage::disk('public')->mimeType($tempFilePath),
                                    'size'          => Storage::disk('public')->size($tempFilePath),
                                ]);

                                Storage::disk('public')->delete($tempFilePath);
                                $fileCount++;
                            }
                        } catch (\Exception $e) {
                            \Log::warning("Failed to process file {$fileId}: " . $e->getMessage());
                        }
                    }

                    try {
                        $remainingFiles = Storage::disk('public')->files($tempDir);
                        if (empty($remainingFiles)) {
                            Storage::disk('public')->deleteDirectory($tempDir);
                        }
                    } catch (\Exception $e) {
                        \Log::warning("Failed to clean temp directory: " . $e->getMessage());
                    }
                }

                if ($priorityLevel > 0) {
                    try {
                        $bookingsForConflict = array_map(fn($booking) => [
                            'facility_id' => $booking['facility_id'],
                            'date'        => $booking['date'],
                            'time_start'  => $booking['time_start'],
                            'time_end'    => $booking['time_end'],
                        ], $validated['facility_bookings']);

                        $requestService      = app(\App\Services\RequestService::class);
                        $notificationService = app(\App\Services\NotificationService::class);
                        $conflicting         = $requestService->findConflictingLowerPriorityRequests($bookingsForConflict, $priorityLevel);
                        $holdReason          = $priorityReason ?? 'Higher-priority event submitted for the same time slot.';

                        foreach ($conflicting as $conflictingRequest) {
                            $requestService->putOnHold($conflictingRequest, $facilityRequest, $holdReason);
                            $notificationService->notifyOnHold($conflictingRequest, $facilityRequest, $holdReason);
                            $heldCount++;
                            \Log::info("AI: Request #{$conflictingRequest->id} put on hold by high-priority request #{$facilityRequest->id}");
                        }
                    } catch (\Throwable $e) {
                        \Log::warning('AI createRequestApi: priority override failed: ' . $e->getMessage());
                    }
                }

                return $facilityRequest;
            });

            ProcessRequestRecommendation::dispatch($facilityRequest, $validated['facility_bookings']);

            $this->clearSession();

            $this->chatbotLogService->logSubmissionResult(
                $validated,
                [
                    'passed' => true,
                    'errors' => [],
                ],
                [
                    'user_message' => $latestUserMessage,
                    'validation_passed' => true,
                    'held_count' => $heldCount,
                    'files_attached' => $fileCount,
                    'request_id' => $facilityRequest->id,
                    'selected_facility' => optional($facilityRequest->requestFacilities->first()?->facility)->only(['id', 'name']),
                    'selected_date' => $validated['facility_bookings'][0]['date'] ?? null,
                    'selected_time_start' => $validated['facility_bookings'][0]['time_start'] ?? null,
                    'selected_time_end' => $validated['facility_bookings'][0]['time_end'] ?? null,
                ],
                $sessionId,
                $facilityRequest->id
            );

            return response()->json([
                'success'        => true,
                'message'        => 'Request created successfully' . ($heldCount > 0 ? " ({$heldCount} conflicting request(s) put on hold)" : ''),
                'request_id'     => $facilityRequest->id,
                'priority_level' => $priorityLevel,
                'held_count'     => $heldCount,
                'files_attached' => $fileCount,
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::warning('Validation error in createRequestApi: ' . json_encode($e->errors()));
            $failedPayload = is_array($request->all()) ? $request->all() : [];
            $this->chatbotLogService->logValidationFailure(
                $failedPayload,
                [
                    'passed' => false,
                    'errors' => $e->errors(),
                ],
                [
                    'user_message' => $latestUserMessage,
                    'validation_passed' => false,
                ],
                $sessionId
            );
            return response()->json(['error' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Request creation error: ' . $e->getMessage());
            $this->chatbotLogService->logError(
                $latestUserMessage,
                $e->getMessage(),
                [
                    'request_creation' => true,
                ],
                $sessionId,
                'request_creation',
                'request_creation',
                is_array($request->all()) ? $request->all() : null,
            );
            return response()->json([
                'error'   => 'Failed to create request',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred',
            ], 500);
        }
    }
}