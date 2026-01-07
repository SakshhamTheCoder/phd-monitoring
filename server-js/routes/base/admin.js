// Ported from Laravel's routes/base/admin.php

import { Router } from 'express';
const SupervisorController = require('../../controllers/SupervisorController');
const AdminFormController = require('../../controllers/AdminFormController');
const LogViewerController = require('../../controllers/LogViewerController');
// const authMiddleware = require('../../middleware/auth'); // Uncomment if/when implemented
const router = Router();

// All routes below should be protected by auth middleware if available
// router.use(authMiddleware);

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

module.exports = router;

