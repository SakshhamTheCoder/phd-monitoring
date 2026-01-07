// 1:1 JS replica of Laravel's config/auth.php
export default {
    defaults: {
        guard: process.env.AUTH_GUARD || 'web',
        passwords: process.env.AUTH_PASSWORD_BROKER || 'users',
    },
    guards: {
        web: {
            driver: 'session',
            provider: 'users',
        },
    },
    providers: {
        users: {
            driver: 'eloquent',
            model: process.env.AUTH_MODEL || 'App/Models/User',
        },
        // Uncomment below for database provider example
        // users: {
        //   driver: 'database',
        //   table: 'users',
        // },
    },
    passwords: {
        users: {
            provider: 'users',
            table: process.env.AUTH_PASSWORD_RESET_TOKEN_TABLE || 'password_reset_tokens',
            expire: 1440,
            throttle: 60,
        },
    },
    password_timeout: process.env.AUTH_PASSWORD_TIMEOUT || 10800,
};

