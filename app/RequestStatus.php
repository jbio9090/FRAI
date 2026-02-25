<?php

namespace App;

enum RequestStatus: string
{
    case ON_HOLD  = 'on_hold';
    case PENDING = 'Pending';
    case APPROVED = 'Approved';
    case DENIED = 'Denied';
    case CONDITIONALLY_APPROVED = 'Conditionally Approved';
}
