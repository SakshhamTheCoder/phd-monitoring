// 1:1 JS replica of Laravel's config/session.php
import slugify from 'slugify';
export default {
    driver: process.env.SESSION_DRIVER || 'database',
    lifetime: process.env.SESSION_LIFETIME || 120,
    expire_on_close: process.env.SESSION_EXPIRE_ON_CLOSE || false,
    encrypt: process.env.SESSION_ENCRYPT || false,
    files: 'storage/framework/sessions',
    connection: process.env.SESSION_CONNECTION,
    table: process.env.SESSION_TABLE || 'sessions',
    store: process.env.SESSION_STORE,
    lottery: [2, 100],
    cookie:
        process.env.SESSION_COOKIE ||
        slugify(process.env.APP_NAME || 'laravel', { lower: true, replacement: '_' }) + '_session',
    path: process.env.SESSION_PATH || '/',
    domain: process.env.SESSION_DOMAIN,
    secure: process.env.SESSION_SECURE_COOKIE,
    http_only: process.env.SESSION_HTTP_ONLY || true,
    same_site: process.env.SESSION_SAME_SITE || 'lax',
    partitioned: process.env.SESSION_PARTITIONED_COOKIE || false,
};

