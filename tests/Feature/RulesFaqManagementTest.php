<?php

namespace Tests\Feature;

use App\Models\Rule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class RulesFaqManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_faq_rule_requires_faq_answer(): void
    {
        $this->actingAsRulesAdmin();

        $response = $this->post(route('rules.add'), [
            'rule' => 'How do I create a booking request?',
            'forPolicy' => 1,
        ]);

        $response->assertSessionHasErrors(['faq_answer']);
        $this->assertDatabaseCount('rules', 0);
    }

    public function test_policy_rule_allows_null_faq_answer(): void
    {
        $this->actingAsRulesAdmin();

        $response = $this->post(route('rules.add'), [
            'rule' => 'Requests must be submitted at least two days before the event.',
            'forPolicy' => 0,
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('rules', [
            'rule' => 'Requests must be submitted at least two days before the event.',
            'forPolicy' => 0,
            'faq_answer' => null,
            'priority' => 0,
        ]);
    }

    public function test_reorder_is_constrained_within_the_same_type(): void
    {
        $this->actingAsRulesAdmin();

        $policyA = Rule::create([
            'rule' => 'Policy A',
            'priority' => 0,
            'forPolicy' => 0,
        ]);
        $policyB = Rule::create([
            'rule' => 'Policy B',
            'priority' => 1,
            'forPolicy' => 0,
        ]);
        $faqA = Rule::create([
            'rule' => 'FAQ A',
            'priority' => 0,
            'forPolicy' => 1,
            'faq_answer' => 'Answer A',
        ]);
        $faqB = Rule::create([
            'rule' => 'FAQ B',
            'priority' => 1,
            'forPolicy' => 1,
            'faq_answer' => 'Answer B',
        ]);

        $this->put(route('rules.reorder'), [
            'id' => $faqB->id,
            'direction' => 'up',
        ])->assertRedirect(route('rules'));

        $this->assertSame(0, (int) $faqB->fresh()->priority);
        $this->assertSame(1, (int) $faqA->fresh()->priority);
        $this->assertSame(0, (int) $policyA->fresh()->priority);
        $this->assertSame(1, (int) $policyB->fresh()->priority);
    }

    private function actingAsRulesAdmin(): User
    {
        Permission::findOrCreate('modify rules');

        $user = User::factory()->create();
        $user->givePermissionTo('modify rules');
        $this->actingAs($user);

        return $user;
    }
}
