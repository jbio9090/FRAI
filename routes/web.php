<?php

use App\Http\Controllers\RequestController;
use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Facility;


Route::middleware("auth")->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->middleware("auth")->name("logout");

    Route::get("/", function () {
        return Inertia::render("dashboard");
    })->name('dashboard');

    Route::get("/create-request", [RequestController::class, "createPage"])->name("request.create");


    Route::get('/requests', [RequestController::class, 'index'])->name('requests.index');
    Route::get('/requests/approved', [RequestController::class, 'approvedPage'])->name('requests.approved');
    Route::get('/requests/denied', [RequestController::class, 'deniedPage'])->name('requests.denied');
    Route::get('/request/{request_id}', [RequestController::class, 'detail'])->name('requests.detail');
    Route::post('/requests', [RequestController::class, 'store'])->name('requests.store');

    // Admin only routes
    Route::middleware(['permission:approve requests'])->group(function () {
        Route::get('/requests/pending', [RequestController::class, 'pending'])->name('requests.pending');
        Route::post('/requests/{id}/approve', [RequestController::class, 'approve'])->name('requests.approve');
        Route::post('/requests/{id}/reject', [RequestController::class, 'reject'])->name('requests.reject');
    });
});

Route::prefix("/login")->group(function () {
    Route::get('/', [LoginController::class, 'show'])->name('login.show');
    Route::post('/', [LoginController::class, 'authenticate'])->name('login');
})->middleware(["throttle:10,1", "guest"]);
