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

    public function detail(int $facility_id) {
        $facility = Facility::where("id", $facility_id)->firstOrFail();


        return Inertia::render("facilities/detail", ["facility" => $facility]);
    }
}
