<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\User;
use App\Notifications\RequestResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotificationInboxTest extends TestCase
{
    use RefreshDatabase;

    public function test_notification_creates_database_inbox_item_without_push_subscription(): void
    {
        $user = User::factory()->create();

        $user->notifyNow(new RequestResult(
            'Auditorium Booking',
            RequestStatus::APPROVED,
            route('requests.detail', ['request_id' => 123]),
        ));

        $notification = $user->notifications()->first();

        $this->assertNotNull($notification);
        $this->assertSame('Auditorium Booking', $notification->data['title']);
        $this->assertSame('Your request has been approved!', $notification->data['body']);
        $this->assertSame(route('requests.detail', ['request_id' => 123]), $notification->data['url']);
        $this->assertSame('request_result', $notification->data['category']);
        $this->assertSame(RequestStatus::APPROVED->value, $notification->data['status']);
        $this->assertDatabaseCount('push_subscriptions', 0);
    }

    public function test_dashboard_only_shows_authenticated_users_notifications(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $user->notifyNow(new RequestResult(
            'Mine',
            RequestStatus::DENIED,
            route('requests.detail', ['request_id' => 10]),
        ));
        $otherUser->notifyNow(new RequestResult(
            'Someone Else',
            RequestStatus::APPROVED,
            route('requests.detail', ['request_id' => 11]),
        ));

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('auth.user.notification_unread_count', 1)
                ->has('notifications', 1)
                ->where('notifications.0.title', 'Mine')
            );
    }

    public function test_mark_read_only_marks_authenticated_users_notifications(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $user->notifyNow(new RequestResult(
            'Mine',
            RequestStatus::APPROVED,
            route('requests.detail', ['request_id' => 12]),
        ));
        $otherUser->notifyNow(new RequestResult(
            'Other',
            RequestStatus::APPROVED,
            route('requests.detail', ['request_id' => 13]),
        ));

        $this->actingAs($user)
            ->post(route('dashboard.notifications.mark-read'))
            ->assertOk()
            ->assertJson(['unread_count' => 0]);

        $this->assertSame(0, $user->fresh()->unreadNotifications()->count());
        $this->assertSame(1, $otherUser->fresh()->unreadNotifications()->count());
    }
}
