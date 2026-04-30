<?php

namespace App\Http\Controllers;

use App\Http\Requests\FacilityFormRequest;
use Illuminate\Http\Request;
use App\Models\Request as FacilityRequest;
use Inertia\Inertia;
use App\Models\Facility;
use App\Models\User;
use App\RequestStatus;
use App\Services\RequestService;
use App\Services\NotificationService;
use App\Jobs\ProcessRequestRecommendation;
use App\Services\AuditLogger;
use App\Models\AuditLog;

class RequestController extends Controller
{
    public function __construct(
        protected RequestService $service,
        protected NotificationService $notification,
        protected AuditLogger $auditLogger,
    ) {}

    public function index(Request $request)
    {
        $statusParam = $request->input('status');

        $statusValues = $statusParam
            ? collect(explode(',', $statusParam))
            ->map(fn($s) => collect(RequestStatus::cases())
                ->firstWhere(fn($case) => strtolower($case->name) === strtolower(trim($s))))
            ->filter()
            ->values()
            : collect();

        $pageTitle = $statusValues->isNotEmpty()
            ? $statusValues->map(fn($s) => $s->value)->join(', ')
            : 'All Requests';

        return Inertia::render('requests/index', [
            'requests' => Inertia::defer(fn() => $this->service->get(
                $statusValues->isNotEmpty() ? $statusValues->all() : null,
                $request->input("filter", "this_week"),
                $request->input("search"),
                $request->input("sort"),
                $request->input("order", "asc"),
                $request->input("requester"),
                $request->input("facility"),
                $request->input("has_external_equipment"),
            )),
            'page_title' => $pageTitle,
            'filters'    => ['status' => $statusParam],
            'facilities' => Facility::select('id', 'name')->orderBy('name')->get(),
            'requesters' => User::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'action'  => ['required', 'in:approve,reject,conditionally_approve,for_reschedule'],
            'comment' => ['nullable', 'string'],
        ]);

        $facilityRequest = FacilityRequest::findOrFail($id);

        $statusMap = [
            'approve'               => RequestStatus::APPROVED,
            'reject'                => RequestStatus::DENIED,
            'conditionally_approve' => RequestStatus::CONDITIONALLY_APPROVED,
            'for_reschedule'        => RequestStatus::FOR_RESCHEDULE,
        ];

        $defaultCommentMap = [
            'approve'               => 'Your request has been approved.',
            'reject'                => 'Your request has been denied.',
            'conditionally_approve' => 'Your request has been conditionally approved.',
            'for_reschedule'        => 'Your request has been marked for rescheduling.',
        ];

        $action      = $validated['action'];
        $commentBody = $validated['comment'] ?? $defaultCommentMap[$action];

        if ($action === 'approve') {
            // The service already loops through requestFacilities and updates them
            $facilityRequest = $this->service->approve($id);
            $this->auditLogger::requestApproved($facilityRequest);
        } else {
            // Update the parent request
            $facilityRequest->update([
                'status'       => $statusMap[$action],
                'processed_by' => auth()->id(),
                'processed_at' => now(),
            ]);

            // individual facilties
            $facilityRequest->requestFacilities()
                ->whereNotIn('status', [RequestStatus::APPROVED, RequestStatus::DENIED])
                ->update(['status' => $statusMap[$action]]);

            match ($action) {
                'reject'                => $this->auditLogger::requestDenied($facilityRequest),
                'conditionally_approve' => $this->auditLogger::requestConditionallyApproved($facilityRequest),
                'for_reschedule'        => $this->auditLogger::requestMarkedForReschedule($facilityRequest),
                default                 => null,
            };
        }

        $facilityRequest->comments()->create([
            'body'    => $commentBody,
            'user_id' => auth()->id(),
        ]);

        $this->notification->notifyUser($facilityRequest);

        return back()->with('success', ucfirst(str_replace('_', ' ', $action)) . ' successful');
    }

    public function approve(Request $request, $id)
    {
        $commentBody     = $request->input('comment', 'Your request has been approved.');
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest = $this->service->approve($id);

        $facilityRequest->comments()->create([
            'body'    => $commentBody,
            'user_id' => auth()->id(),
        ]);

        $this->notification->notifyUser($facilityRequest);

        $message = $facilityRequest->on_hold
            ? 'Request placed on hold due to a higher-priority conflict.'
            : 'Request approved successfully.';

        return redirect()->back()->with('success', $message);
    }

    public function reject(Request $request, $id)
    {
        $commentBody     = $request->input('comment', 'Your request has been denied.');
        $facilityRequest = FacilityRequest::findOrFail($id);

        $facilityRequest->update(['status' => RequestStatus::DENIED]);
        $facilityRequest->comments()->create([
            'body'    => $commentBody,
            'user_id' => auth()->id(),
        ]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request rejected successfully.');
    }

    public function conditionally_approve(Request $request, $id)
    {
        $commentBody     = $request->input('comment', 'Your request has been conditionally approved.');
        $facilityRequest = FacilityRequest::findOrFail($id);

        $facilityRequest->update(['status' => RequestStatus::CONDITIONALLY_APPROVED]);
        $facilityRequest->comments()->create([
            'body'    => $commentBody,
            'user_id' => auth()->id(),
        ]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request conditionally approved successfully.');
    }

    public function createPage()
    {
        return Inertia::render("requests/create", [
            'facilities' => Facility::with([
                'equipment' => fn($q) => $q->select('equipments.id', 'equipments.name', 'equipments.quantity')
                    ->orderBy('equipments.name')
            ])->select('id', 'name', 'capacity', 'building')->get(),
        ]);
    }

    public function detail(int $request_id)
    {
        $requestModel = FacilityRequest::findOrFail($request_id);

        return Inertia::render("requests/detail", [
            'labeledBreadcrumb' => $requestModel->title,
            'request'           => Inertia::defer(fn() => $this->service->getDetail($request_id)),
            'auditLogs'         => Inertia::defer(fn() => AuditLog::query()
                ->forSubject($requestModel)
                ->with('user')
                ->latest()
                ->paginate(10)),
        ]);
    }

    public function auditLogs(Request $request, int $id)
    {
        $requestModel = FacilityRequest::findOrFail($id);

        return response()->json(
            AuditLog::query()
                ->forSubject($requestModel)
                ->with('user')
                ->latest()
                ->paginate(10)
        );
    }

    public function store(FacilityFormRequest $request)
    {
        $validated = $request->validated();

        $saved_request = $this->service->create($validated);

        ProcessRequestRecommendation::dispatch($saved_request, $validated['facility_bookings']);

        $this->notification->notifyAdmin($saved_request->title, $request->user()->name, $saved_request->id);

        return redirect()->route('requests.index', ['status' => strtolower(RequestStatus::PENDING->name)])
            ->with('success', 'Request created successfully');
    }

    public function hold($id)
    {
        $facilityRequest = \App\Models\Request::findOrFail($id);

        $facilityRequest->on_hold = !$facilityRequest->on_hold;
        $facilityRequest->save();

        $this->auditLogger::requestHoldToggled($facilityRequest, $facilityRequest->on_hold);

        return back()->with('success', $facilityRequest->on_hold ? 'Request placed on hold.' : 'Request removed from hold.');
    }

    public function bulkAction(Request $request)
    {
        $validated = $request->validate([
            'ids'     => ['required', 'array', 'min:1'],
            'ids.*'   => ['integer', 'exists:requests,id'],
            'action' => ['required', 'string', 'in:approve,reject,conditionally_approve,comment,for_reschedule'],
            'comment' => ['nullable', 'string'],
        ]);

        $statusMap = [
            'reject'                => RequestStatus::DENIED,
            'conditionally_approve' => RequestStatus::CONDITIONALLY_APPROVED,
        ];

        $defaultCommentMap = [
            'approve'               => 'Your request has been approved.',
            'reject'                => 'Your request has been denied.',
            'conditionally_approve' => 'Your request has been conditionally approved.',
        ];

        $action      = $validated['action'];
        $commentBody = $validated['comment'] ?? null;

        $facilityRequests = FacilityRequest::whereIn('id', $validated['ids'])->get();

        foreach ($facilityRequests as $facilityRequest) {
            if ($action === 'approve') {
                $facilityRequest = $this->service->approve($facilityRequest->id);

                $body = $commentBody ?? (
                    $facilityRequest->on_hold
                    ? 'Request placed on hold due to a higher-priority conflict.'
                    : 'Your request has been approved.'
                );
            } elseif ($action !== 'comment') {
                $facilityRequest->update(['status' => $statusMap[$action]]);
                $facilityRequest->requestFacilities()->update(['status' => $statusMap[$action]]);
                $body = $commentBody ?? $defaultCommentMap[$action];
            } else {
                $body = $commentBody;
            }

            if ($body) {
                $facilityRequest->comments()->create([
                    'user_id' => auth()->id(),
                    'body'    => $body,
                ]);
            }

            $this->notification->notifyUser($facilityRequest);
        }

        return redirect()->back()->with('success', ucfirst(str_replace('_', ' ', $action)) . ' applied to ' . count($facilityRequests) . ' request(s).');
    }

    public function edit(FacilityRequest $request)
    {
        abort_if($request->user_id !== auth()->id(), 403);
        abort_if(!in_array($request->status, [RequestStatus::PENDING, RequestStatus::FOR_RESCHEDULE]), 403);

        return Inertia::render('requests/create', [
            'facilities' => Facility::with([
                'equipment' => fn($q) => $q->select('equipments.id', 'equipments.name', 'equipments.quantity')
                    ->orderBy('equipments.name')
            ])->select('id', 'name', 'capacity', 'building')->get(),
            'existingRequest'   => $this->service->getEditData($request->id),
        ]);
    }

    public function update(FacilityFormRequest $httpRequest, FacilityRequest $request)
    {
        abort_if($request->user_id !== auth()->id(), 403);
        abort_if(!in_array($request->status, [RequestStatus::PENDING, RequestStatus::FOR_RESCHEDULE]), 403);

        $validated = $httpRequest->validated();

        $updated = $this->service->update($validated, $request->id);

        ProcessRequestRecommendation::dispatch($updated, $validated['facility_bookings']);

        return redirect()->route('requests.detail', $request->id);
    }

    public function addComment(Request $request, int $id)
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ]);

        $facilityRequest = FacilityRequest::findOrFail($id);

        $facilityRequest->comments()->create([
            'user_id' => auth()->id(),
            'body'    => $validated['body'],
        ]);

        $this->auditLogger::commentAdded($facilityRequest, $validated['body']);

        return back()->with('success', 'Comment added.');
    }

    public function forReschedule(Request $request, $id)
    {
        $commentBody     = $request->input('comment', 'Your request has been marked for rescheduling.');
        $facilityRequest = FacilityRequest::findOrFail($id);

        $facilityRequest->update(['status' => RequestStatus::FOR_RESCHEDULE]);
        $facilityRequest->comments()->create([
            'body'    => $commentBody,
            'user_id' => auth()->id(),
        ]);

        $this->auditLogger::requestMarkedForReschedule($facilityRequest);
        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request marked for rescheduling.');
    }
}
