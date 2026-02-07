import { Router } from 'express';
import * as SupervisorDoctoralChangeController from '../../app/Http/Controllers/SupervisorDoctoralChangeController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

// For HOD/PhD Coordinator to propose changes
router.post('/propose', SupervisorDoctoralChangeController.proposeChange);
// For DORDC to view all pending changes
router.get('/pending', SupervisorDoctoralChangeController.listPendingChanges);
// For viewing pending changes for a specific student
router.get('/student/:studentId/pending', SupervisorDoctoralChangeController.getStudentPendingChanges);
// For DORDC to approve/reject changes
router.put('/approve/:changeId', SupervisorDoctoralChangeController.approveChange);
router.put('/reject/:changeId', SupervisorDoctoralChangeController.rejectChange);

export default router;
