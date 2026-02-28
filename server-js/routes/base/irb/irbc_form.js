// Ported from Laravel's routes/base/irb/irbc_form.php
import { Router } from 'express';
import ConstituteOfIRBController from '../../app/Http/Controllers/ConstituteOfIRBController.js';
import authMiddleware from '../../../middleware/auth.middleware.js';

const router = Router();

// All routes protected by auth middleware
router.use(authMiddleware);

router.get('/', ConstituteOfIRBController.listForm);
router.post('/', ConstituteOfIRBController.createForm);
router.get('/filters', ConstituteOfIRBController.listFilters);
router.get('/:form_id', ConstituteOfIRBController.loadForm);
router.post('/:form_id', ConstituteOfIRBController.submit);

export default router;
