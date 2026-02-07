// Ported from Laravel's routes/base/admin.php

import { Router } from 'express';
import * as SupervisorController from '../../app/Http/Controllers/SupervisorController.js';
import * as AdminFormController from '../../app/Http/Controllers/AdminFormController.js';
import * as LogViewerController from '../../app/Http/Controllers/LogViewerController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

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

// Bulk forgot password (queue job)
router.post('/bulk-forgot-password', (req, res) => {
    // Implement queue job ProcessBulkForgotPassword if needed
    res.status(501).json({ todo: 'ProcessBulkForgotPassword queue job' });
});

// Log viewer
router.get('/logs', LogViewerController.fetchLogs);

export default router;
