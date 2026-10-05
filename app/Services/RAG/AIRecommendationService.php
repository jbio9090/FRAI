<?php

namespace App\Services\RAG;

use App\Enums\RequestStatus;
use App\Models\Request as FacilityRequest;
use App\Models\RequestFacility;
use App\Models\Rule;
use App\Services\AI\OpenRouterClient;
use Illuminate\Support\Collection;

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
     * Build the policy prompt and LLM call for one specific RequestFacility.
     */
    private function evaluateFacility(FacilityRequest $request, RequestFacility $rf): array
    {
        $facilityContext = $this->buildRequestContext($request, $rf);

        $policyRules = $this->policyRules();

        if ($policyRules->isEmpty()) {
            return $this->fallbackForFacility($rf);
        }

        \Log::debug("Policy rules sent for RequestFacility#{$rf->id}", [
            'count' => $policyRules->count(),
        ]);

        $ruleLines = $policyRules
            ->values()
            ->map(fn ($r, $i) => ($i + 1).'. '.trim((string) $r->rule))
            ->join("\n");

        $ruleCount = $policyRules->count();
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

===POLICY RULES ({$ruleCount} total — this is the COMPLETE current policy set)===
{$ruleLines}
Every rule above is listed deliberately and none have been pre-filtered for you. Many of them will NOT apply to this particular request, because each rule governs a specific resource, event type, or user group. Decide applicability per rule from the request details below.

===PRE-EVALUATED SIGNALS===
These are computed facts about THIS specific facility booking. Trust them exactly as written; do not reinterpret them.
{$signals}

===REQUEST DETAILS===
{$facilityContext}

===YOUR TASK===
Go through EACH of the {$ruleCount} rules above one by one.
For every rule, decide: does this request comply, violate, or is the rule not applicable?
A rule that is NOT APPLICABLE is NOT a violation. Ignore it completely — it must have no effect on the status. The full rule set is supplied so that nothing is MISSED, not so that every rule COUNTS.
If ANY APPLICABLE rule is violated, the status must reflect that (Denied or Conditionally Approved as appropriate).
If no applicable rule is violated, default to Approved.

VALID STATUSES (choose exactly one): {$validStatuses}

Respond using ONLY this JSON structure — no other text:
{"status": "<valid status>", "reason": "<single plain paragraph, max 3 short sentences and about 60 words, stating only the decisive outcome in plain language. No bullets, numbering, markdown, line breaks, rule quotes, or extra detail>"}
PROMPT;

        $raw = $this->ai->chat([
            [
                'role' => 'system',
                'content' => 'You are a JSON-only response bot. You must output a single valid JSON object and absolutely nothing else. No explanation, no markdown, no preamble. Keep the reason value concise: one plain paragraph, max 3 short sentences.',
            ],
            [
                'role' => 'user',
                'content' => $prompt,
            ],
        ], ['timeout' => config('ai.recommendation.timeout', 120), 'max_tokens' => 250]);

        return $this->parseResponse($raw);
    }

    /**
     * Load the complete policy rule set for inclusion in the prompt.
     *
     * Every policy rule is supplied so that no rule can be silently dropped
     * from evaluation. Ordering follows the admin-controlled priority so the
     * reorder UI on the Rules page still controls the order the model reads
     * them in. The prompt instructs the model to disregard any rule that does
     * not apply to the request under review.
     */
    private function policyRules(): Collection
    {
        return Rule::policy()
            ->orderBy('priority')
            ->orderBy('id')
            ->get();
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
        $facilityLine = "{$rf->facility->name} on {$rf->date_requested} from {$rf->time_start} to {$rf->time_end}";

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
                        'reason' => self::toConciseParagraph($raw),
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
            'reason' => self::toConciseParagraph((string) ($decoded['reason'] ?? '')),
        ];
    }

    /**
     * Normalize any AI-provided reason into a single plain paragraph:
     * no markdown, bullets, numbering, or line breaks, capped at
     * 3 sentences / ~70 words so cards, rollups, and emails stay scannable.
     */
    public static function toConciseParagraph(string $text, int $maxSentences = 3, int $maxWords = 70): string
    {
        $text = preg_replace('/```.*?```/s', ' ', $text) ?? $text;
        $text = str_replace(['`', '**', '__', '##', '#'], ' ', $text);
        $text = preg_replace('/^\s*(?:[-*•\d]+[.)\]:-]?\s+)+/m', ' ', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;
        $text = trim($text, " \t\n\r\0\x0B-\"'");

        if ($text === '') {
            return '';
        }

        $sentences = preg_split('/(?<=[.!?])\s+/', $text) ?: [$text];
        $sentences = array_values(array_filter(array_map('trim', $sentences)));

        if (count($sentences) > $maxSentences) {
            $sentences = array_slice($sentences, 0, $maxSentences);
        }

        $paragraph = implode(' ', $sentences);
        $words = preg_split('/\s+/', $paragraph) ?: [];

        if (count($words) > $maxWords) {
            $paragraph = implode(' ', array_slice($words, 0, $maxWords));
            $paragraph = rtrim($paragraph, " \t-–—:;,").'.';
        }

        return $paragraph;
    }
}
