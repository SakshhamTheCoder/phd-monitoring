import { Router } from 'express';
import * as PatentsController from '../../app/Http/Controllers/PatentsController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authMiddleware, PatentsController.store);

export default router;
