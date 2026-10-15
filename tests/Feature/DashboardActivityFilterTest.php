<?php

namespace Tests\Feature;

use App\Enums\AuditEvent;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardActivityFilterTest extends TestCase
{
    use RefreshDatabase;

    private function logFor(User $user, AuditEvent $event): AuditLog
    {
        return AuditLog::create([
            'user_id' => $user->id,
            'event' => $event,
            'description' => $event->value,
        ]);
    }

    public function test_audit_logs_feed_and_breakdown_exclude_hidden_events(): void
    {
        $user = User::factory()->create();

        $visible = $this->logFor($user, AuditEvent::RequestApproved);
        $this->logFor($user, AuditEvent::RequestCreated);
        $this->logFor($user, AuditEvent::AuthLogin);
        $this->logFor($user, AuditEvent::AuthLogout);
        $this->logFor($user, AuditEvent::RequestUpdated);
        $this->logFor($user, AuditEvent::RequestCommentAdded);
        $this->logFor($user, AuditEvent::RequestFileUploaded);
        $this->logFor($user, AuditEvent::RequestFileRemoved);
        $this->logFor($user, AuditEvent::SettingsUpdated);
        $this->logFor($user, AuditEvent::AuthPasswordResetInitiated);

        $response = $this->actingAs($user)->getJson('/dashboard/audit-logs');

        $response->assertOk();

        $events = collect($response->json('data'))->pluck('event');
        $this->assertContains(AuditEvent::RequestApproved->value, $events);
        $this->assertContains(AuditEvent::RequestCreated->value, $events);
        $this->assertNotContains(AuditEvent::AuthLogin->value, $events);
        $this->assertNotContains(AuditEvent::AuthLogout->value, $events);
        $this->assertNotContains(AuditEvent::RequestUpdated->value, $events);
        $this->assertNotContains(AuditEvent::RequestCommentAdded->value, $events);
        $this->assertNotContains(AuditEvent::RequestFileUploaded->value, $events);
        $this->assertNotContains(AuditEvent::RequestFileRemoved->value, $events);
        $this->assertNotContains(AuditEvent::SettingsUpdated->value, $events);

        $breakdownEvents = collect($response->json('breakdown'))->pluck('event');
        $this->assertContains(AuditEvent::RequestApproved->value, $breakdownEvents);
        $this->assertNotContains(AuditEvent::AuthLogin->value, $breakdownEvents);
        $this->assertNotContains(AuditEvent::RequestUpdated->value, $breakdownEvents);

        $this->assertSame(2, $response->json('total'));
        $this->assertTrue(
            collect($response->json('data'))->contains(fn ($row) => ($row['id'] ?? null) === $visible->id)
        );
    }

    public function test_chart_data_excludes_hidden_events(): void
    {
        $user = User::factory()->create();

        $this->logFor($user, AuditEvent::RequestDenied);
        $this->logFor($user, AuditEvent::AuthLogin);
        $this->logFor($user, AuditEvent::RequestFileRemoved);
        $this->logFor($user, AuditEvent::SettingsUpdated);

        $response = $this->actingAs($user)->getJson(route('dashboard.chart-data', ['range' => 'week']));

        $response->assertOk();
        $this->assertSame(1, collect($response->json())->sum('total'));
    }

    public function test_audit_events_dropdown_lists_only_visible_events(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->has('auditEvents', 7)
                ->where('auditEvents', fn ($events) => collect($events)->pluck('value')->doesntContain(AuditEvent::AuthLogin->value)
                    && collect($events)->pluck('value')->doesntContain(AuditEvent::RequestUpdated->value)
                    && collect($events)->pluck('value')->doesntContain(AuditEvent::RequestCommentAdded->value)
                    && collect($events)->pluck('value')->contains(AuditEvent::RequestApproved->value)
                )
            );
    }

    public function test_hidden_event_filter_falls_back_to_visible_logs_and_keeps_user_scope(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $this->logFor($user, AuditEvent::RequestHeld);
        $this->logFor($otherUser, AuditEvent::RequestHeld);
        $this->logFor($user, AuditEvent::AuthLogin);

        $response = $this->actingAs($user)->getJson('/dashboard/audit-logs?event='.AuditEvent::AuthLogin->value);

        $response->assertOk();
        $this->assertSame(1, $response->json('total'));
        $this->assertSame(AuditEvent::RequestHeld->value, $response->json('data.0.event'));
    }
}
