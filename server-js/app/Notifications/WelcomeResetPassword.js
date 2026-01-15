import dotenv from 'dotenv';
dotenv.config();

class WelcomeResetPassword {
    constructor(token, user) {
        this.token = token;
        this.user = user;
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
    resetUrl() {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return `${frontendUrl}/reset-password?token=${this.token}&email=${encodeURIComponent(this.user.email)}`;
    }

    /*
     * Get the mail representation of the notification.
     */
    toMail(notifiable) {
        return {
            subject: 'Welcome to PhD Portal – Reset Your Password',
            view: 'emails.welcome_reset',
            data: {
                user: this.user,
                resetUrl: this.resetUrl(),
            }
        };
    }
}

export default WelcomeResetPassword;
