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


class RequestController extends Controller
{
    public function __construct(
        protected RequestService $service,
        protected NotificationService $notification,
    ) {}

    public function index(Request $request)
    {
        $status = $request->input('status');

        $requestStatus = $status
            ? collect(RequestStatus::cases())
            ->firstWhere(fn($case) => strtolower($case->name) === strtolower($status))
            : null;

        $requests = $this->service->get(
            $requestStatus,
            $request->input("filter", "this_week"),
            $request->input("search"),
            $request->input("sort"),
            $request->input("order", "asc"),
            $request->input("requester"),
            $request->input("facility"),
            $request->input("has_external_equipment"),
        );

        return Inertia::render('requests/index', [
            'requests'   => $requests,
            'page_title' => $requestStatus?->value ?? 'All Requests',
            'filters'    => [
                'status' => $status,
            ],
            'facilities' => Facility::select('id', 'name')->orderBy('name')->get(),
            'requesters' => User::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'action'  => ['required', 'in:approve,reject,conditionally_approve'],
            'comment' => ['nullable', 'string'],
        ]);

        $facilityRequest = FacilityRequest::findOrFail($id);

        $statusMap = [
            'approve'               => RequestStatus::APPROVED,
            'reject'                => RequestStatus::DENIED,
            'conditionally_approve' => RequestStatus::CONDITIONALLY_APPROVED,
        ];

        $defaultCommentMap = [
            'approve'               => 'Your request has been approved.',
            'reject'                => 'Your request has been denied.',
            'conditionally_approve' => 'Your request has been conditionally approved.',
        ];

        $action = $validated['action'];
        $comment = $validated['comment'] ?? $defaultCommentMap[$action];

        if ($action === 'approve') {
            $facilityRequest->update(['comment' => $comment]);
            $facilityRequest = $this->service->approve($id);
        } else {
            $facilityRequest->update([
                'status'  => $statusMap[$action],
                'comment' => $comment,
            ]);
        }

        $this->notification->notifyUser($facilityRequest);

        return back()->with('success', ucfirst(str_replace('_', ' ', $action)) . ' successful');
    }

    public function approve(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been approved");
        $facilityRequest = FacilityRequest::findOrFail($id);

        $facilityRequest->update(['comment' => $comment]);
        $facilityRequest = $this->service->approve($id);

        $this->notification->notifyUser($facilityRequest);

        $message = $facilityRequest->on_hold
            ? 'Request placed on hold due to a higher-priority conflict.'
            : 'Request approved successfully.';

        return redirect()->back()->with('success', $message);
    }

    public function reject(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been approved");
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::DENIED, "comment" => $comment]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }

    public function conditionally_approve(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been conditionally approved");
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::CONDITIONALLY_APPROVED, "comment" => $comment]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request conditionally approved successfully');
    }

    public function createPage()
    {
        return Inertia::render("requests/create", [
            // Each facility now carries its own equipment list via facility_equipment pivot
            'facilities' => Facility::with([
                'equipment' => fn($q) => $q->select('equipments.id', 'equipments.name', 'equipments.quantity')
                    ->orderBy('equipments.name')
            ])->select('id', 'name', 'capacity', 'building')->get(),
        ]);
    }

    public function detail(int $request_id)
    {
        $requestDetail = $this->service->getDetail($request_id);
        return Inertia::render("requests/detail", [
            'request'           => $requestDetail,
            'labeledBreadcrumb' => $requestDetail['title'],
        ]);
    }

    public function store(FacilityFormRequest $request)
    {
        $validated = $request->validated();

        $saved_request = $this->service->create($validated);

        $this->service->recommendAction($validated, $saved_request);

        $this->notification->notifyAdmin($saved_request->title, $request->user()->name, $saved_request->id);

        return redirect()->route('requests.index', ['status' => strtolower(RequestStatus::PENDING->name)])
            ->with('success', 'Request created successfully');
    }

    public function hold($id)
    {
        $facilityRequest = \App\Models\Request::findOrFail($id);

        $facilityRequest->on_hold = !$facilityRequest->on_hold;
        $facilityRequest->save();

        return back()->with('success', $facilityRequest->on_hold ? 'Request placed on hold.' : 'Request removed from hold.');
    }

    public function bulkAction(Request $request)
    {
        $validated = $request->validate([
            'ids'     => ['required', 'array', 'min:1'],
            'ids.*'   => ['integer', 'exists:requests,id'],
            'action'  => ['required', 'string', 'in:approve,reject,conditionally_approve'],
            'comment' => ['nullable', 'string'],
        ]);

        $ids     = $validated['ids'];
        $action  = $validated['action'];
        $comment = $validated['comment'] ?? null;

        $statusMap = [
            'approve'               => RequestStatus::APPROVED,
            'reject'                => RequestStatus::DENIED,
            'conditionally_approve' => RequestStatus::CONDITIONALLY_APPROVED,
        ];

        $defaultCommentMap = [
            'approve'               => 'Your request has been approved.',
            'reject'                => 'Your request has been denied.',
            'conditionally_approve' => 'Your request has been conditionally approved.',
        ];

        $facilityRequests = FacilityRequest::whereIn('id', $ids)->get();

        foreach ($facilityRequests as $facilityRequest) {
            $facilityRequest->update([
                'status'  => $statusMap[$action],
                'comment' => $comment ?? $defaultCommentMap[$action],
            ]);

            $this->notification->notifyUser($facilityRequest);
        }

        return redirect()->back()->with('success', ucfirst(str_replace('_', ' ', $action)) . ' applied to ' . count($facilityRequests) . ' request(s).');
    }

    public function edit(FacilityRequest $request)
    {
        abort_if($request->user_id !== auth()->id(), 403);
        abort_if($request->status !== RequestStatus::PENDING, 403);

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
        abort_if($request->status !== RequestStatus::PENDING, 403);

        $validated = $httpRequest->validated();

        $updated = $this->service->update($validated, $request->id);

        $this->service->recommendAction($validated, $updated);

        return redirect()->route('requests.detail', $request->id);
    }
}
