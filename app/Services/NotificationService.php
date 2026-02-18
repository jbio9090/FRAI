<?php

namespace App\Services;

use App\Models\Request;
use App\Models\User;
use App\Notifications\NewPendingRequest;
use App\Notifications\RequestResult;
use App\Notifications\RequestOnHold;
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


    /**
     * Notify the owner of a request that it has been put on hold,
     * and notify all admins about the override.
     */
    public function notifyOnHold(Request $heldRequest, Request $heldByRequest, string $reason)
    {
        try {
            // Notify the user whose request was put on hold
            $user = User::findOrFail($heldRequest->user_id);
            $user->notify(new RequestOnHold(
                $heldRequest->title,
                $heldByRequest->title,
                $reason,
                route("requests.detail", ["request_id" => $heldRequest->id]),
                false
            ));
        } catch (\Exception $e) {
            Log::error('On-hold user notification failed: ' . $e->getMessage());
        }

        try {
            // Notify all admins
            foreach (User::role("admin")->get() as $admin) {
                $admin->notify(new RequestOnHold(
                    $heldRequest->title,
                    $heldByRequest->title,
                    $reason,
                    route("requests.detail", ["request_id" => $heldRequest->id]),
                    true
                ));
            }
        } catch (\Exception $e) {
            Log::error('On-hold admin notification failed: ' . $e->getMessage());
        }
    }
}
