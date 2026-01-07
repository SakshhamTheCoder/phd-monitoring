// 1:1 JS replica of Laravel's config/filesystems.php
export default {
    default: process.env.FILESYSTEM_DISK || 'local',
    disks: {
        local: {
            driver: 'local',
            root: 'storage/app',
            throw: false,
        },
        public: {
            driver: 'local',
            root: 'storage/app/public',
            url: (process.env.APP_URL || '') + '/storage',
            visibility: 'public',
            throw: false,
        },
        s3: {
            driver: 's3',
            key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_DEFAULT_REGION,
            bucket: process.env.AWS_BUCKET,
            url: process.env.AWS_URL,
            endpoint: process.env.AWS_ENDPOINT,
            use_path_style_endpoint: process.env.AWS_USE_PATH_STYLE_ENDPOINT || false,
            throw: false,
        },
    },
    links: {
        'public/storage': 'storage/app/public',
    },
};

