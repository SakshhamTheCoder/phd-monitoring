import { Router } from 'express';
import * as OutsideExpertController from '../../app/Http/Controllers/OutsideExpertController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/list', OutsideExpertController.list);
router.get('/all', OutsideExpertController.all);
router.get('/filters', OutsideExpertController.listFilters);
router.post('/add', OutsideExpertController.add);
router.post('/bulk-import', OutsideExpertController.bulkImportFromCSV);
router.put('/update/:id', OutsideExpertController.update);
router.delete('/delete/:id', OutsideExpertController.remove);

export default router;
