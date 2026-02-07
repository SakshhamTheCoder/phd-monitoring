import { Router } from 'express';
import * as StatusChangeFormController from '../../app/Http/Controllers/StatusChangeFormController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', StatusChangeFormController.listForm);
router.post('/', StatusChangeFormController.createForm);
router.post('/bulk', StatusChangeFormController.bulkSubmit);
router.get('/filters', StatusChangeFormController.listFilters);
router.get('/:form_id', StatusChangeFormController.loadForm);
router.post('/:form_id', StatusChangeFormController.submit);

export default router;
