import { Router } from 'express';
import * as UserManagementController from '../../app/Http/Controllers/UserManagementController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', UserManagementController.list);
router.get('/filters', UserManagementController.listFilters);
router.post('/', UserManagementController.createOrUpdate);
router.get('/:id', UserManagementController.show);
router.delete('/:id', UserManagementController.remove);
router.post('/bulk-import', UserManagementController.bulkImport);
router.post('/:id/reset-password', UserManagementController.resetPassword);
router.post('/:id/send-reset-email', UserManagementController.sendResetEmail);

export default router;
