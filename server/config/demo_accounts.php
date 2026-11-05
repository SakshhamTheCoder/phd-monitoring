<?php

return [
    // Accounts that exist in this database only for demonstration. They stay
    // visible but sink to the bottom of the student and faculty lists, so a
    // real scholar is never buried under them. Comma-separated emails in .env:
    //   DEMO_ACCOUNT_EMAILS=a@example.com,b@example.com
    'emails' => array_values(array_filter(array_map(
        fn ($email) => strtolower(trim($email)),
        explode(',', (string) env('DEMO_ACCOUNT_EMAILS', ''))
    ))),
];
