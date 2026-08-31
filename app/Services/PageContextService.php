<?php

namespace App\Services;

use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Rule as RuleModel;
use App\Models\Request as RequestModel;
use Illuminate\Support\Str;

class PageContextService
{
    /**
     * Get the current page context objects for AI awareness.
     * This gathers data about the currently active facility, equipment,
     * requests, and rules that the AI can use as context.
     *
     * @return array Structured context objects
     */
    public function getCurrentPageContext(): array
    {
        $context = [];

        // Get all facilities for reference
        $context['facilities'] = $this->getFacilities();

        // Get all equipment for reference
        $context['equipment'] = $this->getEquipment();

        // Get recent/active requests
        $context['requests'] = $this->getRecentRequests();

        // Get rules/FAQ entries
        $context['rules'] = $this->getRules();

        // Determine current active facility/page
        $context['current_facility'] = $this->getCurrentFacility();
        $context['current_equipment'] = $this->getCurrentEquipment();
        $context['current_request'] = $this->getCurrentRequest();

        return $context;
    }

    /**
     * Get all facilities with basic info.
     */
    private function getFacilities(): array
    {
        return Facility::select('id', 'name', 'building', 'capacity')
            ->orderBy('name', 'asc')
            ->get()
            ->keyBy('id')
            ->only(['id', 'name', 'building', 'capacity'])
            ->toArray();
    }

    /**
     * Get all equipment with basic info.
     */
    private function getEquipment(): array
    {
        return Equipment::select('id', 'name', 'quantity')
            ->orderBy('name', 'asc')
            ->get()
            ->keyBy('id')
            ->only(['id', 'name', 'quantity'])
            ->toArray();
    }

    /**
     * Get recent requests with status info.
     */
    private function getRecentRequests(): array
    {
        return RequestModel::with(['status', 'requestFacilities.facility'])
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'status' => $r->status?->value ?? 'unknown',
                'created_at' => $r->created_at->toDateTimeString(),
                'facilities' => $r->requestFacilities->map(fn ($rf) => [
                    'facility_id' => $rf->facility_id,
                    'facility_name' => $rf->facility?->name ?? 'unknown',
                    'status' => $rf->status ?? 'unknown',
                ])->toArray(),
            ])
            ->toArray();
    }

    /**
     * Get all rules/FAQ entries.
     */
    private function getRules(): array
    {
        return RuleModel::where('forPolicy', 1)
            ->whereNotNull('faq_answer')
            ->whereRaw("TRIM(faq_answer) <> ''")
            ->select('id', 'rule', 'faq_answer')
            ->orderBy('priority', 'asc')
            ->orderBy('id', 'asc')
            ->take(20)
            ->get()
            ->keyBy('id')
            ->only(['id', 'rule', 'faq_answer'])
            ->toArray();
    }

    /**
     * Determine the currently active facility from the session or request.
     * Checks for a facility in the session, or infers from various sources.
     */
    private function getCurrentFacility(): ?array
    {
        // Try to get from session
        $sessionFacility = session()->get('current_facility');
        if ($sessionFacility && is_numeric($sessionFacility)) {
            $facility = Facility::find($sessionFacility);
            if ($facility) {
                return [
                    'id' => $facility->id,
                    'name' => $facility->name,
                    'building' => $facility->building,
                ];
            }
        }

        // Try to infer from recent messages or context
        // This is a best-effort inference
        return null;
    }

    /**
     * Determine the currently active equipment from the session or request.
     */
    private function getCurrentEquipment(): ?array
    {
        $sessionEquipment = session()->get('current_equipment');
        if ($sessionEquipment && is_numeric($sessionEquipment)) {
            $equipment = Equipment::find($sessionEquipment);
            if ($equipment) {
                return [
                    'id' => $equipment->id,
                    'name' => $equipment->name,
                ];
            }
        }
        return null;
    }

    /**
     * Determine the currently active request from the session or route.
     */
    private function getCurrentRequest(): ?array
    {
        $sessionRequest = session()->get('current_request');
        if ($sessionRequest && is_numeric($sessionRequest)) {
            $request = RequestModel::with('status')->find($sessionRequest);
            if ($request) {
                return [
                    'id' => $request->id,
                    'title' => $request->title,
                    'status' => $request->status?->value ?? 'unknown',
                ];
            }
        }
        return null;
    }
}