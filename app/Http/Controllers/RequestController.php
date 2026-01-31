<?php

namespace App\Http\Controllers;

use App\Models\Request;
use Illuminate\Http\Request as HttpRequest;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class RequestController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        // Admin sees all pending requests, users see only their own
        $requests = $user->hasRole('admin')
            ? Request::with(['user', 'facilities', 'dates'])->get()
            : Request::with(['facilities', 'dates'])->where('user_id', $user->id)->get();

        return Inertia::render('Requests/Index', [
            'requests' => $requests,
        ]);
    }

    public function pending()
    {
        // Only admins can access this
        if (!Auth::user()->hasPermissionTo('approve requests')) {
            abort(403);
        }

        $requests = Request::with(['user', 'facilities', 'dates'])
            ->where('status', 'pending')
            ->get();

        return Inertia::render('Requests/Pending', [
            'requests' => $requests,
        ]);
    }

    public function approve(HttpRequest $request, $id)
    {
        // Check permission
        if (!Auth::user()->hasPermissionTo('approve requests')) {
            abort(403);
        }

        $facilityRequest = Request::findOrFail($id);
        $facilityRequest->update(['status' => 'approved']);

        return redirect()->back()->with('success', 'Request approved successfully');
    }

    public function reject(HttpRequest $request, $id)
    {
        // Check permission
        if (!Auth::user()->hasPermissionTo('reject requests')) {
            abort(403);
        }

        $facilityRequest = Request::findOrFail($id);
        $facilityRequest->update(['status' => 'rejected']);

        return redirect()->back()->with('success', 'Request rejected successfully');
    }
}
