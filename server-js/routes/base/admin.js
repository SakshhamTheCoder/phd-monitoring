// Ported from Laravel's routes/base/admin.php

import { Router } from 'express';
import * as SupervisorController from '../../app/Http/Controllers/SupervisorController.js';
import * as AdminFormController from '../../app/Http/Controllers/AdminFormController.js';
import * as LogViewerController from '../../app/Http/Controllers/LogViewerController.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import { User } from '../../app/Models/User.js';
import EmailService from '../../app/Services/EmailService.js';
import crypto from 'crypto';

const router = Router();

// All routes protected by auth middleware
router.use(authMiddleware);

// Supervisor assignment
router.post('/allot-supervisor', SupervisorController.assign);

// Doctoral assignment
router.post('/allot-doctoral', SupervisorController.assignDoctoral);

// Admin Form Management Routes
router.get('/forms/student/:student_id', AdminFormController.getStudentForms);
router.post('/forms/create', AdminFormController.createFormInstance);
router.post('/forms/update-control', AdminFormController.updateFormControl);
router.post('/forms/toggle-availability', AdminFormController.toggleFormAvailability);
router.post('/forms/update-stage', AdminFormController.updateGeneralFormStage);
router.post('/forms/disable', AdminFormController.disableForm);
router.delete('/forms/delete', AdminFormController.deleteFormInstance);

// Bulk forgot password
// PHP dispatches ProcessBulkForgotPassword job to queue; here we process async without blocking
router.post('/bulk-forgot-password', async (req, res) => {
    try {
        const emails = req.body.emails || [];

        console.log('Bulk reset requested for:', emails);

        // Process asynchronously (non-blocking) - equivalent to Laravel queue dispatch
        (async () => {
            for (const email of emails) {
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
                    console.error(`Failed to send reset to ${email}:`, err.message);
                }
            }
        })();

        return res.json({
            status: 'success',
            message: 'Reset links are being processed in the background.'
        });
    } catch (error) {
        console.error('Error in bulk forgot password:', error);
        return res.status(500).json({
            status: 'error',
            message: 'An error occurred: ' + error.message
        });
    }
});

// Log viewer
router.get('/logs', LogViewerController.fetchLogs);

export default router;
