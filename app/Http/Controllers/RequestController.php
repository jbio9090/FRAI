<?php

namespace App\Http\Controllers;

use App\Models\Request as FacilityRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

use App\Models\Facility;
use App\RequestStatus;

class RequestController extends Controller
{
    // List requests - shows different data based on role
    public function index()
    {
        $user = Auth::user();

        // Admins see all requests, users see only their own
        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", RequestStatus::PENDING)->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", RequestStatus::PENDING)
            ->latest()
            ->get();

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Pending",
        ]);
    }


    public function approvedPage()
    {
        $user = Auth::user();

        // Admins see all requests, users see only their own
        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", RequestStatus::APPROVED)->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", RequestStatus::APPROVED)
            ->latest()
            ->get();

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Approved",
        ]);
    }


    public function deniedPage()
    {
        $user = Auth::user();

        // Admins see all requests, users see only their own
        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", RequestStatus::DENIED)->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", RequestStatus::DENIED)
            ->latest()
            ->get();

        return Inertia::render('requests/index', [
            'requests' => $requests,
            'page_title' => "Denied",
        ]);
    }
    // Admin-only: View pending requests
    public function pending()
    {
        // Check permission
        if (!Auth::user()->hasPermissionTo('approve requests')) {
            abort(403, 'Unauthorized');
        }

        $requests = FacilityRequest::with(['user', 'facilities', 'requestFacilities'])
            ->where('status', RequestStatus::PENDING)
            ->latest()
            ->get();

        return Inertia::render('Requests/Pending', [
            'requests' => $requests,
        ]);
    }

    // Admin-only: Approve request
    public function approve(Request $request, $id)
    {
        if (!Auth::user()->hasPermissionTo('approve requests')) {
            abort(403, 'Unauthorized');
        }

        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::APPROVED]);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    // Admin-only: Reject request
    public function reject(Request $request, $id)
    {
        if (!Auth::user()->hasPermissionTo('reject requests')) {
            abort(403, 'Unauthorized');
        }

        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => RequestStatus::DENIED]);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }


    public function createPage()
    {
        // dd(Facility::with('equipments')->get());

        return Inertia::render("requests/create", [
            'facilities' => Facility::with('equipments')->get(),
        ]);
    }

    // POST - actually sotring the fuckening data
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'string',
            'facility_bookings' => 'required|array|min:1',
            'facility_bookings.*.facility_id' => 'required|exists:facilities,id',
            'facility_bookings.*.date' => 'required|date',
            'facility_bookings.*.time_start' => 'required',
            'facility_bookings.*.time_end' => 'required',
            'facility_bookings.*.equipment' => 'array',
            'facility_bookings.*.equipment.*.equipment_id' => 'required|exists:equipment,id',
            'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
        ]);

        // Create the request
        $facilityRequest = FacilityRequest::create([
            'user_id' => Auth::id(),
            'title' => $validated['title'],
            'description' => $validated['description'],
            'status' => RequestStatus::PENDING,
        ]);

        // Add facility bookings
        foreach ($validated['facility_bookings'] as $booking) {
            $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $booking['date'],
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
            ]);

            // Add equipment if any
            if (!empty($booking['equipment'])) {
                foreach ($booking['equipment'] as $equipment) {
                    $facilityRequest->equipment()->attach($equipment['equipment_id'], [
                        'quantity_needed' => $equipment['quantity_needed']
                    ]);
                }
            }
        }

        return redirect()->route('requests.index')->with('success', 'Request created successfully');
    }
}
