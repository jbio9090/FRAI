<?php

use App\Http\Controllers\RequestController;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\RulesController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;


Route::middleware("auth")->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->middleware("auth")->name("logout");

    Route::get("/", function () {
        return Inertia::render("dashboard");
    })->name('dashboard');

    Route::get("/requests/create", [RequestController::class, "createPage"])->name("request.create");

    Route::get('/requests', function () { return redirect()->intended(route("requests.index"));})->name("requests");
    Route::get('/requests/pending', [RequestController::class, 'index'])->name('requests.index');
    Route::get('/requests/approved', [RequestController::class, 'approvedPage'])->name('requests.approved');
    Route::get('/requests/denied', [RequestController::class, 'deniedPage'])->name('requests.denied');
    Route::get('/request/{request_id}', [RequestController::class, 'detail'])->name('requests.detail');
    Route::post('/requests', [RequestController::class, 'store'])->name('requests.store')->middleware(["throttle:60,1"]);

    // Admin only routes
    Route::middleware(['permission:approve requests'])->group(function () {
        Route::post('/requests/{id}/approve', [RequestController::class, 'approve'])->name('requests.approve');
        Route::post('/requests/{id}/reject', [RequestController::class, 'reject'])->name('requests.reject');
    });


    Route::get('/rules', [RulesController::class, "index"])->name("rules");

    // Admin lang po
    Route::middleware(['permission:modify rules'])->group(function () {
        Route::post('/rules/add', [RulesController::class, 'store'])->name('rules.add');
        Route::put('/rules/update', [RulesController::class, 'update'])->name('rules.update');
        Route::delete('/rules/remove/', [RulesController::class, 'remove'])->name('rules.remove');
    })->middleware(["throttle:60,1"]);


    Route::get("/facilities", [FacilityController::class, "index"])->name("facilities");
    Route::get("/facilities/{facility_id}", [FacilityController::class, "detail"])->name("facility.detail");

    // JSon
    Route::get("/facilities/getSchedule/{facility}/{date}", [FacilityController::class, "getDaySchedule"])->name("facility.schedule");
    Route::get("/facilities/getCalendarSchedule/{facility_id}", [FacilityController::class, "getCalendarSchedule"])->name("facility.schedule.calendar");

    Route::get("/settings", [SettingsController::class, "index"])->name("settings");
});

Route::prefix("/login")->group(function () {
    Route::get('/', [LoginController::class, 'show'])->name('login.show');
    Route::post('/', [LoginController::class, 'authenticate'])->name('login');
})->middleware(["throttle:10,1", "guest"]);
