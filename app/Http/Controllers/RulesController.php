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
        return Inertia::render("rules/index", [
            "rules" => Rule::orderBy('priority')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['rule' => 'string|required']);

        $maxPriority = Rule::max('priority') ?? -1;
        $rule = Rule::create([
            'rule'     => $validated['rule'],
            'priority' => $maxPriority + 1,
        ]);

        IndexRuleEmbedding::dispatch($rule);

        return redirect()->to('rules');
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'id'   => 'integer|required',
            'rule' => 'string|required',
        ]);

        $rule = Rule::findOrFail($validated['id']);
        $rule->update(['rule' => $validated['rule']]);

        IndexRuleEmbedding::dispatch($rule);

        return redirect()->route('rules');
    }

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'id'        => 'integer|required',
            'direction' => 'string|required|in:up,down',
        ]);

        $rule = Rule::findOrFail($validated['id']);

        $neighbor = $validated['direction'] === 'up'
            ? Rule::where('priority', '<', $rule->priority)->orderByDesc('priority')->first()
            : Rule::where('priority', '>', $rule->priority)->orderBy('priority')->first();

        if (!$neighbor) {
            return redirect()->route('rules');
        }

        [$rule->priority, $neighbor->priority] = [$neighbor->priority, $rule->priority];
        $rule->save();
        $neighbor->save();

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
