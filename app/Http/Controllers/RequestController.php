<?php

namespace App\Http\Controllers;

use App\Http\Requests\FacilityFormRequest;
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
    public function approve($id)
    {
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::APPROVED]);

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    // Admin-only: Reject request
    public function reject($id)
    {
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::DENIED]);

        // If this request was holding others on hold, release them
        foreach ($facilityRequest->heldRequests as $heldRequest) {
            $this->service->releaseFromHold($heldRequest);
        }

        $this->notification->notifyUser($facilityRequest);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }


    public function createPage()
    {
        return Inertia::render("requests/create", [
            'facilities' => Facility::with('equipments')->get(),
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

        $this->notification->notifyAdmin($saved_request->title, $request->user()->name, $saved_request->id);

        return redirect()->route('requests.index')->with('success', 'Request created successfully');
    }
}
