<?php

namespace App;

enum RequestStatus: string
{
    case PENDING = 'Pending';
    case APPROVED = 'Approved';
    case DENIED = 'Denied';
    case CONDITIONALLY_APPROVED = 'Conditionally Approved';
    case ON_HOLD = 'On Hold';
    case FOR_RESCHEDULE = "For Reschedule";
}
