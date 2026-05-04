<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\ChatbotLogController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\RulesController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/requests/{id}/email-action/{action}', [RequestController::class, 'handleSignedEmailAction'])
    ->middleware('signed')
    ->name('requests.email-action');

Route::post('/requests/{id}/push-action/{action}', [RequestController::class, 'handleSignedPushAction'])
    ->name('requests.push_action')
    ->middleware('signed');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth')->name('logout');

    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard/calendar', [DashboardController::class, 'calendarEvents'])->name('dashboard.calendar');
    Route::get('/dashboard/chart-data', [DashboardController::class, 'chartData'])->name('dashboard.chart-data');
    Route::get('/dashboard/audit-logs', [DashboardController::class, 'auditLogs']);

    Route::get('/requests/create', [RequestController::class, 'createPage'])->name('request.create');

    Route::get('/requests', [RequestController::class, 'index'])->name('requests.index');
    Route::get('/requests/{request_id}', [RequestController::class, 'detail'])->name('requests.detail');
    Route::get('/requests/{request}/edit', [RequestController::class, 'edit'])->name('requests.edit');
    Route::put('/requests/{request}', [RequestController::class, 'update'])->name('requests.update');
    Route::post('/requests', [RequestController::class, 'store'])->name('requests.store')->middleware(['throttle:60,1']);
    Route::post('requests/{id}/comment', [RequestController::class, 'addComment'])->name('requests.comment');
    Route::get('/requests/{id}/audit-logs', [RequestController::class, 'auditLogs']);

    // Admin only routes
    Route::middleware(['permission:approve requests'])->group(function () {
        Route::post('/requests/{id}/approve', [RequestController::class, 'approve'])->name('requests.approve');
        Route::post('/requests/{id}/reject', [RequestController::class, 'reject'])->name('requests.reject');
        Route::post('/requests/{id}/conditionally_approve', [RequestController::class, 'conditionally_approve'])->name('requests.conditionally_approve');
        Route::post('/requests/{id}/reschedule', [RequestController::class, 'forReschedule'])->name('requests.reschedule');
        Route::post('/requests/bulkAction', [RequestController::class, 'bulkAction'])->name('bulk.action');
        Route::post('/requests/{id}/hold', [RequestController::class, 'hold'])->name('requests.hold');
        Route::post('/requests/{id}/status', [RequestController::class, 'updateStatus'])->name('requests.updateStatus');

        Route::post('/requests/{request}/facilities/{facility}/update-status', [RequestController::class, 'updateFacilityStatus'])
            ->name('requests.facilities.updateStatus');
    });

    Route::get('/requests/{id}/recommendation', function ($id) {
        $request = \App\Models\Request::with('requestFacilities')->findOrFail($id);

        return response()->json([
            'recommended_action' => $request->getRawOriginal('recommended_action'),
            'recommended_action_reason' => $request->recommended_action_reason,
            'request_status' => $request->getRawOriginal('status'),
            'request_facilities' => $request->requestFacilities->map(fn ($rf) => [
                'id' => $rf->id,
                'facility_id' => $rf->facility_id,
                'status' => $rf->getRawOriginal('status'),
                'ai_recommended_status' => $rf->getRawOriginal('ai_recommended_status'),
                'ai_recommendation_reason' => $rf->ai_recommendation_reason,
            ]),
        ]);
    })->name('request.recommendation');

    Route::get('/rules', [RulesController::class, 'index'])->name('rules');

    // Admin lang po
    Route::middleware(['permission:modify rules'])->group(function () {
        Route::post('/rules/add', [RulesController::class, 'store'])->name('rules.add');
        Route::put('/rules/update', [RulesController::class, 'update'])->name('rules.update');
        Route::delete('/rules/remove/', [RulesController::class, 'remove'])->name('rules.remove');
        Route::put('/rules/reorder', [RulesController::class, 'reorder'])->name('rules.reorder');
    })->middleware(['throttle:60,1']);

    Route::get('/facilities', [FacilityController::class, 'index'])->name('facilities');
    Route::get('/facilities/{facility_id}', [FacilityController::class, 'detail'])->name('facility.detail');

    // JSON
    Route::get('/facilities/getSchedule/{facility}/{date}', [FacilityController::class, 'getDayScheduleJson'])->name('facility.schedule');
    Route::get('/facilities/getCalendarSchedule/{facility_id}', [FacilityController::class, 'getCalendarSchedule'])->name('facility.schedule.calendar');

    Route::get('/settings', [SettingsController::class, 'index'])->name('settings');
    Route::post('/settings/change-password', [SettingsController::class, 'changePassword'])->name('settings.change-password');

    Route::get('/equipments', [EquipmentController::class, 'index'])->name('equipments');
    Route::post('/equipment/check-conflicts', [EquipmentController::class, 'checkConflicts'])
        ->name('equipment.check-conflicts');
    Route::post('/equipment/availability', [EquipmentController::class, 'getAvailability'])
        ->name('equipment.availability');
    Route::middleware('permission:manage facilities')->group(function () {
        Route::post('/equipments', [EquipmentController::class, 'store'])->name('equipments.store');
        Route::put('/equipments/{equipment}', [EquipmentController::class, 'update'])->name('equipments.update');
        Route::delete('/equipments/{equipment}', [EquipmentController::class, 'destroy'])->name('equipments.destroy');
        Route::post('/equipments/{equipment}/sync-facilities', [EquipmentController::class, 'syncFacilities']);
    });

    Route::post('/settings/profile-picture', [SettingsController::class, 'updateProfilePicture'])->name('settings.profile-picture');
    Route::delete('/settings/profile-picture', [SettingsController::class, 'removeProfilePicture'])->name('settings.profile-picture.remove');

    Route::prefix('/push')->group(function () {
        Route::post('/subscribe', [NotificationController::class, 'subscribe'])->name('notification.subscribe');
        Route::post('/unsubscribe', [NotificationController::class, 'unsubscribe'])->name('notification.unsubscribe');
        Route::post('/send', [NotificationController::class, 'send'])->name('notification.send');
    });

    Route::middleware('permission:manage users')->group(function () {
        Route::get('/accounts', [AccountController::class, 'index'])->name('accounts.index');
        Route::post('/accounts/create', [AccountController::class, 'store'])->name('accounts.store');
        Route::put('/accounts/{user}', [AccountController::class, 'update'])->name('accounts.update');
        Route::delete('/accounts/{user}', [AccountController::class, 'destroy'])->name('accounts.destroy');
        Route::middleware(['auth'])->group(function () {
            Route::post('/accounts/{user}/reset-password', [\App\Http\Controllers\AccountController::class, 'resetPassword'])->name('accounts.reset-password');
        });
    });

    Route::get('/reset-required', [\App\Http\Controllers\ForcePasswordChangeController::class, 'edit'])->name('password.force.edit');
    Route::post('/reset-required', [\App\Http\Controllers\ForcePasswordChangeController::class, 'update'])->name('password.force.update');

    Route::middleware('permission:view chatbot logs')->group(function () {
        Route::get('/chatbot-logs', [ChatbotLogController::class, 'index'])->name('chatbot.logs.index');
    });

    Route::middleware('permission:manage facilities')->group(function () {
        Route::put('/facilities/{facility}', [FacilityController::class, 'update'])->name('facility.update');
        Route::post('/facilities', [FacilityController::class, 'store'])->name('facility.store');
        Route::delete('/facilities/{facility}', [FacilityController::class, 'destroy'])->name('facility.destroy');
    });
    // chatbot
    Route::get('/chatbot', function () {
        return Inertia::render('chatbot/chatbot');
    })->name('chatbot');
    Route::prefix('/chat')->group(function () {
        Route::post('/', [ChatController::class, 'chat'])->name('api.chat')->middleware(['throttle:60,1']);
        Route::get('/test', [ChatController::class, 'testCsrf'])->name('chat.test');
        Route::get('/models', [ChatController::class, 'models'])->name('chat.models');
        Route::get('/requests', [ChatController::class, 'latestRequests'])->name('chat.requests');
        Route::get('/rules', [ChatController::class, 'rulesList'])->name('chat.rules');
        Route::get('/facilities', [ChatController::class, 'facilitiesList'])->name('chat.facilities');
        Route::get('/equipment', [ChatController::class, 'equipmentList'])->name('chat.equipment');
        Route::post('/upload', [ChatController::class, 'uploadFile'])->name('chat.upload')->middleware(['throttle:60,1']);
        Route::post('/create-request', [ChatController::class, 'createRequestApi'])->name('api.db.create.request')->middleware(['throttle:10,1']);
        Route::post('/stream', [ChatController::class, 'stream'])->name('chat.stream')->middleware(['throttle:60,1']);
        Route::get('/session', [ChatController::class, 'getSession'])->name('chat.session.get');
        Route::delete('/session', [ChatController::class, 'newSession'])->name('chat.session.clear');
    });
});

Route::prefix('/login')->group(function () {
    Route::get('/', [LoginController::class, 'show'])->name('login.show');
    Route::post('/', [LoginController::class, 'authenticate'])->name('login');
})->middleware(['throttle:10,1', 'guest']);
