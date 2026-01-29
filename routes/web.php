<?php

use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');



Route::prefix("/login")->group(function () {
    Route::get('/', [LoginController::class, 'show'])->name('login.show');

    Route::post('/', [LoginController::class, 'authenticate'])->name('login');
});

Route::get("/dashboard", function () {
    return Inertia::render("dashboard");
})->middleware("auth")->name('dashboard');
