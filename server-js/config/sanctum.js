// Ported from Laravel's config/sanctum.php
export default {
    stateful: (process.env.SANCTUM_STATEFUL_DOMAINS || 'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1').split(
        ','
    ),
    guard: ['web'],
    expiration: null,
};

