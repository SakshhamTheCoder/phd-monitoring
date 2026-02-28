// Ported from Laravel's routes/base/departments.php
import { Router } from 'express';
import * as DepartmentController from '../../app/Http/Controllers/DepartmentController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, DepartmentController.list);
router.post('/add', authMiddleware, DepartmentController.add);
router.post('/specialization/add', authMiddleware, DepartmentController.addBroadAreaSpecialization);
router.post('/area-of-specialization/add', authMiddleware, DepartmentController.addAreaOfSpecialization);
router.get('/area-of-specialization', authMiddleware, DepartmentController.getAreasOfSpecialization);
router.get('/area-of-specialization/list', authMiddleware, DepartmentController.listAreasOfSpecialization);
router.get('/area-of-specialization/filters', DepartmentController.listAreaFilters);
router.put('/area-of-specialization/update/:id', authMiddleware, DepartmentController.updateAreaOfSpecialization);
router.delete('/area-of-specialization/delete/:id', authMiddleware, DepartmentController.deleteAreaOfSpecialization);
router.post('/area-of-specialization/import', authMiddleware, DepartmentController.importAreasFromCSV);
router.post('/add-hod', authMiddleware, DepartmentController.addHOD);
router.post('/add-adordc', authMiddleware, DepartmentController.addAdordc);
router.post('/add-coordinator', authMiddleware, DepartmentController.addCoordinator);
router.delete('/remove-coordinator/:id', authMiddleware, DepartmentController.removeCoordinator);
router.post('/phd_coordinator', authMiddleware, DepartmentController.addCoordinator);
router.get('/filters', DepartmentController.listFilters);

export default router;
