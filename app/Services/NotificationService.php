<?php

namespace App\Services;

use App\Models\Request;
use App\Models\RequestFacility;
use App\Models\RequestRescheduleSuggestion;
use App\Models\User;
use App\Notifications\AdminAiRecommendationReady;
use App\Notifications\NewPendingRequest;
use App\Notifications\RequestResult;
use App\Notifications\Reschedule;
use App\Notifications\RequestFacilityDecision;
use App\Notifications\RescheduleAlternativesChosen;
use App\Enums\RequestStatus;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function notifyAdmin(string $request_title, string $user_name, string $request_id)
    {
        try {
            $facilityRequest = \App\Models\Request::find($request_id); // Get the request model[cite: 3]

            $admins = User::role(['admin', 'Super Admin'])->get();

            Log::notice('Queuing NewPendingRequest push notifications.', [
                'request_id' => $request_id,
                'admin_count' => $admins->count(),
                'recipient_ids' => $admins->pluck('id')->all(),
            ]);

            foreach ($admins as $user) {
                $user->notify(new NewPendingRequest(
                    $request_title,
                    $user_name,
                    route('requests.detail', [$request_id]),
                    $request_id,
                    $user->id, // Pass current admin ID for the signed URL
                    $facilityRequest->recommended_action // Pass the recommendation enum[cite: 3]
                ));
            }
        } catch (\Exception $e) {
            Log::error('Push notification failed: ' . $e->getMessage());
        }
    }

    public function notifyAdminsAfterAiRecommendation(Request $request): void
    {
        try {
            $request->loadMissing(['user', 'files']);

            User::role('admin')
                ->where('admin_email_notifications_enabled', true)
                ->whereNotNull('email')
                ->get()
                ->filter(fn(User $user) => filter_var($user->email, FILTER_VALIDATE_EMAIL))
                ->each(fn(User $user) => $user->notify(new AdminAiRecommendationReady($request)));
        } catch (\Exception $e) {
            Log::error('Admin AI recommendation email notification failed: ' . $e->getMessage());
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
                route('requests.detail', ['request_id' => $request->id])
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
                route('requests.detail', ['request_id' => $targetRequest->id]),
            ));
        } catch (\Exception $e) {
            Log::error('On-hold notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }

    public function notifyUserFacilityDecision(Request $request, RequestFacility $rf)
    {
        try {
            $user = User::findOrFail($request->user_id);

            $facilityName = $rf->facility?->name ?? '';
            $date = $rf->date_requested
                ? Carbon::parse($rf->date_requested)->format('F j, Y')
                : null;

            $timeStart = $rf->time_start
                ? Carbon::parse($rf->time_start)->format('g:i A')
                : null;

            $timeEnd = $rf->time_end
                ? Carbon::parse($rf->time_end)->format('g:i A')
                : null;

            Log::info('Dispatching facility-level notification', [
                'request_id' => $request->id,
                'rf_id' => $rf->id,
                'user_id' => $user->id,
                'status' => $rf->status instanceof \BackedEnum
                    ? $rf->status->value
                    : $rf->status,
            ]);

            $user->notify(new RequestFacilityDecision(
                $request->title,
                $facilityName,
                $rf->status,
                route('requests.detail', ['request_id' => $request->id]),
                $date,
                $timeStart,
                $timeEnd
            ));
        } catch (\Exception $e) {
            Log::error('Facility-level notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }

    public function notifyUserChosenAlternatives(Request $request): void
    {
        try {
            $request->loadMissing(['rescheduleSuggestions.chosenByAdmin']);

            $user = User::findOrFail($request->user_id);

            $alternatives = $request->rescheduleSuggestions
                ->groupBy('facility_id')
                ->map(function ($items, $facilityId) {
                    return [
                        'facility_id' => $facilityId,
                        'facility_name' => $items->first()->facility_name,
                        'options' => $items->map(function ($item) {
                            return [
                                'date' => $item->date->format('Y-m-d'),
                                'time_start' => $item->time_start->format('H:i'),
                                'time_end' => $item->time_end->format('H:i'),
                                'type' => $item->type,
                                'capacity_fit' => $item->capacity_fit,
                                'equipment_available' => $item->equipment_available,
                                'chosen_by' => $item->chosenByAdmin->name ?? 'Admin',
                            ];
                        })->values()->all(),
                    ];
                })->values()->all();

            $user->notify(new RescheduleAlternativesChosen(
                $request->title,
                $request->status,
                route('requests.detail', ['request_id' => $request->id]),
                $alternatives,
            ));
        } catch (\Exception $e) {
            Log::error('Chosen alternatives notification failed: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
        }
    }
}
