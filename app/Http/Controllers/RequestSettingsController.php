<?php

namespace App\Http\Controllers;

use App\Enums\AuditEvent;
use App\Services\AuditLogger;
use App\Services\RequestSettingsService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RequestSettingsController extends Controller
{
    public function addApprover(Request $request)
    {
        $validated = $request->validate([
            'approver' => ['required', 'string', 'max:100'],
        ]);

        $settings = RequestSettingsService::all();
        $approvers = $settings['approvers'];

        if (in_array($validated['approver'], $approvers)) {
            return back()->withErrors(['approver' => 'Approver already exists.']);
        }

        $approvers[] = $validated['approver'];

        RequestSettingsService::update([
            'request.approvers' => array_values(array_unique($approvers)),
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request approver added.',
            properties: ['approver' => $validated['approver']],
        );

        return back()->with('success', 'Approver added.');
    }

    public function removeApprover(Request $request)
    {
        $validated = $request->validate([
            'approver' => ['required', 'string', 'max:100'],
        ]);

        $settings = RequestSettingsService::all();
        $approvers = $settings['approvers'];

        $approvers = array_values(array_filter($approvers, fn ($a) => $a !== $validated['approver']));

        RequestSettingsService::update([
            'request.approvers' => $approvers,
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request approver removed.',
            properties: ['approver' => $validated['approver']],
        );

        return back()->with('success', 'Approver removed.');
    }

    public function updateStartTime(Request $request)
    {
        $validated = $request->validate([
            'start_time' => ['required', 'date_format:H:i'],
        ]);

        $settings = RequestSettingsService::all();
        $bookingWindow = $settings['booking_window'];
        $bookingWindow['start_time'] = $validated['start_time'];

        RequestSettingsService::update([
            'request.booking_window' => $bookingWindow,
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request booking window start time updated.',
            properties: ['start_time' => $validated['start_time']],
        );

        return back()->with('success', 'Start time updated.');
    }

    public function updateEndTime(Request $request)
    {
        $validated = $request->validate([
            'end_time' => ['required', 'date_format:H:i'],
        ]);

        $settings = RequestSettingsService::all();
        $bookingWindow = $settings['booking_window'];

        if ($validated['end_time'] <= $bookingWindow['start_time']) {
            return back()->withErrors(['end_time' => 'End time must be after start time.']);
        }

        $bookingWindow['end_time'] = $validated['end_time'];

        RequestSettingsService::update([
            'request.booking_window' => $bookingWindow,
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request booking window end time updated.',
            properties: ['end_time' => $validated['end_time']],
        );

        return back()->with('success', 'End time updated.');
    }

    public function updateStepMinutes(Request $request)
    {
        $validated = $request->validate([
            'step_minutes' => ['required', 'integer', Rule::in([15, 30, 60])],
        ]);

        $settings = RequestSettingsService::all();
        $bookingWindow = $settings['booking_window'];
        $bookingWindow['step_minutes'] = $validated['step_minutes'];

        RequestSettingsService::update([
            'request.booking_window' => $bookingWindow,
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request booking window step minutes updated.',
            properties: ['step_minutes' => $validated['step_minutes']],
        );

        return back()->with('success', 'Time step updated.');
    }

    public function toggleDay(Request $request)
    {
        $validated = $request->validate([
            'day' => ['required', 'integer', 'between:0,6'],
        ]);

        $settings = RequestSettingsService::all();
        $daysOfWeek = $settings['booking_window']['days_of_week'];

        if (in_array($validated['day'], $daysOfWeek)) {
            $daysOfWeek = array_values(array_filter($daysOfWeek, fn ($d) => $d !== $validated['day']));
        } else {
            $daysOfWeek[] = $validated['day'];
            sort($daysOfWeek);
        }

        $bookingWindow = $settings['booking_window'];
        $bookingWindow['days_of_week'] = $daysOfWeek;

        RequestSettingsService::update([
            'request.booking_window' => $bookingWindow,
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request booking window day toggled.',
            properties: ['day' => $validated['day'], 'days_of_week' => $daysOfWeek],
        );

        return back()->with('success', 'Available days updated.');
    }

    public function updateMinAdvanceDays(Request $request)
    {
        $validated = $request->validate([
            'min_advance_days' => ['required', 'integer', 'min:0', 'max:365'],
        ]);

        RequestSettingsService::update([
            'request.min_advance_days' => $validated['min_advance_days'],
        ]);

        AuditLogger::log(
            event: AuditEvent::SettingsUpdated,
            description: 'Request minimum advance days updated.',
            properties: ['min_advance_days' => $validated['min_advance_days']],
        );

        return back()->with('success', 'Minimum advance days updated.');
    }
}
