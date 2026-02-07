import { Router } from 'express';
import * as PublicationController from '../../app/Http/Controllers/PublicationController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authMiddleware, PublicationController.store);
router.get('/', authMiddleware, PublicationController.get);

export default router;
