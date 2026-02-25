<?php

namespace App\Http\Controllers;

use App\Http\Requests\FacilityFormRequest;
use Illuminate\Http\Request;
use App\Models\Request as FacilityRequest;
use Inertia\Inertia;
use Illuminate\Validation\ValidationException;
use App\Models\Facility;
use App\Models\User;
use App\RequestStatus;
use App\Services\RequestService;
use App\Notifications\NewPendingRequest;
use Illuminate\Support\Facades\Log;
use App\Services\NotificationService;


class RequestController extends Controller
{
    public function __construct(
        protected RequestService $service,
        protected NotificationService $notification,
    ) {}

    public function index()
    {
        $requests = $this->service->get(RequestStatus::PENDING);

        return Inertia::render('requests/index', [
            'requests'   => $requests,
            'page_title' => "Pending",
        ]);
    }


    public function approvedPage()
    {
        $requests = $this->service->get(RequestStatus::APPROVED);

        return Inertia::render('requests/index', [
            'requests'   => $requests,
            'page_title' => "Approved",
        ]);
    }

    public function deniedPage()
    {
        $requests = $this->service->get(RequestStatus::DENIED);

        return Inertia::render('requests/index', [
            'requests'   => $requests,
            'page_title' => "Denied",
        ]);
    }


    public function onHoldPage()
    {
        $requests = $this->service->getOnHold();

        return Inertia::render('requests/index', [
            'requests'   => $requests,
            'page_title' => "On Hold",
        ]);
    }

    // Admin-only: Approve request
    public function approve(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been approved");
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::APPROVED, "comment" => $comment]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    // Admin-only: Reject request
    public function reject(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been approved");
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::DENIED,  "comment" => $comment]);

        // If this request was holding others on hold, release them
        foreach ($facilityRequest->heldRequests as $heldRequest) {
            $this->service->releaseFromHold($heldRequest);
        }

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }

    // Admin laang
    public function conditionally_approve(Request $request, $id)
    {
        $comment = $request->input("comment", "Your request has been conditionally approved");
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::CONDITIONALLY_APPROVED,  "comment" => $comment]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request conditionally approved successfully');
    }


    public function createPage()
    {
        return Inertia::render("requests/create", [
            'facilities' => Facility::with('equipments')->get(),
        ]);
    }

    public function conditionallyApprovedPage()
    {
        $requests = $this->service->get(RequestStatus::CONDITIONALLY_APPROVED);

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Conditionally Approved",
        ]);
    }


    public function detail(int $request_id)
    {
        return Inertia::render("requests/detail", [
            'request' => $this->service->getDetail($request_id),
        ]);
    }

    /**
     * Store the form request to database.
     * If the new request has priority > 0, it will put conflicting lower-priority
     * requests on hold automatically.
     *
     * @param FacilityFormRequest
     * @return RedirectResponse
     */
    public function store(FacilityFormRequest $request)
    {
        $validated = $request->validated();
        $priorityLevel = $validated['priority_level'] ?? 0;

        // For normal-priority requests, check for conflicts as usual
        if ($priorityLevel === 0) {
            $conflicts = $this->service->checkForConflicts($validated['facility_bookings']);

            if (!empty($conflicts)) {
                throw ValidationException::withMessages([
                    'facility_bookings' => $conflicts
                ]);
            }
        }

        // Create the request
        $saved_request = $this->service->create($validated);

        // Notify admin of new pending request
        $this->notification->notifyAdmin($saved_request->title, $request->user()->name, $saved_request->id);

        // If this is a high-priority request, find and put conflicting lower-priority requests on hold
        if ($priorityLevel > 0) {
            $conflicting = $this->service->findConflictingLowerPriorityRequests(
                $validated['facility_bookings'],
                $priorityLevel
            );

            $priorityReason = $validated['priority_reason'] ?? 'Higher-priority event submitted for the same time slot.';

            foreach ($conflicting as $conflictingRequest) {
                $this->service->putOnHold($conflictingRequest, $saved_request, $priorityReason);
                $this->notification->notifyOnHold($conflictingRequest, $saved_request, $priorityReason);

                Log::info("Request #{$conflictingRequest->id} put on hold by high-priority request #{$saved_request->id}");
            }
        }

        $saved_request = $this->service->create($validated);

        $this->service->recommendAction($validated, $saved_request);

        $this->notification->notifyAdmin($saved_request->title, $request->user()->name, $saved_request->id);

        return redirect()->route('requests.index')->with('success', 'Request created successfully');
    }


    // RequestController.php

    public function bulkAction(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:requests,id'],
            'action' => ['required', 'string', 'in:approve,reject,conditionally_approve'],
            'comment' => ['nullable', 'string'],
        ]);

        $ids = $validated['ids'];
        $action = $validated['action'];
        $comment = $validated['comment'] ?? null;

        $statusMap = [
            'approve' => RequestStatus::APPROVED,
            'reject' => RequestStatus::DENIED,
            'conditionally_approve' => RequestStatus::CONDITIONALLY_APPROVED,
        ];

        $defaultCommentMap = [
            'approve' => 'Your request has been approved.',
            'reject' => 'Your request has been denied.',
            'conditionally_approve' => 'Your request has been conditionally approved.',
        ];

        $facilityRequests = FacilityRequest::whereIn('id', $ids)->get();

        foreach ($facilityRequests as $facilityRequest) {
            $facilityRequest->update([
                'status' => $statusMap[$action],
                'comment' => $comment ?? $defaultCommentMap[$action],
            ]);

            $this->notification->notifyUser($facilityRequest);
        }

        return redirect()->back()->with('success', ucfirst(str_replace('_', ' ', $action)) . ' applied to ' . count($facilityRequests) . ' request(s).');
    }
}
