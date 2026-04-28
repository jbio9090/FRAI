<?php

namespace App\Services\RAG;

use App\Models\Request as FacilityRequest;
use App\RequestStatus;
use Illuminate\Support\Facades\DB;


class AIRecommendationService
{
    public function __construct(protected OllamaService $ollama) {}

    public function recommend(FacilityRequest $request): array
    {
        try {
            $requestContext = $this->buildRequestContext($request);
            $embedding      = $this->ollama->embed($requestContext);
            if (empty($embedding)) {
                return $this->fallback($request);
            }

            $vectorLiteral = '[' . implode(',', $embedding) . ']';

            // Default raised from 3 → 10. With only 3 rules the model never
            // saw most of the policy rules that were relevant. Set this higher
            // in config('ollama-laravel.recommendation_rule_limit') if you have
            // many rules and still see gaps.
            $ruleLimit = (int) config('ollama-laravel.recommendation_rule_limit', 10);

            $relevantRules = DB::table('rule_embeddings')
                ->join('rules', 'rules.id', '=', 'rule_embeddings.rule_id')
                // Removed the ->where('rules.forPolicy', 0) filter that was
                // silently excluding all FAQ/non-policy rules from retrieval.
                // Both rule types are now eligible; the model decides relevance.
                ->selectRaw('rule_embeddings.content, 1 - (rule_embeddings.embedding <=> ?) AS similarity', [$vectorLiteral])
                ->orderByRaw('rule_embeddings.embedding <=> ?', [$vectorLiteral])
                ->limit(max($ruleLimit, 1))
                ->get();

            if ($relevantRules->isEmpty()) {
                return $this->fallback($request);
            }

            \Log::debug('Relevant rules retrieved', [
                'rules' => $relevantRules->map(fn($r) => [
                    'content'    => $r->content,
                    'similarity' => $r->similarity,
                ])->toArray(),
            ]);

            // Number every rule so the model can tick through them linearly.
            // Small models (2B) lose track of bullet lists; an explicit
            // numbered sequence with a "check each one" instruction helps.
            $ruleLines = collect($relevantRules)
                ->values()
                ->map(fn($r, $i) => ($i + 1) . '. ' . $r->content)
                ->join("\n");

            $ruleCount     = collect($relevantRules)->count();
            $validStatuses = implode(', ', array_column(
                array_filter(RequestStatus::cases(), fn($case) => $case->name !== RequestStatus::PENDING->name),
                'value'
            ));

            $now     = now()->toDateTimeString();
            $signals = $this->buildSignals($request);

            $prompt = <<<PROMPT
TODAY'S DATE AND TIME: {$now}

===RULES ({$ruleCount} total — you MUST apply every single one)===
{$ruleLines}

===PRE-EVALUATED SIGNALS===
These are computed facts. Trust them exactly as written; do not reinterpret them.
{$signals}

===REQUEST DETAILS===
{$requestContext}

===YOUR TASK===
Go through EACH of the {$ruleCount} rules above one by one.
For every rule, decide: does this request comply, violate, or is the rule not applicable?
If ANY rule is violated, the status must reflect that (Denied or Conditionally Approved as appropriate).
If ALL rules are satisfied, default to Approved.

VALID STATUSES (choose exactly one): {$validStatuses}

Respond using ONLY this JSON structure — no other text:
{"status": "<valid status>", "reason": "<one sentence summarising the decisive rule or overall result>"}
PROMPT;

            $raw = $this->ollama->generate($prompt);

            return $this->parseResponse($raw);
        } catch (\Throwable $e) {
            \Log::warning('AIRecommendationService failed, using fallback: ' . $e->getMessage());
            return $this->fallback($request);
        }
    }

    /**
     * Pre-compute deterministic facts about the request and format them
     * as unambiguous signals for the LLM. This prevents the model from
     * doing its own (unreliable) date math or numeric comparisons.
     */
    private function buildSignals(FacilityRequest $request): string
    {
        $request->loadMissing([
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment',
        ]);

        $lines = [];

        // --- Temporal verdict (keep this — it's a policy decision, not just math) ---
        $minDaysUntil = null;

        foreach ($request->requestFacilities as $rf) {
            $daysUntil = now()->startOfDay()->diffInDays(
                \Carbon\Carbon::parse($rf->date_requested)->startOfDay(),
                false
            );

            if ($minDaysUntil === null || $daysUntil < $minDaysUntil) {
                $minDaysUntil = $daysUntil;
            }
        }

        if ($minDaysUntil !== null) {
            if ($minDaysUntil < 0) {
                $lines[] = '- TEMPORAL: At least one facility date is in the PAST. This request cannot be approved.';
            } elseif ($minDaysUntil < 3) {
                $lines[] = "- TEMPORAL: Nearest facility date is only {$minDaysUntil} day(s) from today. The 3-day advance rule is VIOLATED. This request must be DENIED.";
            } else {
                $lines[] = "- TEMPORAL: Nearest facility date is {$minDaysUntil} days from today. The 3-day advance rule is NOT violated.";
            }
        }

        // --- Conflict signals (keep — boolean facts the model shouldn't infer) ---
        $hasApprovedConflict = !empty($request->approved_conflict_rf_ids);
        $hasPendingConflict  = !empty($request->pending_conflict_rf_ids);

        $lines[] = $hasApprovedConflict
            ? '- CONFLICT: There IS a schedule conflict with an already APPROVED booking. This request must be DENIED.'
            : '- CONFLICT: No conflicts with approved bookings.';

        $lines[] = $hasPendingConflict
            ? '- CONFLICT: There is a schedule conflict with a PENDING booking (not yet approved). This alone does not require denial.'
            : '- CONFLICT: No conflicts with pending bookings.';

        // --- External equipment (keep — boolean fact) ---
        $hasExternalEquipment = $request->requestFacilities
            ->flatMap(fn($rf) => $rf->externalEquipments ?? collect())
            ->isNotEmpty();

        $lines[] = $hasExternalEquipment
            ? '- EQUIPMENT: Request includes external (non-owned) equipment. Conditional approval is likely required.'
            : '- EQUIPMENT: No external equipment involved.';

        // --- Pre-approval (keep — boolean fact) ---
        if (!empty($request->approved_by)) {
            $approvers = implode(', ', $request->approved_by);
            $lines[]   = "- PRE-APPROVAL: This request has been pre-approved by: {$approvers}.";
        }

        return implode("\n", $lines);
    }

    private function fallback(FacilityRequest $request): array
    {
        $hasApprovedConflict = !empty($request->approved_conflict_rf_ids);
        $hasPendingConflict  = !empty($request->pending_conflict_rf_ids);
        $hasExternalEquipment = $request->requestFacilities
            ->flatMap(fn($rf) => $rf->externalEquipments ?? collect())
            ->isNotEmpty();

        if ($hasApprovedConflict) {
            return [
                'status' => RequestStatus::DENIED,
                'reason' => 'Time conflict with approved events.',
            ];
        }

        if ($hasPendingConflict) {
            return [
                'status' => RequestStatus::APPROVED,
                'reason' => 'Time conflict with pending requests.',
            ];
        }

        if ($hasExternalEquipment) {
            return [
                'status' => RequestStatus::CONDITIONALLY_APPROVED,
                'reason' => 'Approve request along with the external equipment.',
            ];
        }

        return [
            'status' => RequestStatus::APPROVED,
            'reason' => 'No conflicting schedule found for all requested facilities.',
        ];
    }

    private function buildRequestContext(FacilityRequest $request): string
    {
        $request->loadMissing([
            'requestFacilities.facility',
            'requestFacilities.externalEquipments',
            'equipment',
        ]);

        $facilities = $request->requestFacilities->map(function ($rf) {
            $daysUntil = now()->startOfDay()->diffInDays(
                \Carbon\Carbon::parse($rf->date_requested)->startOfDay(),
                false
            );
            $urgency = $daysUntil < 0
                ? "PAST DATE"
                : "({$daysUntil} days from today)";

            return "{$rf->facility->name} on {$rf->date_requested} {$urgency} from {$rf->time_start} to {$rf->time_end}";
        })->join('; ');

        $equipment = $request->equipment->map(
            fn($eq) =>
            "{$eq->name} x{$eq->pivot->quantity_needed}" . ($eq->pivot->is_borrowed ? ' (borrowed)' : '')
        )->join(', ');

        $hasExternalEquipment = $request->requestFacilities
            ->flatMap(fn($rf) => $rf->externalEquipments ?? collect())
            ->isNotEmpty();

        $approvedConflictRfIds = $request->approved_conflict_rf_ids ?? [];
        $pendingConflictRfIds  = $request->pending_conflict_rf_ids ?? [];

        $approvedConflictDetails = '';
        $pendingConflictDetails  = '';

        if (!empty($approvedConflictRfIds)) {
            $approvedConflictDetails = \App\Models\RequestFacility::whereIn('id', $approvedConflictRfIds)
                ->with(['facility', 'request.user'])
                ->get()
                ->map(
                    fn($rf) =>
                    "  - \"{$rf->request->title}\" by {$rf->request->user->name} at {$rf->facility->name} ({$rf->time_start}–{$rf->time_end})"
                )->join("\n");
        }

        if (!empty($pendingConflictRfIds)) {
            $pendingConflictDetails = \App\Models\RequestFacility::whereIn('id', $pendingConflictRfIds)
                ->with(['facility', 'request.user'])
                ->get()
                ->map(
                    fn($rf) =>
                    "  - \"{$rf->request->title}\" by {$rf->request->user->name} at {$rf->facility->name} ({$rf->time_start}–{$rf->time_end})"
                )->join("\n");
        }

        return implode("\n", array_filter([
            "Title: {$request->title}",
            "Description: {$request->description}",
            "Priority Level: {$request->priority_level->name}",
            $request->priority_reason        ? "Priority Reason: {$request->priority_reason}"          : null,
            "Facilities Requested: {$facilities}",
            $equipment                        ? "Equipment: {$equipment}"                                : null,
            $hasExternalEquipment             ? "Has External (non-owned) Equipment: Yes"               : null,
            $approvedConflictDetails          ? "Conflicts with APPROVED bookings:\n{$approvedConflictDetails}" : "Conflicts with approved bookings: None",
            $pendingConflictDetails           ? "Conflicts with PENDING bookings:\n{$pendingConflictDetails}"   : "Conflicts with pending bookings: None",
            $request->approved_by             ? "Pre-approved by: " . implode(', ', $request->approved_by)     : null,
        ]));
    }

    private function parseResponse(string $raw): array
    {
        \Log::debug('Ollama raw response: ' . $raw);

        // Strip markdown fences
        $clean = preg_replace('/```json|```/i', '', $raw);
        $clean = trim($clean);

        // Try to extract a JSON object anywhere in the response
        if (preg_match('/\{.*?"status".*?"reason".*?\}/s', $clean, $matches)) {
            $clean = $matches[0];
        }

        $decoded = json_decode($clean, true);

        if (!$decoded || !isset($decoded['status'])) {
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