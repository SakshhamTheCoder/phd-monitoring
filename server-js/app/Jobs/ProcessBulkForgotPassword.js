import crypto from 'crypto';
import User from '../Models/User.js';
import EmailService from '../Services/EmailService.js';

// Note: WelcomeResetPassword notification logic is not yet implemented/imported.
// Using console log to simulate email sending for now.

class ProcessBulkForgotPassword {
    constructor(emails) {
        this.emails = emails;
    }

    async process() {
        for (const email of this.emails) {
            try {
                const user = await User.findOne({ where: { email } });

                if (!user) {
                    console.log(`User not found: ${email}`);
                    continue;
                }

                // Generate a password reset token
                const token = crypto.randomBytes(32).toString('hex');
                const frontendUrl = process.env.FRONTEND_URL || 'https://phdportal.thapar.edu';
                const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

                // Send the welcome reset password email
                await EmailService.sendHtmlEmail(
                    email,
                    'Welcome to PhD Portal – Reset Your Password',
                    'welcome_reset',
                    {
                        user_name: `${user.first_name} ${user.last_name}`,
                        resetUrl: resetUrl,
                    }
                );

                console.log(`Reset link sent to: ${email}`);
            } catch (err) {
                console.error(`Failed to process ${email}:`, err.message);
            }
        }
    }
}

export default ProcessBulkForgotPassword;
