import { Router } from 'express';
import * as NotificationsController from '../../app/Http/Controllers/NotificationsController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationsController.allNotifications);
router.get('/unread', NotificationsController.unreadNotifications);
router.put('/mark-as-read/:id', NotificationsController.markAsRead);

export default router;
