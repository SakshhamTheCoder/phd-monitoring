const express = require('express');
const router = express.Router();
const UserManagementController = require('../../controllers/UserManagementController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', UserManagementController.list);
router.get('/filters', UserManagementController.listFilters);
router.post('/', UserManagementController.createOrUpdate);
router.get('/:id', UserManagementController.show);
router.delete('/:id', UserManagementController.delete);
router.post('/bulk-import', UserManagementController.bulkImport);
router.post('/:id/reset-password', UserManagementController.resetPassword);
router.post('/:id/send-reset-email', UserManagementController.sendResetEmail);

module.exports = router;

