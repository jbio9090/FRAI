<?php

namespace App\Http\Controllers;

use App\Models\Rule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RulesController extends Controller
{
    public function index() {
        return Inertia::render("rules/index", ["rules" => Rule::all()]);
    }
}
