// Ported from Laravel's config/app.php
export default {
    name: process.env.APP_NAME || 'PHD Monitoring',
    env: process.env.APP_ENV || 'production',
    frontend_url: process.env.FRONTEND_URL || 'http://localhost:3000',
    debug: Boolean(process.env.APP_DEBUG) || false,
    url: process.env.APP_URL || 'http://localhost',
    timezone: process.env.APP_TIMEZONE || 'UTC',
    locale: process.env.APP_LOCALE || 'en',
    fallback_locale: process.env.APP_FALLBACK_LOCALE || 'en',
    faker_locale: process.env.APP_FAKER_LOCALE || 'en_US',
    cipher: 'AES-256-CBC',
    key: process.env.APP_KEY,
    previous_keys: (process.env.APP_PREVIOUS_KEYS || '').split(',').filter(Boolean),
    maintenance: {
        driver: process.env.APP_MAINTENANCE_DRIVER || 'file',
        store: process.env.APP_MAINTENANCE_STORE || 'database',
    },
};

