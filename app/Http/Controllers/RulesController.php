<?php

namespace App\Http\Controllers;

use App\Models\Rule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RulesController extends Controller
{
    public function index()
    {
        return Inertia::render("rules/index", ["rules" => Rule::all()]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            "rule" => "string|required",
        ]);

        $rule = Rule::create([
            "rule" => $validated["rule"],
        ]);

        return redirect()->to("rules");
    }

    public function remove(Request $request)
    {
        $validated = $request->validate([
            "id" => "integer|required",
        ]);

        Rule::destroy($validated["id"]);


        return redirect()->to("rules");
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            "id" => "integer|required",
            "rule" => "string|required",
        ]);

        $rule = Rule::findOrFail($validated["id"]);
        $rule->update([
            "rule" => $validated["rule"],
        ]);

        return redirect()->route("rules");
    }
}
