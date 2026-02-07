import { Router } from 'express';
import * as StudentSemesterOffFormController from '../../app/Http/Controllers/StudentSemesterOffFormController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', StudentSemesterOffFormController.listForm);
router.post('/', StudentSemesterOffFormController.createForm);
router.post('/bulk', StudentSemesterOffFormController.bulkSubmit);
router.get('/filters', StudentSemesterOffFormController.listFilters);
router.get('/:form_id', StudentSemesterOffFormController.loadForm);
router.post('/:form_id', StudentSemesterOffFormController.submit);

export default router;
