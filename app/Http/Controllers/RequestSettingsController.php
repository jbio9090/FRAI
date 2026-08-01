<?php

namespace App\Http\Controllers;

use App\Enums\AuditEvent;
use App\Services\AuditLogger;
use App\Services\RequestSettingsService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class RequestSettingsController extends Controller
{
    public function index()
    {
        return Inertia::render('settings/request-options', [
            'settings' => RequestSettingsService::all(),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'approvers' => ['required', 'array', 'min:1', 'max:50'],
            'approvers.*' => ['required', 'string', 'max:100', 'distinct'],
            'booking_window.start_time' => ['required', 'date_format:H:i'],
            'booking_window.end_time' => ['required', 'date_format:H:i', 'after:booking_window.start_time'],
            'booking_window.days_of_week' => ['required', 'array', 'min:1'],
            'booking_window.days_of_week.*' => ['required', 'integer', 'between:0,6', 'distinct'],
            'booking_window.step_minutes' => ['required', 'integer', Rule::in([15, 30, 60])],
            'min_advance_days' => ['required', 'integer', 'min:0', 'max:365'],
        ]);

        RequestSettingsService::update([
            'request.approvers' => array_values(array_unique($validated['approvers'])),
            'request.booking_window' => $validated['booking_window'],
            'request.min_advance_days' => $validated['min_advance_days'],
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request options updated.',
            properties: $validated,
        );

        return back()->with('success', 'Request options saved.');
    }
}
