<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Enforce role backing records
    |--------------------------------------------------------------------------
    |
    | A role only works if the record behind it exists: a faculty row, a student
    | row, a phd_coordinators row, or the department hod_id / adordc_id pointing
    | at the user. When this is false the app only logs users acting in a role
    | with nothing behind it. When true they are refused instead.
    |
    | This defaults to false on purpose. Turning it on refuses requests, so any
    | legacy account holding a role it never had the data for stops working the
    | moment it deploys. Run `php artisan roles:audit --current-only` against the
    | real database first, fix or accept what it reports, then set
    | ROLE_BACKING_ENFORCE=true.
    |
    | Read through config rather than env() directly, since env() returns null
    | once config is cached.
    |
    */

    'enforce_backing' => env('ROLE_BACKING_ENFORCE', false),

];
