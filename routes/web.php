<?php

use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;


Route::middleware("auth")->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->middleware("auth")->name("logout");

    Route::get("/", function () {
        return Inertia::render("dashboard");
    })->name('dashboard');

    Route::get("/requests", function () {
        return Inertia::render("requests");
    })->name("requests");

    Route::get("/create-request", function () {
        return Inertia::render("request/create");
    })->name("request.create");
});

Route::prefix("/login")->group(function () {
    Route::get('/', [LoginController::class, 'show'])->name('login.show');
    Route::post('/', [LoginController::class, 'authenticate'])->name('login');
});
