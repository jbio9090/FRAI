<?php

namespace Tests\Feature;

use App\Models\Request as FacilityRequest;
use App\Models\RequestFile;
use App\Models\User;
use App\Notifications\AdminAiRecommendationReady;
use App\Notifications\RequestResult;
use App\RequestStatus;
use App\Services\NotificationService;
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

    public function test_admin_ai_recommendation_email_is_sent_to_valid_admin_emails(): void
    {
        Notification::fake();
        $this->setUpRoles();

        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $admin->assignRole('admin');

        $invalidAdmin = User::factory()->create(['email' => 'not-an-email']);
        $invalidAdmin->assignRole('admin');

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
}
