<?php

namespace App\Services\RAG;

use App\Models\Request as FacilityRequest;
use App\RequestStatus;
use Illuminate\Support\Facades\DB;


class AIRecommendationService
{
    public function __construct(protected OllamaService $ollama) {}

    // app/Services/AIRecommendationService.php

    public function recommend(FacilityRequest $request): array
    {
        try {
            $requestContext = $this->buildRequestContext($request);
            $embedding      = $this->ollama->embed($requestContext); // ← likely failing here

            $vectorLiteral = '[' . implode(',', $embedding) . ']';

            $relevantRules = DB::select("
            SELECT content, 1 - (embedding <=> ?) AS similarity
            FROM rule_embeddings
            ORDER BY embedding <=> ?
            LIMIT 8
        ", [$vectorLiteral, $vectorLiteral]);

            if (empty($relevantRules)) {
                return $this->fallback($request);
            }

            $rulesText     = collect($relevantRules)->map(fn($r) => '- ' . $r->content)->join("\n");
            $validStatuses = implode(', ', array_column(RequestStatus::cases(), 'value'));

            $prompt = <<<PROMPT
        You are a facility request evaluation assistant.
        Based ONLY on the rules below, recommend a status for the following request.

        RULES:
        {$rulesText}

        REQUEST DETAILS:
        {$requestContext}

        VALID STATUSES (choose exactly one): {$validStatuses}

        Respond ONLY in this exact JSON format with no extra text:
        {
          "status": "<one of the valid statuses>",
          "reason": "<one sentence citing the rule that led to this decision>"
        }
        PROMPT;

            $raw = $this->ollama->generate($prompt);

            return $this->parseResponse($raw);
        } catch (\Throwable $e) {
            \Log::warning('AIRecommendationService failed, using fallback: ' . $e->getMessage());
            return $this->fallback($request);
        }
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

        $facilities = $request->requestFacilities->map(
            fn($rf) =>
            "{$rf->facility->name} on {$rf->date_requested} from {$rf->time_start} to {$rf->time_end}"
        )->join('; ');

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
        // Strip possible markdown code fences
        $clean = preg_replace('/```json|```/', '', $raw);
        $clean = trim($clean);

        $decoded = json_decode($clean, true);

        if (!$decoded || !isset($decoded['status'])) {
            // Fallback: try to find a valid status in the raw text
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
