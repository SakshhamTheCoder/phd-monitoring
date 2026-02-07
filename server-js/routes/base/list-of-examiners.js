// Ported from Laravel's routes

import { Router } from 'express';
import * as ListOfExaminersController from '../../app/Http/Controllers/ListOfExaminersController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ListOfExaminersController.listForm);
router.post('/', ListOfExaminersController.createForm);
router.post('/bulk', ListOfExaminersController.bulkSubmit);
router.get('/filters', ListOfExaminersController.listFilters);
router.get('/:form_id', ListOfExaminersController.loadForm);
router.post('/:form_id', ListOfExaminersController.submit);

export default router;
