<?php

namespace App;

enum RequestStatus: string
{
    case PENDING  = 'pending';
    case APPROVED = 'approved';
    case DENIED   = 'denied';
    case ON_HOLD  = 'on_hold';
}
