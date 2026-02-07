import { Router } from 'express';
import * as ThesisSubmissionController from '../../app/Http/Controllers/ThesisSubmissionController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ThesisSubmissionController.listForm);
router.post('/', ThesisSubmissionController.createForm);
router.post('/bulk', ThesisSubmissionController.bulkSubmit);
router.get('/filters', ThesisSubmissionController.listFilters);
router.post('/:form_id/link', ThesisSubmissionController.linkPublication);
router.post('/:form_id/unlink', ThesisSubmissionController.unlinkPublication);
router.get('/:form_id', ThesisSubmissionController.loadForm);
router.post('/:form_id', ThesisSubmissionController.submit);

export default router;
