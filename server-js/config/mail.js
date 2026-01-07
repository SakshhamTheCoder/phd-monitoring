// 1:1 JS replica of Laravel's config/mail.php
export default {
    default: process.env.MAIL_MAILER || 'log',
    mailers: {
        smtp: {
            transport: 'smtp',
            url: process.env.MAIL_URL,
            host: process.env.MAIL_HOST || '127.0.0.1',
            port: process.env.MAIL_PORT || 2525,
            encryption: process.env.MAIL_ENCRYPTION || 'tls',
            username: process.env.MAIL_USERNAME,
            password: process.env.MAIL_PASSWORD,
            timeout: null,
            local_domain: process.env.MAIL_EHLO_DOMAIN,
        },
        ses: {
            transport: 'ses',
        },
        postmark: {
            transport: 'postmark',
            // message_stream_id: process.env.POSTMARK_MESSAGE_STREAM_ID,
            // client: { timeout: 5 },
        },
        sendmail: {
            transport: 'sendmail',
            path: process.env.MAIL_SENDMAIL_PATH || '/usr/sbin/sendmail -bs -i',
        },
        log: {
            transport: 'log',
            channel: process.env.MAIL_LOG_CHANNEL,
        },
        array: {
            transport: 'array',
        },
        failover: {
            transport: 'failover',
            mailers: ['smtp', 'log'],
        },
    },
    from: {
        address: process.env.MAIL_FROM_ADDRESS || 'hello@example.com',
        name: process.env.MAIL_FROM_NAME || 'Example',
    },
};

