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
}
