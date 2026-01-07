// 1:1 JS replica of Laravel's config/logging.php
export default {
    default: process.env.LOG_CHANNEL || 'stack',
    deprecations: {
        channel: process.env.LOG_DEPRECATIONS_CHANNEL || 'null',
        trace: process.env.LOG_DEPRECATIONS_TRACE || false,
    },
    channels: {
        stack: {
            driver: 'stack',
            channels: (process.env.LOG_STACK || 'single').split(','),
            ignore_exceptions: false,
        },
        single: {
            driver: 'single',
            path: 'storage/logs/laravel.log',
            level: process.env.LOG_LEVEL || 'debug',
            replace_placeholders: true,
        },
        daily: {
            driver: 'daily',
            path: 'storage/logs/laravel.log',
            level: process.env.LOG_LEVEL || 'debug',
            days: process.env.LOG_DAILY_DAYS || 14,
            replace_placeholders: true,
        },
        slack: {
            driver: 'slack',
            url: process.env.LOG_SLACK_WEBHOOK_URL,
            username: process.env.LOG_SLACK_USERNAME || 'Laravel Log',
            emoji: process.env.LOG_SLACK_EMOJI || ':boom:',
            level: process.env.LOG_LEVEL || 'critical',
            replace_placeholders: true,
        },
        papertrail: {
            driver: 'monolog',
            level: process.env.LOG_LEVEL || 'debug',
            handler: process.env.LOG_PAPERTRAIL_HANDLER || 'SyslogUdpHandler',
            handler_with: {
                host: process.env.PAPERTRAIL_URL,
                port: process.env.PAPERTRAIL_PORT,
                connectionString: `tls://${process.env.PAPERTRAIL_URL}:${process.env.PAPERTRAIL_PORT}`,
            },
            processors: ['PsrLogMessageProcessor'],
        },
        stderr: {
            driver: 'monolog',
            level: process.env.LOG_LEVEL || 'debug',
            handler: 'StreamHandler',
            formatter: process.env.LOG_STDERR_FORMATTER,
            with: {
                stream: 'php://stderr',
            },
            processors: ['PsrLogMessageProcessor'],
        },
        syslog: {
            driver: 'syslog',
            level: process.env.LOG_LEVEL || 'debug',
            facility: process.env.LOG_SYSLOG_FACILITY || 'LOG_USER',
            replace_placeholders: true,
        },
        errorlog: {
            driver: 'errorlog',
            level: process.env.LOG_LEVEL || 'debug',
            replace_placeholders: true,
        },
        null: {
            driver: 'monolog',
            handler: 'NullHandler',
        },
        emergency: {
            path: 'storage/logs/laravel.log',
        },
    },
};

