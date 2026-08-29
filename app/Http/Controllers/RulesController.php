<?php

namespace App\Http\Controllers;

use App\Jobs\IndexRuleEmbedding;
use App\Models\Rule;
use App\Services\RAG\RuleIndexingService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RulesController extends Controller
{
    public function __construct(protected RuleIndexingService $rule_index) {}

    public function index()
    {
        return Inertia::render('rules/index', [
            'policies' => Rule::policy()->orderBy('priority')->orderBy('id')->get(),
            'faqs' => Rule::faq()->orderBy('priority')->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'rule' => 'string|required',
            'forPolicy' => 'required|integer|in:0,1',
            'faq_answer' => 'nullable|string|required_if:forPolicy,1',
        ]);

        $forPolicy = (int) $validated['forPolicy'];
        $maxPriority = Rule::where('forPolicy', $forPolicy)->max('priority') ?? -1;
        $rule = Rule::create([
            'rule' => $validated['rule'],
            'priority' => $maxPriority + 1,
            'forPolicy' => $forPolicy,
            'faq_answer' => $forPolicy === 1 ? trim((string) $validated['faq_answer']) : null,
        ]);

        IndexRuleEmbedding::dispatch($rule);

        $this->normalizePriorities($forPolicy);

        return redirect()->route('rules');
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'id' => 'integer|required',
            'rule' => 'string|required',
            'forPolicy' => 'required|integer|in:0,1',
            'faq_answer' => 'nullable|string|required_if:forPolicy,1',
        ]);

        $rule = Rule::findOrFail($validated['id']);
        $previousForPolicy = (int) $rule->forPolicy;
        $nextForPolicy = (int) $validated['forPolicy'];

        $payload = [
            'rule' => $validated['rule'],
            'forPolicy' => $nextForPolicy,
            'faq_answer' => $nextForPolicy === 1 ? trim((string) $validated['faq_answer']) : null,
        ];

        if ($previousForPolicy !== $nextForPolicy) {
            $payload['priority'] = (Rule::where('forPolicy', $nextForPolicy)->max('priority') ?? -1) + 1;
        }

        $rule->update($payload);

        IndexRuleEmbedding::dispatch($rule);

        $this->normalizePriorities($previousForPolicy);
        if ($previousForPolicy !== $nextForPolicy) {
            $this->normalizePriorities($nextForPolicy);
        }

        return redirect()->route('rules');
    }

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'id' => 'integer|required',
            'direction' => 'string|required|in:up,down',
        ]);

        $rule = Rule::findOrFail($validated['id']);

        $neighbor = $validated['direction'] === 'up'
            ? Rule::where('forPolicy', $rule->forPolicy)->where('priority', '<', $rule->priority)->orderByDesc('priority')->first()
            : Rule::where('forPolicy', $rule->forPolicy)->where('priority', '>', $rule->priority)->orderBy('priority')->first();

        if (! $neighbor) {
            return redirect()->route('rules');
        }

        [$rule->priority, $neighbor->priority] = [$neighbor->priority, $rule->priority];
        $rule->save();
        $neighbor->save();
        $this->normalizePriorities((int) $rule->forPolicy);

        return redirect()->route('rules');
    }

    public function remove(Request $request)
    {
        $validated = $request->validate(['id' => 'integer|required']);
        $rule = Rule::findOrFail($validated['id']);
        $this->rule_index->deleteIndex($validated['id']);
        Rule::destroy($validated['id']);
        $this->normalizePriorities((int) $rule->forPolicy);

        return redirect()->route('rules');
    }

    private function normalizePriorities(int $forPolicy): void
    {
        Rule::where('forPolicy', $forPolicy)
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->values()
            ->each(function (Rule $rule, int $index) {
                if ((int) $rule->priority !== $index) {
                    $rule->update(['priority' => $index]);
                }
            });
    }
}
