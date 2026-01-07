// 1:1 JS replica of Laravel's config/database.php
import slugify from 'slugify';

export default {
    // Default Database Connection Name
    default: process.env.DB_CONNECTION || 'sqlite',

    // Database Connections
    connections: {
        sqlite: {
            driver: 'sqlite',
            url: process.env.DB_URL,
            database: process.env.DB_DATABASE || './database/database.sqlite',
            prefix: '',
            foreign_key_constraints: process.env.DB_FOREIGN_KEYS !== 'false',
        },
        mysql: {
            driver: 'mysql',
            url: process.env.DB_URL,
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || '3306',
            database: process.env.DB_DATABASE || 'laravel',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            unix_socket: process.env.DB_SOCKET || '',
            charset: process.env.DB_CHARSET || 'utf8mb4',
            collation: process.env.DB_COLLATION || 'utf8mb4_unicode_ci',
            prefix: '',
            prefix_indexes: true,
            strict: true,
            engine: null,
            options: {}, // SSL options can be added here if needed
        },
        mariadb: {
            driver: 'mariadb',
            url: process.env.DB_URL,
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || '3306',
            database: process.env.DB_DATABASE || 'laravel',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            unix_socket: process.env.DB_SOCKET || '',
            charset: process.env.DB_CHARSET || 'utf8mb4',
            collation: process.env.DB_COLLATION || 'utf8mb4_unicode_ci',
            prefix: '',
            prefix_indexes: true,
            strict: true,
            engine: null,
            options: {}, // SSL options can be added here if needed
        },
        pgsql: {
            driver: 'pgsql',
            url: process.env.DB_URL,
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || '5432',
            database: process.env.DB_DATABASE || 'laravel',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: process.env.DB_CHARSET || 'utf8',
            prefix: '',
            prefix_indexes: true,
            search_path: 'public',
            sslmode: 'prefer',
        },
        sqlsrv: {
            driver: 'sqlsrv',
            url: process.env.DB_URL,
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || '1433',
            database: process.env.DB_DATABASE || 'laravel',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: process.env.DB_CHARSET || 'utf8',
            prefix: '',
            prefix_indexes: true,
            // encrypt: process.env.DB_ENCRYPT || 'yes',
            // trust_server_certificate: process.env.DB_TRUST_SERVER_CERTIFICATE || 'false',
        },
    },

    // Migration Repository Table
    migrations: {
        table: 'migrations',
        update_date_on_publish: true,
    },

    // Redis Databases
    redis: {
        client: process.env.REDIS_CLIENT || 'phpredis',
        options: {
            cluster: process.env.REDIS_CLUSTER || 'redis',
            prefix: slugify(process.env.APP_NAME || 'laravel', { lower: true, replacement: '_' }) + '_database_',
        },
        default: {
            url: process.env.REDIS_URL,
            host: process.env.REDIS_HOST || '127.0.0.1',
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            port: process.env.REDIS_PORT || '6379',
            database: process.env.REDIS_DB || '0',
        },
        cache: {
            url: process.env.REDIS_URL,
            host: process.env.REDIS_HOST || '127.0.0.1',
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            port: process.env.REDIS_PORT || '6379',
            database: process.env.REDIS_CACHE_DB || '1',
        },
    },
};

