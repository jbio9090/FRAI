<?php

namespace App\Http\Controllers;

use App\Models\Request as FacilityRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use App\Models\Facility;
use App\RequestStatus;
use App\Models\RequestFacility;


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
        return Inertia::render("requests/create", [
            'facilities' => Facility::with('equipments')->get(),
        ]);
    }


    public function detail(int $request_id)
    {
        $r = FacilityRequest::with(["user", "facilities", "equipment", "requestFacilities"])->where("id", $request_id)->firstOrFail();

        return Inertia::render("requests/detail", [
            'request' => $r,
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
            'facility_bookings.*.equipment.*.equipment_id' => 'required|exists:equipments,id',
            'facility_bookings.*.equipment.*.quantity_needed' => 'required|integer|min:1',
        ]);

        // Check for conflicts with existing approved bookings
        $conflicts = $this->checkForConflicts($validated['facility_bookings']);

        if (!empty($conflicts)) {
            throw ValidationException::withMessages([
                'facility_bookings' => $conflicts
            ]);
        }

        // Create the request
        $facilityRequest = FacilityRequest::create([
            'user_id' => Auth::id(),
            'title' => $validated['title'],
            'description' => $validated['description'],
            'status' => RequestStatus::PENDING,
        ]);

        // Add facility bookings
        foreach ($validated['facility_bookings'] as $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');

            $facilityRequest->requestFacilities()->create([
                'facility_id' => $booking['facility_id'],
                'date_requested' => $dateOnly,
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

    /**
     * Check for time conflicts with existing approved bookings
     * 
     * @param array $bookings
     * @return array Array of conflict messages
     */
    private function checkForConflicts(array $bookings): array
    {
        $conflicts = [];

        foreach ($bookings as $index => $booking) {
            $dateOnly = Carbon::parse($booking['date'])->format('Y-m-d');
            $requestedStart = Carbon::parse($booking['time_start']);
            $requestedEnd = Carbon::parse($booking['time_end']);

            // Get all approved bookings for this facility on this date
            $existingBookings = RequestFacility::where('facility_id', $booking['facility_id'])
                ->where('date_requested', $dateOnly)
                ->whereHas('request', function ($query) {
                    $query->where('status', RequestStatus::APPROVED);
                })
                ->get();

            foreach ($existingBookings as $existing) {
                $existingStart = Carbon::parse($existing->time_start);
                $existingEnd = Carbon::parse($existing->time_end);

                // Check if times overlap
                if ($requestedStart->lt($existingEnd) && $requestedEnd->gt($existingStart)) {
                    $facility = Facility::find($booking['facility_id']);
                    $conflicts[] = sprintf(
                        'Time conflict for %s on %s: Your booking (%s - %s) overlaps with an existing approved booking (%s - %s)',
                        $facility->name ?? 'Unknown Facility',
                        Carbon::parse($dateOnly)->format('F j, Y'),
                        $requestedStart->format('g:i A'),
                        $requestedEnd->format('g:i A'),
                        $existingStart->format('g:i A'),
                        $existingEnd->format('g:i A')
                    );
                    break; // One conflict per booking is enough
                }
            }
        }

        return $conflicts;
    }
}
