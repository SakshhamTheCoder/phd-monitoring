import dotenv from 'dotenv';

dotenv.config();

class CloudflareHelper {
    static async verifyCaptcha(token) {
        const secretKey = process.env.CLOUDFLARE_SECRET_KEY;

        if (!secretKey) {
            console.warn('Cloudflare secret key not configured');
            return false;
        }

        try {
            const formData = new URLSearchParams();
            formData.append('secret', secretKey);
            formData.append('response', token);

            const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result && result.success === true) {
                return true;
            }

            console.warn('Cloudflare captcha verification failed', { result });
            return false;
        } catch (e) {
            console.error('Cloudflare captcha verification error: ' + e.message);
            return false;
        }
    }
}

export default CloudflareHelper;
