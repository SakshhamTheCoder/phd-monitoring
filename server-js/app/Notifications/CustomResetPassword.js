import dotenv from 'dotenv';
dotenv.config();

class CustomResetPassword {
    constructor(token) {
        this.token = token;
    }

    /*
     * Get the notification's delivery channels.
     */
    via(notifiable) {
        return ['mail'];
    }

    /*
     * Build the reset URL.
     */
    resetUrl(notifiable) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return `${frontendUrl}/reset-password?token=${this.token}&email=${encodeURIComponent(notifiable.email)}`;
    }

    /*
     * Get the mail representation of the notification.
     */
    toMail(notifiable) {
        return {
            subject: 'Reset Your Password - PhD Portal',
            view: 'emails.reset_password',
            data: {
                user: notifiable,
                resetUrl: this.resetUrl(notifiable),
            }
        };
    }
}

export default CustomResetPassword;
