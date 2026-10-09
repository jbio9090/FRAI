<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Demo Account Seeds
    |--------------------------------------------------------------------------
    |
    | When enabled, the role and permission seeder also creates the demo
    | accounts (super admin, admin, and regular user) used for local
    | development. Leave this disabled on shared or production databases so
    | seeding never introduces accounts with known default passwords.
    |
    */

    'create_account_seeds' => (bool) env('CREATE_ACCOUNT_SEEDS', false),

];
