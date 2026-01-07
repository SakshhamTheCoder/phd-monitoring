// 1:1 JS replica of Laravel's config/queue.php
export default {
    default: process.env.QUEUE_CONNECTION || 'database',
    connections: {
        sync: {
            driver: 'sync',
        },
        database: {
            driver: 'database',
            connection: process.env.DB_QUEUE_CONNECTION,
            table: process.env.DB_QUEUE_TABLE || 'jobs',
            queue: process.env.DB_QUEUE || 'default',
            retry_after: Number(process.env.DB_QUEUE_RETRY_AFTER) || 90,
            after_commit: false,
        },
        beanstalkd: {
            driver: 'beanstalkd',
            host: process.env.BEANSTALKD_QUEUE_HOST || 'localhost',
            queue: process.env.BEANSTALKD_QUEUE || 'default',
            retry_after: Number(process.env.BEANSTALKD_QUEUE_RETRY_AFTER) || 90,
            block_for: 0,
            after_commit: false,
        },
        sqs: {
            driver: 'sqs',
            key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY,
            prefix: process.env.SQS_PREFIX || 'https://sqs.us-east-1.amazonaws.com/your-account-id',
            queue: process.env.SQS_QUEUE || 'default',
            suffix: process.env.SQS_SUFFIX,
            region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
            after_commit: false,
        },
        redis: {
            driver: 'redis',
            connection: process.env.REDIS_QUEUE_CONNECTION || 'default',
            queue: process.env.REDIS_QUEUE || 'default',
            retry_after: Number(process.env.REDIS_QUEUE_RETRY_AFTER) || 90,
            block_for: null,
            after_commit: false,
        },
    },
    batching: {
        database: process.env.DB_CONNECTION || 'sqlite',
        table: 'job_batches',
    },
    failed: {
        driver: process.env.QUEUE_FAILED_DRIVER || 'database-uuids',
        database: process.env.DB_CONNECTION || 'sqlite',
        table: 'failed_jobs',
    },
};

