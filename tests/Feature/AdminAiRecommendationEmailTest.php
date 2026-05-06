<?php

namespace Tests\Feature;

use App\Models\Request as FacilityRequest;
use App\Models\RequestFile;
use App\Models\User;
use App\Models\Facility;
use App\Jobs\ProcessRequestRecommendation;
use App\Notifications\AdminAiRecommendationReady;
use App\Notifications\RequestResult;
use App\Enums\RequestStatus;
use App\Services\NotificationService;
use App\Services\RAG\AIRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminAiRecommendationEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_ai_recommendation_email_is_sent_to_subscribed_valid_admin_emails(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'admin_email_notifications_enabled' => true,
        ]);
        $admin->assignRole('admin');

        $invalidAdmin = User::factory()->create([
            'email' => 'not-an-email',
            'admin_email_notifications_enabled' => true,
        ]);
        $invalidAdmin->assignRole('admin');

        $unsubscribedAdmin = User::factory()->create([
            'email' => 'unsubscribed@example.com',
            'admin_email_notifications_enabled' => false,
        ]);
        $unsubscribedAdmin->assignRole('admin');

        $requester = User::factory()->create();
        $facilityRequest = FacilityRequest::factory()->create([
            'user_id' => $requester->id,
            'status' => RequestStatus::PENDING,
            'recommended_action' => RequestStatus::APPROVED,
            'recommended_action_reason' => 'No conflicts found.',
        ]);

        app(NotificationService::class)->notifyAdminsAfterAiRecommendation($facilityRequest);

        Notification::assertSentTo($admin, AdminAiRecommendationReady::class);
        Notification::assertNotSentTo($invalidAdmin, AdminAiRecommendationReady::class);
        Notification::assertNotSentTo($unsubscribedAdmin, AdminAiRecommendationReady::class);
    }

    public function test_admin_ai_recommendation_email_is_not_sent_to_admins_by_default(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $admin->assignRole('admin');

        $requester = User::factory()->create();
        $facilityRequest = FacilityRequest::factory()->create([
            'user_id' => $requester->id,
            'status' => RequestStatus::PENDING,
            'recommended_action' => RequestStatus::APPROVED,
            'recommended_action_reason' => 'No conflicts found.',
        ]);

        app(NotificationService::class)->notifyAdminsAfterAiRecommendation($facilityRequest);

        Notification::assertNotSentTo($admin, AdminAiRecommendationReady::class);
    }

    public function test_recommendation_job_sends_admin_email_after_ai_recommendation_is_saved(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'admin_email_notifications_enabled' => true,
        ]);
        $admin->assignRole('admin');

        $requester = User::factory()->create();
        $facility = Facility::factory()->create();
        $facilityRequest = FacilityRequest::factory()->pending()->create([
            'user_id' => $requester->id,
            'recommended_action' => null,
            'recommended_action_reason' => null,
        ]);
        $requestFacility = $facilityRequest->requestFacilities()->create([
            'facility_id' => $facility->id,
            'date_requested' => now()->addDays(5)->toDateString(),
            'time_start' => '09:00:00',
            'time_end' => '11:00:00',
        ]);

        $this->mock(AIRecommendationService::class, function ($mock) use ($facilityRequest, $requestFacility) {
            $mock->shouldReceive('recommend')
                ->once()
                ->with(\Mockery::on(fn (FacilityRequest $request) => $request->id === $facilityRequest->id))
                ->andReturn([
                    $requestFacility->id => [
                        'status' => RequestStatus::APPROVED,
                        'reason' => 'No conflicts found.',
                    ],
                ]);
        });

        (new ProcessRequestRecommendation($facilityRequest))->handle(
            app(AIRecommendationService::class),
            app(NotificationService::class),
        );

        $this->assertDatabaseHas('request_facilities', [
            'id' => $requestFacility->id,
            'ai_recommended_status' => RequestStatus::APPROVED->value,
            'ai_recommendation_reason' => 'No conflicts found.',
        ]);
        $this->assertDatabaseHas('requests', [
            'id' => $facilityRequest->id,
            'recommended_action' => RequestStatus::APPROVED->value,
            'recommended_action_reason' => 'No conflicts found.',
        ]);
        Notification::assertSentTo($admin, AdminAiRecommendationReady::class);
    }

    public function test_request_form_submission_sends_admin_email_after_ai_recommendation_is_saved(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'admin_email_notifications_enabled' => true,
        ]);
        $admin->assignRole('admin');
        $user = User::factory()->create();
        $facility = Facility::factory()->create();

        $this->mockRecommendationService('Form path recommendation.');

        $this->actingAs($user)
            ->post(route('requests.store'), $this->requestPayload($facility))
            ->assertRedirect(route('requests.index', ['status' => 'pending']));

        $facilityRequest = FacilityRequest::latest('id')->firstOrFail();

        $this->assertSame(RequestStatus::APPROVED, $facilityRequest->fresh()->recommended_action);
        $this->assertSame('Form path recommendation.', $facilityRequest->fresh()->recommended_action_reason);
        Notification::assertSentTo($admin, AdminAiRecommendationReady::class);
    }

    public function test_chatbot_submission_sends_admin_email_after_ai_recommendation_is_saved(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'admin_email_notifications_enabled' => true,
        ]);
        $admin->assignRole('admin');
        $user = User::factory()->create();
        $facility = Facility::factory()->create();

        $this->mockRecommendationService('Chatbot path recommendation.');

        $response = $this->actingAs($user)
            ->postJson(route('api.db.create.request'), $this->requestPayload($facility));

        $response
            ->assertOk()
            ->assertJsonPath('success', true);

        $facilityRequest = FacilityRequest::findOrFail((int) $response->json('request_id'));

        $this->assertSame(RequestStatus::APPROVED, $facilityRequest->fresh()->recommended_action);
        $this->assertSame('Chatbot path recommendation.', $facilityRequest->fresh()->recommended_action_reason);
        Notification::assertSentTo($admin, AdminAiRecommendationReady::class);
    }

    public function test_admin_can_toggle_email_notification_subscription(): void
    {
        $this->setUpRoles();

        $admin = $this->adminUser();

        $this->actingAs($admin)
            ->post(route('settings.admin-email-notifications'), ['subscribed' => true])
            ->assertRedirect();

        $this->assertTrue($admin->fresh()->admin_email_notifications_enabled);

        $this->actingAs($admin)
            ->post(route('settings.admin-email-notifications'), ['subscribed' => false])
            ->assertRedirect();

        $this->assertFalse($admin->fresh()->admin_email_notifications_enabled);
    }

    public function test_non_admin_cannot_toggle_email_notification_subscription(): void
    {
        $this->setUpRoles();

        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('settings.admin-email-notifications'), ['subscribed' => true])
            ->assertForbidden();

        $this->assertFalse($user->fresh()->admin_email_notifications_enabled);
    }

    public function test_admin_ai_recommendation_email_contains_request_details_and_links(): void
    {
        $this->setUpRoles();

        $admin = User::factory()->create();
        $requester = User::factory()->create([
            'name' => 'Jane Requester',
            'email' => 'jane@example.com',
        ]);
        $facilityRequest = FacilityRequest::factory()->create([
            'user_id' => $requester->id,
            'title' => 'Foundation Day',
            'status' => RequestStatus::PENDING,
            'recommended_action' => RequestStatus::FOR_RESCHEDULE,
            'recommended_action_reason' => 'Time conflict with an approved request.',
        ]);
        $auditorium = Facility::factory()->create(['name' => 'Main Auditorium']);
        $gym = Facility::factory()->create(['name' => 'University Gym']);

        $facilityRequest->requestFacilities()->create([
            'facility_id' => $auditorium->id,
            'date_requested' => '2026-05-15',
            'time_start' => '09:00:00',
            'time_end' => '11:30:00',
        ]);
        $facilityRequest->requestFacilities()->create([
            'facility_id' => $gym->id,
            'date_requested' => '2026-05-16',
            'time_start' => '13:00:00',
            'time_end' => '15:00:00',
        ]);

        RequestFile::create([
            'request_id' => $facilityRequest->id,
            'path' => 'request-files/sample.pdf',
            'original_name' => 'sample.pdf',
            'mime_type' => 'application/pdf',
            'size' => 100,
        ]);

        $html = (string) (new AdminAiRecommendationReady($facilityRequest))->toMail($admin)->render();

        $this->assertStringContainsString('Foundation Day', $html);
        $this->assertStringContainsString('Jane Requester', $html);
        $this->assertStringContainsString('jane@example.com', $html);
        $this->assertStringContainsString('Attached file:', $html);
        $this->assertStringContainsString('Yes', $html);
        $this->assertStringContainsString('Booked facilities', $html);
        $this->assertStringContainsString('Main Auditorium', $html);
        $this->assertStringContainsString('May 15, 2026', $html);
        $this->assertStringContainsString('9:00 AM - 11:30 AM', $html);
        $this->assertStringContainsString('University Gym', $html);
        $this->assertStringContainsString('May 16, 2026', $html);
        $this->assertStringContainsString('1:00 PM - 3:00 PM', $html);
        $this->assertStringContainsString('For Reschedule', $html);
        $this->assertStringContainsString('Time conflict with an approved request.', $html);
        $this->assertStringContainsString('Approve', $html);
        $this->assertStringContainsString('Visit website', $html);
    }

    public function test_signed_approve_email_link_does_not_require_login(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = $this->adminUser();
        $facilityRequest = FacilityRequest::factory()->pending()->create();

        $this->get($this->signedEmailActionUrl($facilityRequest, 'approve', $admin))
            ->assertOk()
            ->assertSee('Request Approved');

        $this->assertSame(RequestStatus::APPROVED, $facilityRequest->fresh()->status);
    }

    public function test_signed_approve_email_link_approves_pending_request(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = $this->adminUser();
        $facilityRequest = FacilityRequest::factory()->pending()->create();

        $this->get($this->signedEmailActionUrl($facilityRequest, 'approve', $admin))
            ->assertOk()
            ->assertSee('Request Approved')
            ->assertSee('The request was approved successfully.');

        $facilityRequest->refresh();

        $this->assertSame(RequestStatus::APPROVED, $facilityRequest->status);
        $this->assertSame($admin->id, $facilityRequest->processed_by);
        $this->assertNotNull($facilityRequest->processed_at);
        $this->assertDatabaseHas('comments', [
            'request_id' => $facilityRequest->id,
            'user_id' => $admin->id,
            'body' => 'Approved from email notification.',
        ]);
        Notification::assertSentTo($facilityRequest->user, RequestResult::class);
    }

    public function test_signed_reschedule_email_link_marks_pending_request_for_reschedule(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = $this->adminUser();
        $facilityRequest = FacilityRequest::factory()->pending()->create();

        $this->get($this->signedEmailActionUrl($facilityRequest, 'for_reschedule', $admin))
            ->assertOk()
            ->assertSee('Request Marked For Reschedule')
            ->assertSee('The request was marked for rescheduling successfully.');

        $facilityRequest->refresh();

        $this->assertSame(RequestStatus::FOR_RESCHEDULE, $facilityRequest->status);
        $this->assertSame($admin->id, $facilityRequest->processed_by);
        $this->assertNotNull($facilityRequest->processed_at);
        $this->assertDatabaseHas('comments', [
            'request_id' => $facilityRequest->id,
            'user_id' => $admin->id,
            'body' => 'Marked for rescheduling from email notification.',
        ]);
        Notification::assertSentTo($facilityRequest->user, RequestResult::class);
    }

    public function test_expired_signed_email_link_is_rejected(): void
    {
        $this->setUpRoles();

        $admin = $this->adminUser();
        $facilityRequest = FacilityRequest::factory()->pending()->create();
        $url = $this->signedEmailActionUrl($facilityRequest, 'approve', $admin);

        Carbon::setTestNow(now()->addHours(7));

        $this->get($url)->assertForbidden();

        Carbon::setTestNow();
    }

    public function test_email_action_does_not_process_request_twice(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = $this->adminUser();
        $facilityRequest = FacilityRequest::factory()->approved()->create([
            'processed_by' => $admin->id,
            'processed_at' => now(),
        ]);

        $this->get($this->signedEmailActionUrl($facilityRequest, 'for_reschedule', $admin))
            ->assertOk()
            ->assertSee('Request Already Processed');

        $this->assertSame(RequestStatus::APPROVED, $facilityRequest->fresh()->status);
        Notification::assertNothingSent();
    }

    private function setUpRoles(): void
    {
        Permission::findOrCreate('approve requests');
        Role::findOrCreate('admin')->givePermissionTo('approve requests');
    }

    private function adminUser(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function signedEmailActionUrl(FacilityRequest $facilityRequest, string $action, User $admin): string
    {
        return URL::temporarySignedRoute(
            'requests.email-action',
            now()->addHours(6),
            [
                'id' => $facilityRequest->id,
                'action' => $action,
                'admin_id' => $admin->id,
            ],
        );
    }

    private function requestPayload(Facility $facility): array
    {
        return [
            'title' => 'AI Recommendation Email Regression',
            'description' => 'Verify queued recommendation email path.',
            'facility_bookings' => [[
                'facility_id' => $facility->id,
                'date' => now()->addDays(5)->toDateString(),
                'time_start' => '09:00',
                'time_end' => '11:00',
                'equipment' => [],
                'borrowed_equipment' => [],
                'external_equipment' => [],
            ]],
        ];
    }

    private function mockRecommendationService(string $reason): void
    {
        $this->mock(AIRecommendationService::class, function ($mock) use ($reason) {
            $mock->shouldReceive('recommend')
                ->once()
                ->andReturnUsing(function (FacilityRequest $request) use ($reason) {
                    $requestFacility = $request->requestFacilities()->firstOrFail();

                    return [
                        $requestFacility->id => [
                            'status' => RequestStatus::APPROVED,
                            'reason' => $reason,
                        ],
                    ];
                });
        });
    }
}
