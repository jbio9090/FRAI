<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FacilityController extends Controller
{
    public function index()
    {
        return Inertia::render("facilities/index", ["facilities" => Facility::all()]);
    }
}
