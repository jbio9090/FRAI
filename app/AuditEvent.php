<?php

namespace App;

enum AuditEvent: string
{
    case AuthLogin       = 'auth.login';
    case AuthLoginFailed = 'auth.login_failed';
    case AuthLogout      = 'auth.logout';

    case RequestCreated              = 'request.created';
    case RequestUpdated              = 'request.updated';
    case RequestApproved             = 'request.approved';
    case RequestDenied               = 'request.denied';
    case RequestConditionallyApproved = 'request.conditionally_approved';
    case RequestMarkedForReschedule = 'request.marked_for_reschedule';

    case RequestHeld                 = 'request.held';
    case RequestCommentAdded         = 'request.comment_added';
    case RequestFileUploaded = 'request.file_uploaded';
    case RequestFileRemoved  = 'request.file_removed';

    case AuthPasswordResetInitiated = 'auth.password_reset_initiated';
    case AuthPasswordSelfUpdated    = 'auth.password_self_updated';

    public function label(): string
    {
        return match ($this) {
            self::AuthLogin               => 'Login',
            self::AuthLoginFailed         => 'Failed Login',
            self::AuthLogout              => 'Logout',
            self::RequestCreated          => 'Request Created',
            self::RequestUpdated          => 'Request Updated',
            self::RequestApproved         => 'Request Approved',
            self::RequestDenied           => 'Request Denied',
            self::RequestConditionallyApproved => 'Cond. Approved',
            self::RequestHeld             => 'Request Held',
            self::RequestCommentAdded     => 'Comment Added',
            self::RequestMarkedForReschedule   => 'Marked Reschedule',
            self::RequestFileUploaded => 'File Uploaded',
            self::RequestFileRemoved  => 'File Removed',
            self::AuthPasswordResetInitiated => 'Password Reset (Admin)',
            self::AuthPasswordSelfUpdated    => 'Password Updated',
        };
    }
}
