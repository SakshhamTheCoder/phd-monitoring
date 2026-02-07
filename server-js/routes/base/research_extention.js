import { Router } from 'express';
import * as ResearchExtentionController from '../../app/Http/Controllers/ResearchExtentionController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ResearchExtentionController.listForm);
router.post('/', ResearchExtentionController.createForm);
router.post('/bulk', ResearchExtentionController.bulkSubmit);
router.get('/filters', ResearchExtentionController.listFilters);
router.get('/:form_id', ResearchExtentionController.loadForm);
router.post('/:form_id', ResearchExtentionController.submit);

export default router;
