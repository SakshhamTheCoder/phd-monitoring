// Ported from Laravel's config/services.php
export default {
    postmark: {
        token: process.env.POSTMARK_TOKEN,
    },
    ses: {
        key: process.env.AWS_ACCESS_KEY_ID,
        secret: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    },
    slack: {
        notifications: {
            bot_user_oauth_token: process.env.SLACK_BOT_USER_OAUTH_TOKEN,
            channel: process.env.SLACK_BOT_USER_DEFAULT_CHANNEL,
        },
    },
    cloudflare: {
        secret_key: process.env.CLOUDFLARE_SECRET_KEY,
    },
    google: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect: process.env.GOOGLE_REDIRECT_URI || process.env.APP_URL + '/api/google/callback',
    },
};

