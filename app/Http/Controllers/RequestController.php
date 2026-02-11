<?php

namespace App\Http\Controllers;

use App\Http\Requests\FacilityFormRequest;
use App\Models\Request as FacilityRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use App\Models\Facility;
use App\RequestStatus;
use App\Models\RequestFacility;
use App\Services\RequestService;


class RequestController extends Controller
{
    public function __construct(
        protected RequestService $service
    ) {}

    public function index()
    {
        $requests = $this->service->get(RequestStatus::PENDING);

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Pending",
        ]);
    }


    public function approvedPage()
    {
        $requests = $this->service->get(RequestStatus::APPROVED);

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Pending",
        ]);
    }


    public function deniedPage()
    {
        $requests = $this->service->get(RequestStatus::DENIED);

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Pending",
        ]);
    }

    // Admin-only: Approve request
    public function approve($id)
    {
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::APPROVED]);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    // Admin-only: Reject request
    public function reject($id)
    {
        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::DENIED]);

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
     * Store the form request to database
     * 
     * @param FacilityFormRequest
     * @return RedirectResponse
     */
    public function store(FacilityFormRequest $request)
    {
        $validated = $request->validated();

        // Check for conflicts with existing approved bookings
        $conflicts = $this->service->checkForConflicts($validated['facility_bookings']);

        if (!empty($conflicts)) {
            throw ValidationException::withMessages([
                'facility_bookings' => $conflicts
            ]);
        }

        $this->service->create($validated);

        return redirect()->route('requests.index')->with('success', 'Request created successfully');
    }
}
