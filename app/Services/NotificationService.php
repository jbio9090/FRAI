<?php

namespace App\Services;

use App\Models\Request;
use App\Models\User;
use App\Notifications\NewPendingRequest;
use App\Notifications\RequestResult;
use App\Notifications\Reschedule;
use App\RequestStatus;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function notifyAdmin(string $request_title, string $user_name, string $request_id)
    {
        try {
            foreach (User::role("admin")->get() as $user) {
                $user->notify(new NewPendingRequest(
                    $request_title,
                    $user_name,
                    route("requests.detail", [$request_id])
                ));
            }
        } catch (\Exception $e) {
            Log::error('Push notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }


    public function notifyUser(Request $request)
    {
        try {
            $user = User::findOrFail($request->user_id);
            $user->notify(new RequestResult(
                $request->title,
                $request->status,
                route("requests.detail", ["request_id" => $request->id])
            ));
        } catch (\Exception $e) {
            Log::error('Push notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }


    public function notifyUserForRequestReschedule(Request $request)
    {
        try {
            $user = User::findOrFail($request->user_id);

            $facilityNames = $request->facilities->pluck('name')->join(', ');
            $dates = $request->requestFacilities->pluck('date_requested')->join(', ');
            $times = $request->requestFacilities
                ->map(fn($rf) => Carbon::parse($rf->time_start)->format('g:i A') . ' - ' . Carbon::parse($rf->time_end)->format('g:i A'))
                ->join(', ');

            $user->notify(new Reschedule(
                $request->title,
                $request->status,
                $facilityNames,
                route('requests.detail', ['request_id' => $request->id]),
                $dates,
                $times,
            ));
        } catch (\Exception $e) {
            Log::error('Push notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }

    public function notifyOnHold(Request $targetRequest, Request $heldByRequest, string $reason): void
    {
        try {
            $user = User::findOrFail($targetRequest->user_id);

            // RequestResult already supports ON_HOLD status messaging.
            $user->notify(new RequestResult(
                $targetRequest->title,
                RequestStatus::ON_HOLD,
                route("requests.detail", ["request_id" => $targetRequest->id]),
            ));
        } catch (\Exception $e) {
            Log::error('On-hold notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }
}
