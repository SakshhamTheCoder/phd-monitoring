import { Router } from 'express';
import * as SynopsisSubmissionController from '../../app/Http/Controllers/SynopsisSubmissionController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', SynopsisSubmissionController.listForm);
router.post('/', SynopsisSubmissionController.createForm);
router.post('/bulk', SynopsisSubmissionController.bulkSubmit);
router.get('/filters', SynopsisSubmissionController.listFilters);
router.post('/:form_id/link', SynopsisSubmissionController.linkPublication);
router.post('/:form_id/unlink', SynopsisSubmissionController.unlinkPublication);
router.get('/:form_id', SynopsisSubmissionController.loadForm);
router.post('/:form_id', SynopsisSubmissionController.submit);

export default router;
