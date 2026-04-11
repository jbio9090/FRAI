<?php

namespace App\Http\Controllers;

use App\Models\Rule;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Services\RAG\RuleIndexingService;
use App\Jobs\IndexRuleEmbedding;


class RulesController extends Controller
{
    public function __construct(protected RuleIndexingService $rule_index) {}

    public function index()
    {
        return Inertia::render("rules/index", ["rules" => Rule::all()]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['rule' => 'string|required']);
        $rule = Rule::create(['rule' => $validated['rule']]);

        IndexRuleEmbedding::dispatch($rule);

        return redirect()->to('rules');
    }

    public function update(Request $request)
    {
        $validated = $request->validate(['id' => 'integer|required', 'rule' => 'string|required']);
        $rule = Rule::findOrFail($validated['id']);
        $rule->update(['rule' => $validated['rule']]);

        IndexRuleEmbedding::dispatch($rule);

        return redirect()->route('rules');
    }

    public function remove(Request $request)
    {
        $validated = $request->validate(['id' => 'integer|required']);
        $this->rule_index->deleteIndex($validated['id']);
        Rule::destroy($validated['id']);

        return redirect()->to('rules');
    }
}
