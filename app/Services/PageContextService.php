<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Models\AuditLog;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Rule as RuleModel;
use App\Models\Request as RequestModel;
use App\Models\RequestFacility;
use Illuminate\Support\Facades\Auth;

class PageContextService
{
    public function __construct(
        private readonly RequestService $requestService,
        private readonly FacilityService $facilityService,
    ) {}

    /**
     * Get the current page context objects for AI awareness.
     * This gathers data about the currently active facility, equipment,
     * requests, and rules that the AI can use as context.
     *
     * @return array Structured context objects
     */
    public function getCurrentPageContext(?array $clientContext = null): array
    {
        $page = $clientContext ?: $this->getPageObject();
        $routeName = $this->resolveRouteName($page);
        if (is_string($routeName) && $routeName !== '') {
            $page['route'] = $routeName;
        }

        $context = [
            'page' => $page,
            'facilities' => [],
            'equipment' => [],
            'requests' => [],
            'faq' => $this->getRules(30),
            'current_facility' => $this->getCurrentFacility(),
            'current_equipment' => $this->getCurrentEquipment(),
            'current_request' => $this->getCurrentRequest(),
        ];

        $pageSpecificContext = $this->getPageSpecificContext($routeName, $page);

        return array_merge($context, $pageSpecificContext);
    }

    private function resolveRouteName(array $page): ?string
    {
        $routeName = request()->route()?->getName();
        if (is_string($routeName) && $routeName !== '' && ! str_starts_with($routeName, 'api.')) {
            return $routeName;
        }

        $routeName = $page['route'] ?? null;
        if (is_string($routeName) && $routeName !== '' && ! str_starts_with($routeName, 'api.')) {
            return $routeName;
        }

        $path = $page['path'] ?? parse_url(request()->header('X-Page-URL', request()->fullUrl()), PHP_URL_PATH) ?: '/';

        return $this->resolveRouteNameFromPath($path, $page['url'] ?? null);
    }

    private function resolveRouteNameFromPath(string $path, ?string $url = null): ?string
    {
        $normalizedPath = rtrim($path, '/');
        if ($normalizedPath === '') {
            $normalizedPath = '/';
        }

        $queryString = null;
        if ($url !== null && str_contains($url, '?')) {
            $queryString = parse_url($url, PHP_URL_QUERY) ?: null;
        }

        $status = null;
        if (is_string($queryString) && $queryString !== '') {
            parse_str($queryString, $queryParams);
            $status = $queryParams['status'] ?? null;
        }

        $routeMap = [
            '/' => 'dashboard',
            '/dashboard' => 'dashboard',
            '/rules' => 'rules',
            '/facilities' => 'facilities',
            '/settings' => 'settings',
            '/request-options' => 'request-options',
            '/equipments' => 'equipments',
            '/requests' => 'requests.index',
            '/requests/create' => 'request.create',
            '/accounts' => 'accounts.index',
            '/chatbot-logs' => 'chatbot.logs.index',
        ];

        if (isset($routeMap[$normalizedPath])) {
            return $routeMap[$normalizedPath];
        }

        if (preg_match('#^/facilities/(\d+)$#', $normalizedPath, $matches)) {
            return 'facility.detail';
        }

        if (preg_match('#^/requests/(\d+)/edit$#', $normalizedPath, $matches)) {
            return 'requests.edit';
        }

        if (preg_match('#^/requests/(\d+)$#', $normalizedPath, $matches)) {
            return 'requests.detail';
        }

        if (is_string($status) && $status !== '' && preg_match('#^/requests$#', $normalizedPath)) {
            return 'requests.index';
        }

        return null;
    }

    private function getPageSpecificContext(?string $routeName, array $page): array
    {
        $path = $page['path'] ?? parse_url(request()->header('X-Page-URL', request()->fullUrl()), PHP_URL_PATH) ?: '/';

        $context = [
            'facilities' => [],
            'equipment' => [],
            'requests' => [],
        ];

        if (in_array($routeName, ['dashboard'], true)) {
            return $this->dashboardPageContext();
        }

        if (in_array($routeName, ['rules'], true)) {
            return $this->rulesPageContext();
        }

        if (in_array($routeName, ['facilities'], true)) {
            return $this->facilitiesPageContext();
        }

        if (in_array($routeName, ['facility.detail'], true) || preg_match('#^/facilities/(\d+)#', $path) === 1) {
            $facilityId = request()->route('facility_id') ?? request()->route('facility');
            if ($facilityId === null && preg_match('#^/facilities/(\d+)#', $path, $matches)) {
                $facilityId = $matches[1];
            }

            return $this->facilityDetailPageContext($facilityId);
        }

        if (in_array($routeName, ['equipments'], true) || preg_match('#^/equipments#', $path) === 1) {
            return $this->equipmentPageContext();
        }

        if (in_array($routeName, ['request.create'], true)) {
            return $this->requestCreatePageContext();
        }

        if (in_array($routeName, ['requests.index'], true)) {
            return $this->requestsIndexPageContext();
        }

        if (in_array($routeName, ['requests.detail', 'requests.edit'], true) || preg_match('#^/requests/(\d+)(?:/|$)#', $path) === 1) {
            $requestId = request()->route('request_id') ?? request()->route('request') ?? request()->route('id');
            if ($requestId === null && preg_match('#^/requests/(\d+)(?:/|$)#', $path, $matches)) {
                $requestId = $matches[1];
            }

            return $this->requestDetailPageContext($requestId);
        }

        if (in_array($routeName, ['settings'], true)) {
            return $context;
        }

        if (in_array($routeName, ['request-options'], true)) {
            return $context;
        }

        if (in_array($routeName, ['accounts.index'], true)) {
            return $this->accountsPageContext();
        }

        if (in_array($routeName, ['chatbot.logs.index'], true)) {
            return $this->chatbotLogsPageContext();
        }

        return $context;
    }

    private function dashboardPageContext(): array
    {
        $user = Auth::user();
        $isAdmin = $user->hasRole(['admin', 'Super Admin']);
        $since = now()->subDays(6)->startOfDay();

        $pending = $this->requestService->get([RequestStatus::PENDING]);

        $approvedThisWeek = RequestModel::query()
            ->when(! $isAdmin, fn ($q) => $q->where('user_id', $user->id))
            ->where('status', RequestStatus::APPROVED->value)
            ->where(fn ($q) => $q
                ->where('processed_at', '>=', $since)
                ->orWhere(fn ($q2) => $q2->whereNull('processed_at')->where('created_at', '>=', $since)))
            ->count();

        $eventsToday = $isAdmin
            ? $this->facilityService->getAllSchedule(
                now()->startOfDay()->format('Y-m-d'),
                now()->endOfDay()->format('Y-m-d')
            )->count()
            : RequestFacility::query()
                ->whereDate('date_requested', now()->toDateString())
                ->whereHas('request', fn ($q) => $q->where('user_id', $user->id))
                ->count();

        $conflictRequestIds = collect($pending->items())
            ->flatMap(fn ($request) => array_merge(
                collect($request->pending_conflicts ?? [])->all(),
                collect($request->approved_conflicts ?? [])->all(),
            ))
            ->pluck('request_id')
            ->filter()
            ->unique();

        $recentActivity = AuditLog::query()
            ->when(! $isAdmin, fn ($q) => $q->where('user_id', $user->id))
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($log) => [
                'event' => $log->event?->value ?? (string) $log->event,
                'description' => $log->description,
                'when' => $log->created_at?->diffForHumans(),
            ])
            ->values();

        return [
            'kpis' => [
                'awaiting_decision' => $pending->total(),
                'needs_action' => $conflictRequestIds->count(),
                'approved_this_week' => $approvedThisWeek,
                'events_today' => $eventsToday,
            ],
            'pending_requests' => collect($pending->items())->map(fn ($request) => [
                'id' => $request->id,
                'title' => $request->title,
                'status' => $request->status?->value ?? (string) $request->status,
                'requester' => $request->user?->name ?? 'unknown',
                'facilities' => $request->facilities->map(fn ($facility) => $facility->name)->values(),
            ])->values(),
            'recent_activity' => $recentActivity,
            'facilities' => [],
            'equipment' => [],
            'requests' => [],
        ];
    }

    private function rulesPageContext(): array
    {
        return [
            'policy_rules' => $this->getPolicyRules(50),
            'faq' => $this->getRules(50),
        ];
    }

    private function facilitiesPageContext(): array
    {
        return [
            'facilities' => $this->getFacilities(50),
        ];
    }

    private function facilityDetailPageContext(mixed $facilityId): array
    {
        if (! is_numeric($facilityId)) {
            return [
                'facilities' => [],
                'equipment' => [],
            ];
        }

        $facility = Facility::with(['facilityEquipments.equipment'])->find((int) $facilityId);
        if (! $facility) {
            return [
                'facilities' => [],
                'equipment' => [],
            ];
        }

        return [
            'facilities' => [[
                'id' => $facility->id,
                'name' => $facility->name,
                'building' => $facility->building,
                'capacity' => $facility->capacity,
            ]],
            'equipment' => $facility->facilityEquipments
                ->map(fn ($facilityEquipment) => [
                    'id' => $facilityEquipment->equipment?->id,
                    'name' => $facilityEquipment->equipment?->name,
                    'quantity' => $facilityEquipment->quantity,
                ])
                ->filter(fn ($equipment) => isset($equipment['id']))
                ->values()
                ->all(),
        ];
    }

    private function equipmentPageContext(): array
    {
        return [
            'equipment' => $this->getEquipment(50),
        ];
    }

    private function requestCreatePageContext(): array
    {
        $pending = RequestModel::with('requestFacilities.facility')
            ->where('status', \App\Enums\RequestStatus::PENDING->value)
            ->orderBy('created_at', 'desc')
            ->take(20)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'facilities' => $r->requestFacilities->map(fn ($rf) => $rf->facility?->name)->filter()->values(),
            ]);

        return [
            'facilities' => $this->getFacilities(50),
            'equipment' => $this->getEquipment(50),
            'policy_rules' => $this->getPolicyRules(30),
            'pending_requests_for_conflict_awareness' => $pending,
        ];
    }

    private function requestsPageContext(?string $status): array
    {
        $query = RequestModel::with('requestFacilities.facility')
            ->orderBy('created_at', 'desc');

        if ($status !== null && $status !== '') {
            $requestedStatuses = collect(explode(',', $status))
                ->map(fn ($value) => trim((string) $value))
                ->filter()
                ->map(function (string $value) {
                    $normalized = strtolower($value);

                    return collect(\App\Enums\RequestStatus::cases())
                        ->first(fn ($case) => strtolower($case->name) === $normalized || strtolower($case->value) === $normalized)
                        ?->value;
                })
                ->filter()
                ->values();

            if ($requestedStatuses->isNotEmpty()) {
                $query->whereIn('status', $requestedStatuses->all());
            }
        }

        $requests = $query->take(20)->get()->map(fn ($request) => [
            'id' => $request->id,
            'title' => $request->title,
            'status' => $request->status?->value ?? 'unknown',
            'created_at' => $request->created_at?->toDateTimeString(),
            'facilities' => $request->requestFacilities->map(fn ($facilityRequest) => [
                'facility_id' => $facilityRequest->facility_id,
                'facility_name' => $facilityRequest->facility?->name ?? 'unknown',
            ])->toArray(),
        ])->toArray();

        return [
            'requests' => $requests,
        ];
    }

    private function requestDetailPageContext(mixed $requestId): array
    {
        if (! is_numeric($requestId)) {
            return [
                'requests' => [],
                'facilities' => [],
                'equipment' => [],
            ];
        }

        $request = RequestModel::with([
            'user', 'requestFacilities.facility', 'equipment', 'comments.user', 'files', 'processedBy',
        ])->find((int) $requestId);

        if (! $request) {
            return [
                'requests' => [],
                'facilities' => [],
                'equipment' => [],
            ];
        }

        $recentActivity = \App\Models\AuditLog::where('subject_type', RequestModel::class)
            ->where('subject_id', $request->id)
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($log) => [
                'event' => $log->event?->value ?? (string) $log->event,
                'description' => $log->description,
                'when' => $log->created_at?->diffForHumans(),
            ])->values();

        $detail = [
            'id' => $request->id,
            'title' => $request->title,
            'description' => $request->description,
            'status' => $request->status?->value ?? 'unknown',
            'requester' => $request->user?->name,
            'priority_level' => $request->priority_level?->value,
            'priority_reason' => $request->priority_reason,
            'on_hold' => $request->on_hold,
            'recommended_action' => $request->recommended_action?->value,
            'recommended_action_reason' => $request->recommended_action_reason,
            'processed_by' => $request->processedBy?->name,
            'processed_at' => $request->processed_at?->toDateTimeString(),
            'created_at' => $request->created_at?->toDateTimeString(),
            'updated_at' => $request->updated_at?->toDateTimeString(),
            'comments' => $request->comments->map(fn ($c) => [
                'author' => $c->user?->name,
                'body' => $c->body,
                'created_at' => $c->created_at?->diffForHumans(),
            ])->values(),
            'files' => $request->files->map(fn ($f) => $f->original_name)->values(),
            'recent_activity' => $recentActivity,
        ];

        return [
            'requests' => [$detail],
            'facilities' => $request->requestFacilities->map(fn ($rf) => [
                'id' => $rf->facility_id,
                'name' => $rf->facility?->name ?? 'unknown',
                'status' => $rf->status ?? 'unknown',
            ])->toArray(),
            'equipment' => $request->equipment->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->name,
                'quantity' => $e->pivot?->quantity_needed ?? $e->quantity,
            ])->toArray(),
            'policy_rules' => $this->getPolicyRules(30),
        ];
    }

    private function requestsIndexPageContext(): array
    {
        $request = request();
        $statusParam = $request->input('status');

        $statusValues = $statusParam
            ? collect(explode(',', $statusParam))
                ->map(fn ($s) => collect(\App\Enums\RequestStatus::cases()))
                    ->firstWhere(fn ($case) => strtolower($case->name) === strtolower(trim($s)))
                ->filter()
                ->values()
            : collect();

        $results = $this->requestService->get(
            $statusValues->isNotEmpty() ? $statusValues->all() : null,
            $request->input('filter', 'this_week'),
            $request->input('search'),
            $request->input('sort'),
            $request->input('order', 'asc'),
            $request->input('requester'),
            $request->input('facility'),
        );

        return [
            'visible_requests' => collect($results->items())->take(20)->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'status' => $r->status?->value,
                'requester' => $r->user?->name,
                'facilities' => $r->requestFacilities->map(fn ($rf) => $rf->facility?->name)->filter()->values(),
            ])->values(),
            'facilities' => [],
            'equipment' => [],
        ];
    }

    private function accountsPageContext(): array
    {
        return [
            'users' => \App\Models\User::select('id', 'name', 'email')->orderBy('name')->take(25)->get()->toArray(),
        ];
    }

    private function chatbotLogsPageContext(): array
    {
        return [
            'chatbot_logs' => \App\Models\ChatbotInteractionLog::with(['user:id,name', 'facilityRequest:id,title'])
                ->latest()
                ->take(20)
                ->get()
                ->map(fn ($log) => [
                    'id' => $log->id,
                    'user' => $log->user?->name,
                    'status' => $log->status,
                    'intent' => $log->intent,
                    'created_at' => $log->created_at?->toDateTimeString(),
                ])
                ->toArray(),
        ];
    }

    private function getPageObject(): array
    {
        $pageUrl = request()->header('X-Page-URL', request()->fullUrl());
        $routeName = request()->route()?->getName();
        $path = parse_url($pageUrl, PHP_URL_PATH) ?: '/';
        $page = [
            'url' => $pageUrl,
            'path' => $path,
            'route' => $routeName,
        ];

        $facilityId = request()->route('facility_id') ?? request()->route('facility');
        $requestId = request()->route('request_id') ?? request()->route('request');
        $equipmentId = request()->route('equipment');

        if ($facilityId === null && preg_match('#/facilities/(\d+)#', $path, $matches)) {
            $facilityId = $matches[1];
        }
        if ($requestId === null && preg_match('#/requests/(\d+)#', $path, $matches)) {
            $requestId = $matches[1];
        }
        if ($equipmentId === null && preg_match('#/equipments/(\d+)#', $path, $matches)) {
            $equipmentId = $matches[1];
        }

        $page['facility'] = $this->facilityObject($facilityId);
        $page['request'] = $this->requestObject($requestId);
        $page['equipment'] = $this->equipmentObject($equipmentId);

        return $page;
    }

    private function facilityObject(mixed $id): ?array
    {
        if (! is_numeric($id)) {
            return null;
        }

        $facility = Facility::find((int) $id);

        return $facility ? [
            'id' => $facility->id,
            'name' => $facility->name,
            'building' => $facility->building,
            'capacity' => $facility->capacity,
        ] : null;
    }

    private function equipmentObject(mixed $id): ?array
    {
        if (! is_numeric($id)) {
            return null;
        }

        $equipment = Equipment::find((int) $id);

        return $equipment ? [
            'id' => $equipment->id,
            'name' => $equipment->name,
            'quantity' => $equipment->quantity,
        ] : null;
    }

    private function requestObject(mixed $id): ?array
    {
        if (! is_numeric($id)) {
            return null;
        }

        $facilityRequest = RequestModel::find((int) $id);

        return $facilityRequest ? [
            'id' => $facilityRequest->id,
            'title' => $facilityRequest->title,
            'status' => $facilityRequest->status?->value ?? 'unknown',
        ] : null;
    }

    /**
     * Get all facilities with basic info.
     */
    private function getFacilities(?int $limit = null): array
    {
        $query = Facility::select('id', 'name', 'building', 'capacity')
            ->orderBy('name', 'asc');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query->get()->toArray();
    }

    /**
     * Get all equipment with basic info.
     */
    private function getEquipment(?int $limit = null): array
    {
        $query = Equipment::select('id', 'name', 'quantity')
            ->orderBy('name', 'asc');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query->get()->toArray();
    }

    /**
     * Get recent requests with status info.
     */
    private function getRecentRequests(?int $limit = 10): array
    {
        $query = RequestModel::with('requestFacilities.facility')
            ->orderBy('created_at', 'desc');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query->get()->map(fn ($r) => [
            'id' => $r->id,
            'title' => $r->title,
            'status' => $r->status?->value ?? 'unknown',
            'created_at' => $r->created_at?->toDateTimeString(),
            'facilities' => $r->requestFacilities->map(fn ($rf) => [
                'facility_id' => $rf->facility_id,
                'facility_name' => $rf->facility?->name ?? 'unknown',
                'status' => $rf->status ?? 'unknown',
            ])->toArray(),
        ])->toArray();
    }

    /**
     * Get all rules/FAQ entries.
     */
    private function getRules(?int $limit = 20): array
    {
        $query = RuleModel::where('forPolicy', 1)
            ->whereNotNull('faq_answer')
            ->whereRaw("TRIM(faq_answer) <> ''")
            ->select('id', 'rule as question', 'faq_answer as answer')
            ->orderBy('priority', 'asc')
            ->orderBy('id', 'asc');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query->get()->toArray();
    }

    /**
     * Get all policy rules (non-FAQ rules that explain system decisions).
     */
    private function getPolicyRules(?int $limit = 30): array
    {
        $query = RuleModel::where('forPolicy', 0)
            ->select('id', 'rule as policy_text', 'priority')
            ->orderBy('priority', 'asc');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query->get()->toArray();
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
            $request = RequestModel::find($sessionRequest);
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