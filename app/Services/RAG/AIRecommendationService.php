<?php

namespace App\Services\RAG;

use App\Enums\RequestStatus;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Rule;
use App\Services\AI\OpenRouterClient;

class AIRecommendationService
{
    public function __construct(protected OpenRouterClient $ai) {}

    /**
     * Evaluate each RequestFacility in isolation and return a map of results.
     *
     * Returns:
     *   [
     *     <requestFacility.id> => ['status' => RequestStatus, 'reason' => string],
     *     ...
     *   ]
     *
     * If the LLM fails for a specific facility, the fallback result for that
     * facility is inserted instead — the rest of the loop continues normally.
     */
    public function recommend(FacilityRequest $request): array
    {
        $request->loadMissing([
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment',
        ]);

        $results = [];

        foreach ($request->requestFacilities as $rf) {
            try {
                $results[$rf->id] = $this->evaluateFacility($request, $rf);
            } catch (\Throwable $e) {
                \Log::warning("AIRecommendationService: failed for RequestFacility#{$rf->id}, using fallback. Error: ".$e->getMessage());
                $results[$rf->id] = $this->fallbackForFacility($rf);
            }
        }

        return $results;
    }

    /**
     * Run the full RAG + LLM pipeline for one specific RequestFacility.
     */
    private function evaluateFacility(FacilityRequest $request, RequestFacility $rf): array
    {
        $facilityContext = $this->buildRequestContext($request, $rf);
        $ruleLimit = (int) config('ai.recommendation.rule_limit', 10);

        $relevantRules = Rule::policy()
            ->orderBy('priority')
            ->orderBy('id')
            ->limit(max($ruleLimit, 1))
            ->get();

        if ($relevantRules->isEmpty()) {
            return $this->fallbackForFacility($rf);
        }

        \Log::debug("Relevant rules for RequestFacility#{$rf->id}", [
            'rules' => $relevantRules->pluck('rule')->all(),
        ]);

        $ruleLines = collect($relevantRules)
            ->values()
            ->map(fn ($r, $i) => ($i + 1).'. '.trim((string) $r->rule))
            ->join("\n");

        $ruleCount = collect($relevantRules)->count();
        $validStatuses = implode(', ', array_column(
            array_filter(
                RequestStatus::cases(),
                fn ($case) => $case->name !== RequestStatus::PENDING->name
            ),
            'value'
        ));

        $now = now()->toDateTimeString();
        $signals = $this->buildSignals($request, $rf);

        $prompt = <<<PROMPT
TODAY'S DATE AND TIME: {$now}

===RULES ({$ruleCount} total — you MUST apply every single one)===
{$ruleLines}

===PRE-EVALUATED SIGNALS===
These are computed facts about THIS specific facility booking. Trust them exactly as written; do not reinterpret them.
{$signals}

===REQUEST DETAILS===
{$facilityContext}

===YOUR TASK===
Go through EACH of the {$ruleCount} rules above one by one.
For every rule, decide: does this request comply, violate, or is the rule not applicable?
If ANY rule is violated, the status must reflect that (Denied or Conditionally Approved as appropriate).
If ALL rules are satisfied, default to Approved.

VALID STATUSES (choose exactly one): {$validStatuses}

Respond using ONLY this JSON structure — no other text:
{"status": "<valid status>", "reason": "<one sentence summarising the decisive rule or overall result>"}
PROMPT;

        $raw = $this->ai->chat([
            [
                'role' => 'system',
                'content' => 'You are a JSON-only response bot. You must output a single valid JSON object and absolutely nothing else. No explanation, no markdown, no preamble.',
            ],
            [
                'role' => 'user',
                'content' => $prompt,
            ],
        ], ['timeout' => config('ai.recommendation.timeout', 120)]);

        return $this->parseResponse($raw);
    }

    /**
     * Build pre-computed, unambiguous signals scoped to ONE RequestFacility.
     *
     * Only facts relevant to $rf are included so the LLM cannot confuse
     * signals from a different booking in the same parent request.
     */
    private function buildSignals(FacilityRequest $request, RequestFacility $rf): string
    {
        $lines = [];

        // --- Temporal verdict ---
        $daysUntil = now()->startOfDay()->diffInDays(
            \Carbon\Carbon::parse($rf->date_requested)->startOfDay(),
            false
        );

        if ($daysUntil < 0) {
            $lines[] = '- TEMPORAL: This facility date is in the PAST. This booking cannot be approved.';
        } elseif ($daysUntil < 3) {
            $lines[] = "- TEMPORAL: This facility date is only {$daysUntil} day(s) from today. The 3-day advance rule is VIOLATED. This booking must be DENIED.";
        } else {
            $lines[] = "- TEMPORAL: This facility date is {$daysUntil} days from today. The 3-day advance rule is NOT violated.";
        }

        // --- Conflict signals scoped to this RequestFacility ---
        $approvedConflictRfIds = $request->approved_conflict_rf_ids ?? [];
        $pendingConflictRfIds = $request->pending_conflict_rf_ids ?? [];

        // Approved conflicts: check if THIS rf.id appears in the conflict set,
        // OR if this rf conflicts with any of the IDs in the list (depending on
        // how conflict IDs are stored in your application). Adjust the logic
        // below to match your actual conflict data shape.
        $hasApprovedConflict = in_array($rf->id, $approvedConflictRfIds, true);
        $hasPendingConflict = in_array($rf->id, $pendingConflictRfIds, true);

        $lines[] = $hasApprovedConflict
            ? '- CONFLICT: This booking has a schedule conflict with an already APPROVED booking. This booking must be DENIED.'
            : '- CONFLICT: No conflicts with approved bookings for this facility slot.';

        $lines[] = $hasPendingConflict
            ? '- CONFLICT: This booking has a schedule conflict with a PENDING booking (not yet approved). This alone does not require denial.'
            : '- CONFLICT: No conflicts with pending bookings for this facility slot.';

        // --- External equipment scoped to this RequestFacility ---
        $hasExternalEquipment = ($rf->externalEquipments ?? collect())->isNotEmpty();

        $lines[] = $hasExternalEquipment
            ? '- EQUIPMENT: This booking includes external (non-owned) equipment. Conditional approval is likely required.'
            : '- EQUIPMENT: No external equipment attached to this specific booking.';

        // --- Pre-approval (parent-level, still relevant context) ---
        if (! empty($request->approved_by)) {
            $approvers = implode(', ', $request->approved_by);
            $lines[] = "- PRE-APPROVAL: The parent request has been pre-approved by: {$approvers}.";
        }

        return implode("\n", $lines);
    }

    /**
     * Build a focused context string describing ONE facility booking only.
     *
     * The LLM sees the parent request metadata for narrative context, but the
     * facility section contains exactly one entry so there is no ambiguity
     * about which booking is being evaluated.
     */
    private function buildRequestContext(FacilityRequest $request, RequestFacility $rf): string
    {
        $daysUntil = now()->startOfDay()->diffInDays(
            \Carbon\Carbon::parse($rf->date_requested)->startOfDay(),
            false
        );

        $urgency = $daysUntil < 0
            ? 'PAST DATE'
            : "({$daysUntil} days from today)";

        $facilityLine = "{$rf->facility->name} on {$rf->date_requested} {$urgency} from {$rf->time_start} to {$rf->time_end}";

        // Parent-level equipment applies to all bookings in the request.
        $equipment = $request->equipment->map(
            fn ($eq) => "{$eq->name} x{$eq->pivot->quantity_needed}".($eq->pivot->is_borrowed ? ' (borrowed)' : '')
        )->join(', ');

        $hasExternalEquipment = ($rf->externalEquipments ?? collect())->isNotEmpty();

        // Conflict details scoped to this RequestFacility.
        $approvedConflictRfIds = $request->approved_conflict_rf_ids ?? [];
        $pendingConflictRfIds = $request->pending_conflict_rf_ids ?? [];

        $approvedConflictDetails = '';
        $pendingConflictDetails = '';

        if (in_array($rf->id, $approvedConflictRfIds, true)) {
            $approvedConflictDetails = \App\Models\RequestFacility::whereIn('id', $approvedConflictRfIds)
                ->with(['facility', 'request.user'])
                ->get()
                ->map(
                    fn ($conflictRf) => "  - \"{$conflictRf->request->title}\" by {$conflictRf->request->user->name} at {$conflictRf->facility->name} ({$conflictRf->time_start}–{$conflictRf->time_end})"
                )->join("\n");
        }

        if (in_array($rf->id, $pendingConflictRfIds, true)) {
            $pendingConflictDetails = \App\Models\RequestFacility::whereIn('id', $pendingConflictRfIds)
                ->with(['facility', 'request.user'])
                ->get()
                ->map(
                    fn ($conflictRf) => "  - \"{$conflictRf->request->title}\" by {$conflictRf->request->user->name} at {$conflictRf->facility->name} ({$conflictRf->time_start}–{$conflictRf->time_end})"
                )->join("\n");
        }

        return implode("\n", array_filter([
            "Title: {$request->title}",
            "Description: {$request->description}",
            "Priority Level: {$request->priority_level->name}",
            $request->priority_reason ? "Priority Reason: {$request->priority_reason}" : null,
            "Facility Being Evaluated: {$facilityLine}",
            $equipment ? "Equipment (parent request): {$equipment}" : null,
            $hasExternalEquipment ? 'Has External (non-owned) Equipment for this booking: Yes' : null,
            $approvedConflictDetails ? "Conflicts with APPROVED bookings:\n{$approvedConflictDetails}" : 'Conflicts with approved bookings: None',
            $pendingConflictDetails ? "Conflicts with PENDING bookings:\n{$pendingConflictDetails}" : 'Conflicts with pending bookings: None',
            $request->approved_by ? 'Pre-approved by: '.implode(', ', $request->approved_by) : null,
        ]));
    }

    /**
     * Deterministic fallback scoped to one RequestFacility.
     */
    private function fallbackForFacility(RequestFacility $rf): array
    {
        // We need the parent request's conflict arrays. The RF may or may not
        // have $rf->request loaded; load it if needed.
        $rf->loadMissing('request');
        $request = $rf->request;

        $approvedConflictRfIds = $request->approved_conflict_rf_ids ?? [];
        $pendingConflictRfIds = $request->pending_conflict_rf_ids ?? [];

        $hasApprovedConflict = in_array($rf->id, $approvedConflictRfIds, true);
        $hasPendingConflict = in_array($rf->id, $pendingConflictRfIds, true);
        $hasExternalEquipment = ($rf->externalEquipments ?? collect())->isNotEmpty();

        if ($hasApprovedConflict) {
            return [
                'status' => RequestStatus::DENIED,
                'reason' => 'Time conflict with an approved event at this facility.',
            ];
        }

        if ($hasPendingConflict) {
            return [
                'status' => RequestStatus::APPROVED,
                'reason' => 'Time conflict exists only with a pending request; no denial required.',
            ];
        }

        if ($hasExternalEquipment) {
            return [
                'status' => RequestStatus::CONDITIONALLY_APPROVED,
                'reason' => 'Booking includes external equipment that requires additional approval.',
            ];
        }

        return [
            'status' => RequestStatus::APPROVED,
            'reason' => 'No conflicting schedule found for this facility slot.',
        ];
    }

    private function parseResponse(string $raw): array
    {
        \Log::debug('AI recommendation raw response: '.$raw);

        $clean = preg_replace('/```json|```/i', '', $raw);
        $clean = trim($clean);

        if (preg_match('/\{.*?"status".*?"reason".*?\}/s', $clean, $matches)) {
            $clean = $matches[0];
        }

        $decoded = json_decode($clean, true);

        if (! $decoded || ! isset($decoded['status'])) {
            foreach (RequestStatus::cases() as $case) {
                if (stripos($raw, $case->value) !== false) {
                    return [
                        'status' => $case,
                        'reason' => trim($raw),
                    ];
                }
            }

            return [
                'status' => RequestStatus::PENDING,
                'reason' => 'Could not parse AI response. Defaulting to Pending.',
            ];
        }

        $status = RequestStatus::tryFrom($decoded['status']) ?? RequestStatus::PENDING;

        return [
            'status' => $status,
            'reason' => $decoded['reason'] ?? '',
        ];
    }
}
