import { Router } from 'express';
import * as ThesisExtentionController from '../../app/Http/Controllers/ThesisExtentionController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ThesisExtentionController.listForm);
router.post('/', ThesisExtentionController.createForm);
router.post('/bulk', ThesisExtentionController.bulkSubmit);
router.get('/filters', ThesisExtentionController.listFilters);
router.get('/:form_id', ThesisExtentionController.loadForm);
router.post('/:form_id', ThesisExtentionController.submit);

export default router;
