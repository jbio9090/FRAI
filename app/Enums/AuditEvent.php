<?php

namespace App\Enums;

enum AuditEvent: string
{
    case AuthLogin = 'auth.login';
    case AuthLoginFailed = 'auth.login_failed';
    case AuthLogout = 'auth.logout';

    case RequestCreated = 'request.created';
    case RequestUpdated = 'request.updated';
    case RequestApproved = 'request.approved';
    case RequestDenied = 'request.denied';
    case RequestConditionallyApproved = 'request.conditionally_approved';
    case RequestMarkedForReschedule = 'request.marked_for_reschedule';
    case RequestRescheduleAlternativesChosen = 'request.reschedule_alternatives_chosen';

    case RequestHeld = 'request.held';
    case RequestCommentAdded = 'request.comment_added';
    case RequestFileUploaded = 'request.file_uploaded';
    case RequestFileRemoved = 'request.file_removed';

    case SettingsUpdated = 'settings.updated';

    case Unknown = 'unknown';

    case AuthPasswordResetInitiated = 'auth.password_reset_initiated';
    case AuthPasswordSelfUpdated = 'auth.password_self_updated';
    case AdminDemoted = 'admin.demoted';

    case RequestExpired = 'request.expired';
    case RequestFacilityExpired = 'request.facility_expired';

    /**
     * Events hidden from the dashboard Activity feed, charts, and breakdown.
     * Auth/system noise (logins, passwords, settings, role changes) and
     * granular request noise (edits, comments, file uploads/removals) are
     * excluded; only meaningful request lifecycle events stay visible.
     *
     * @return array<int, self>
     */
    public static function hiddenFromDashboard(): array
    {
        return [
            self::AuthLogin,
            self::AuthLoginFailed,
            self::AuthLogout,
            self::AuthPasswordResetInitiated,
            self::AuthPasswordSelfUpdated,
            self::AdminDemoted,
            self::SettingsUpdated,
            self::Unknown,
            self::RequestUpdated,
            self::RequestCommentAdded,
            self::RequestFileUploaded,
            self::RequestFileRemoved,
            self::RequestExpired,
            self::RequestFacilityExpired,
        ];
    }

    public function showOnDashboard(): bool
    {
        return ! in_array($this, self::hiddenFromDashboard(), true);
    }

    /**
     * Raw event values visible on the dashboard.
     *
     * @return array<int, string>
     */
    public static function dashboardValues(): array
    {
        return array_map(
            fn (self $case): string => $case->value,
            array_filter(self::cases(), fn (self $case): bool => $case->showOnDashboard())
        );
    }

    public function label(): string
    {
        return match ($this) {
            self::AuthLogin => 'Login',
            self::AuthLoginFailed => 'Failed Login',
            self::AuthLogout => 'Logout',
            self::RequestCreated => 'Request Created',
            self::RequestUpdated => 'Request Updated',
            self::RequestApproved => 'Request Approved',
            self::RequestDenied => 'Request Denied',
            self::RequestConditionallyApproved => 'Cond. Approved',
            self::RequestHeld => 'Request Held',
            self::RequestCommentAdded => 'Comment Added',
            self::RequestMarkedForReschedule => 'Marked Reschedule',
            self::RequestRescheduleAlternativesChosen => 'Reschedule Alternatives Chosen',
            self::RequestFileUploaded => 'File Uploaded',
            self::RequestFileRemoved => 'File Removed',
            self::AuthPasswordResetInitiated => 'Password Reset (Admin)',
            self::AuthPasswordSelfUpdated => 'Password Updated',
            self::AdminDemoted => 'Admin Demoted',
            self::SettingsUpdated => 'Settings Updated',
            self::Unknown => 'Unknown',
            self::RequestExpired => 'Request Expired',
            self::RequestFacilityExpired => 'Request Facility Expired',
        };
    }
}
