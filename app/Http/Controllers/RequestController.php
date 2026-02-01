<?php

namespace App\Http\Controllers;

use App\Models\Request as FacilityRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

use App\Models\Facility;

class RequestController extends Controller
{
    // List requests - shows different data based on role
    public function index()
    {
        $user = Auth::user();

        // Admins see all requests, users see only their own
        $requests = $user->hasRole('admin')
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", "pending")->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", "pending")
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
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", "approved")->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", "approved")
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
            ? FacilityRequest::with(['user', 'facilities', 'requestFacilities'])->where("status", "denied")->latest()->get()
            : FacilityRequest::with(["user", 'facilities', 'requestFacilities'])
            ->where('user_id', $user->id)
            ->where("status", "denied")
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
            ->where('status', 'pending')
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
        $facilityRequest->update(['status' => 'approved']);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    // Admin-only: Reject request
    public function reject(Request $request, $id)
    {
        if (!Auth::user()->hasPermissionTo('reject requests')) {
            abort(403, 'Unauthorized');
        }

        $facilityRequest = FacilityRequest::findOrFail($id);
        $facilityRequest->update(['status' => 'rejected']);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }


    public function createPage()
    {
        return Inertia::render("requests/create", [
            'facilities' => Facility::all()
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
        ]);

        // Create the request
        $facilityRequest = FacilityRequest::create([
            'user_id' => Auth::id(),
            'title' => $validated['title'],
            'description' => $validated['description'],
            'status' => 'pending',
        ]);

        // Add facility bookings
        foreach ($validated['facility_bookings'] as $booking) {
            $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $booking['date'],
                'time_start' => $booking['time_start'],
                'time_end' => $booking['time_end'],
            ]);
        }

        return redirect()->route('requests.index')->with('success', 'Request created successfully');
    }



}
