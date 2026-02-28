// Ported from Laravel's routes/base/irb/irbs_form.php
import { Router } from 'express';
import IrbSubController from '../../app/Http/Controllers/IrbSubController.js';
import authMiddleware from '../../../middleware/auth.middleware.js';

const router = Router();

// All routes protected by auth middleware
router.use(authMiddleware);

router.get('/', IrbSubController.listForm);
router.post('/', IrbSubController.createForm);
router.get('/filters', IrbSubController.listFilters);
router.get('/:form_id', IrbSubController.loadForm);
router.post('/:form_id', IrbSubController.submit);

export default router;
