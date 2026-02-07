import { Router } from 'express';
import * as SupervisorAllocationController from '../../app/Http/Controllers/SupervisorAllocationController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', SupervisorAllocationController.listForm);
router.post('/', SupervisorAllocationController.createForm);
router.post('/bulk', SupervisorAllocationController.bulkSubmit);
router.get('/filters', SupervisorAllocationController.listFilters);
router.get('/:form_id', SupervisorAllocationController.loadForm);
router.post('/:form_id', SupervisorAllocationController.submit);

export default router;
