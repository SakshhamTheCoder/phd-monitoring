import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * EmailService - Handles sending and scheduling emails via Gmail SMTP
 * Ported from PHP Laravel's App\Services\EmailService
 */
class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD,
            },
        });
    }

    /**
     * Send an email with the specified template and data using Gmail SMTP
     * 
     * @param {string|string[]} to - Recipient email address(es)
     * @param {string} templateName - The name of the email template to use
     * @param {object} data - Data to pass to the email template
     * @param {boolean} scheduled - Whether the email should be scheduled
     * @param {string|null} scheduledTime - When to send the email (if scheduled), in format 'YYYY-MM-DD HH:mm:ss'
     * @param {string|null} subject - Optional email subject (overrides template default)
     * @param {string[]} attachments - Optional array of file paths to attach
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async sendEmail(
        to,
        templateName,
        data = {},
        scheduled = false,
        scheduledTime = null,
        subject = null,
        attachments = []
    ) {
        try {
            // Build the email content
            const emailContent = this.buildEmailContent(templateName, data, subject);

            // Prepare attachments
            const mailAttachments = attachments.map(filePath => ({
                path: filePath,
                filename: path.basename(filePath)
            }));

            const mailOptions = {
                from: `"${process.env.MAIL_FROM_NAME || 'PhD Monitoring'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject: emailContent.subject,
                html: emailContent.html,
                attachments: mailAttachments
            };

            // If scheduled, use setTimeout (in production, use a queue like Bull)
            if (scheduled && scheduledTime) {
                const sendAt = new Date(scheduledTime);
                const now = new Date();

                // Make sure the scheduled time is in the future
                if (sendAt <= now) {
                    console.error(`Cannot schedule email for past time: ${scheduledTime}`);
                    return false;
                }

                // Calculate the delay in milliseconds
                const delay = sendAt.getTime() - now.getTime();

                // Schedule the email
                setTimeout(async () => {
                    try {
                        await this.transporter.sendMail(mailOptions);
                        console.log(`Scheduled email sent to ${Array.isArray(to) ? to.join(', ') : to}`);
                    } catch (error) {
                        console.error('Failed to send scheduled email:', error.message);
                    }
                }, delay);

                console.log(`Email scheduled for ${scheduledTime} to ${Array.isArray(to) ? to.join(', ') : to}`);
                return true;
            }

            // Otherwise send immediately
            await this.transporter.sendMail(mailOptions);
            console.log(`Email sent immediately to ${Array.isArray(to) ? to.join(', ') : to}`);
            return true;
        } catch (error) {
            console.error('Failed to send/schedule email:', error.message);
            return false;
        }
    }

    /**
     * Send an HTML email directly (used by User.sendPasswordResetNotification)
     * 
     * @param {string} to - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} templateName - Template name
     * @param {object} data - Data to pass to template
     * @returns {Promise<boolean>}
     */
    async sendHtmlEmail(to, subject, templateName, data = {}) {
        return this.sendEmail(to, templateName, data, false, null, subject);
    }

    /**
     * Build email content from template
     * 
     * @param {string} templateName - Template name (e.g., 'welcome', 'password_reset')
     * @param {object} data - Data to interpolate into template
     * @param {string|null} subject - Optional subject override
     * @returns {{subject: string, html: string}}
     */
    buildEmailContent(templateName, data = {}, subject = null) {
        // Try to load template from resources/views/emails
        const templatePath = path.join(__dirname, '../../resources/views/emails', `${templateName}.html`);
        
        let html;
        let emailSubject = subject || 'New Notification';

        if (fs.existsSync(templatePath)) {
            html = fs.readFileSync(templatePath, 'utf8');
            
            // Simple template interpolation (replace {{variable}} with data.variable)
            Object.keys(data).forEach(key => {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                html = html.replace(regex, data[key] || '');
            });
        } else {
            // Fallback: Generate simple HTML from data
            html = this.generateDefaultTemplate(templateName, data);
        }

        return { subject: emailSubject, html };
    }

    /**
     * Generate a default HTML template when no template file exists
     * 
     * @param {string} templateName 
     * @param {object} data 
     * @returns {string}
     */
    generateDefaultTemplate(templateName, data) {
        const content = Object.entries(data)
            .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
            .join('\n');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4a5568; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f7fafc; }
        .footer { text-align: center; padding: 20px; color: #718096; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>PhD Monitoring System</h1>
        </div>
        <div class="content">
            <h2>${templateName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
            ${content}
        </div>
        <div class="footer">
            <p>This is an automated message from the PhD Monitoring System.</p>
        </div>
    </div>
</body>
</html>`;
    }
}

// Export singleton instance
export default new EmailService();
