// Ported from Laravel's routes/base/faculties.php
import { Router } from 'express';
// TODO: Import auth:sanctum middleware equivalent
// TODO: Import FacultyController
const router = Router();

// All routes below should be protected by auth:sanctum middleware where specified
// TODO: Add auth middleware when implemented

router.get('/', (req, res) => {
    // TODO: FacultyController.list
    res.status(501).json({ todo: 'FacultyController.list' });
});
router.post('/add', (req, res) => {
    // TODO: FacultyController.add
    res.status(501).json({ todo: 'FacultyController.add' });
});
router.put('/update/:id', (req, res) => {
    // TODO: FacultyController.update
    res.status(501).json({ todo: 'FacultyController.update' });
});
router.post('/bulk-import', (req, res) => {
    // TODO: FacultyController.upload
    res.status(501).json({ todo: 'FacultyController.upload' });
});
router.get('/upload-faculty', (req, res) => {
    // TODO: FacultyController.showUploadForm
    res.status(501).json({ todo: 'FacultyController.showUploadForm' });
});
router.post('/upload-faculty', (req, res) => {
    // TODO: FacultyController.upload
    res.status(501).json({ todo: 'FacultyController.upload' });
});
router.get('/filters', (req, res) => {
    // TODO: FacultyController.listFilters
    res.status(501).json({ todo: 'FacultyController.listFilters' });
});

export default router;

