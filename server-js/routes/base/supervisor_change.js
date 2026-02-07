import { Router } from 'express';
import * as SupervisorChangeFormController from '../../app/Http/Controllers/SupervisorChangeFormController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', SupervisorChangeFormController.listForm);
router.post('/', SupervisorChangeFormController.createForm);
router.post('/bulk', SupervisorChangeFormController.bulkSubmit);
router.get('/filters', SupervisorChangeFormController.listFilters);
router.get('/:form_id', SupervisorChangeFormController.loadForm);
router.post('/:form_id', SupervisorChangeFormController.submit);

export default router;
