// Ported from Laravel's routes/base/faculties.php
import { Router } from 'express';
import * as FacultyController from '../../app/Http/Controllers/FacultyController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, FacultyController.list);
router.post('/add', authMiddleware, FacultyController.add);
router.put('/update/:id', authMiddleware, FacultyController.update);
router.post('/bulk-import', authMiddleware, FacultyController.upload);
router.get('/upload-faculty', FacultyController.upload);
router.post('/upload-faculty', FacultyController.upload);
router.get('/filters', FacultyController.listFilters);

export default router;
