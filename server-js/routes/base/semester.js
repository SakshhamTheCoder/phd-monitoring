import { Router } from 'express';
import * as SemesterController from '../../app/Http/Controllers/SemesterController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/recent', SemesterController.getRecent);
router.get('/:semester_id', SemesterController.getRecent);
router.post('/', SemesterController.create);

export default router;
