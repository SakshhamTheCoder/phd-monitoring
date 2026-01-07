// Ported from Laravel's routes/base/departments.php
import { Router } from 'express';
// TODO: Import auth:sanctum middleware equivalent
// TODO: Import DepartmentController
const router = Router();

// All routes below should be protected by auth:sanctum middleware where specified
// TODO: Add auth middleware when implemented

router.get('/', (req, res) => {
    // TODO: DepartmentController.list
    res.status(501).json({ todo: 'DepartmentController.list' });
});
router.post('/add', (req, res) => {
    // TODO: DepartmentController.add
    res.status(501).json({ todo: 'DepartmentController.add' });
});
router.post('/specialization/add', (req, res) => {
    // TODO: DepartmentController.addBroadAreaSpecialization
    res.status(501).json({ todo: 'DepartmentController.addBroadAreaSpecialization' });
});
router.post('/area-of-specialization/add', (req, res) => {
    // TODO: DepartmentController.addAreaOfSpecialization
    res.status(501).json({ todo: 'DepartmentController.addAreaOfSpecialization' });
});
router.get('/area-of-specialization', (req, res) => {
    // TODO: DepartmentController.getAreasOfSpecialization
    res.status(501).json({ todo: 'DepartmentController.getAreasOfSpecialization' });
});
router.get('/area-of-specialization/list', (req, res) => {
    // TODO: DepartmentController.listAreasOfSpecialization
    res.status(501).json({ todo: 'DepartmentController.listAreasOfSpecialization' });
});
router.get('/area-of-specialization/filters', (req, res) => {
    // TODO: DepartmentController.listAreaFilters
    res.status(501).json({ todo: 'DepartmentController.listAreaFilters' });
});
router.put('/area-of-specialization/update/:id', (req, res) => {
    // TODO: DepartmentController.updateAreaOfSpecialization
    res.status(501).json({ todo: 'DepartmentController.updateAreaOfSpecialization' });
});
router.delete('/area-of-specialization/delete/:id', (req, res) => {
    // TODO: DepartmentController.deleteAreaOfSpecialization
    res.status(501).json({ todo: 'DepartmentController.deleteAreaOfSpecialization' });
});
router.post('/area-of-specialization/import', (req, res) => {
    // TODO: DepartmentController.importAreasFromCSV
    res.status(501).json({ todo: 'DepartmentController.importAreasFromCSV' });
});
router.post('/add-hod', (req, res) => {
    // TODO: DepartmentController.addHOD
    res.status(501).json({ todo: 'DepartmentController.addHOD' });
});
router.post('/add-adordc', (req, res) => {
    // TODO: DepartmentController.addAdordc
    res.status(501).json({ todo: 'DepartmentController.addAdordc' });
});
router.post('/add-coordinator', (req, res) => {
    // TODO: DepartmentController.addCoordinator
    res.status(501).json({ todo: 'DepartmentController.addCoordinator' });
});
router.delete('/remove-coordinator/:id', (req, res) => {
    // TODO: DepartmentController.removeCoordinator
    res.status(501).json({ todo: 'DepartmentController.removeCoordinator' });
});
router.post('/phd_coordinator', (req, res) => {
    // TODO: DepartmentController.addCoordinator
    res.status(501).json({ todo: 'DepartmentController.addCoordinator' });
});
router.get('/filters', (req, res) => {
    // TODO: DepartmentController.listFilters
    res.status(501).json({ todo: 'DepartmentController.listFilters' });
});

export default router;

