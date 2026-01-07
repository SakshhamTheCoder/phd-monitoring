const express = require('express');
const router = express.Router();
const NotificationsController = require('../../controllers/NotificationsController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', NotificationsController.allNotifications);
router.get('/unread', NotificationsController.unreadNotifications);
router.put('/mark-as-read/:id', NotificationsController.markAsRead);

module.exports = router;

