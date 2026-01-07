// Ported from Laravel's routes/base/irb/irbs_form.php
import { Router } from 'express';
// TODO: Import auth:sanctum middleware equivalent
// TODO: Import IrbSubController
const router = Router();

// All routes below should be protected by auth:sanctum middleware
// TODO: Add auth middleware when implemented

router.get('/', (req, res) => {
    // TODO: IrbSubController.listForm
    res.status(501).json({ todo: 'IrbSubController.listForm' });
});
router.post('/', (req, res) => {
    // TODO: IrbSubController.createForm
    res.status(501).json({ todo: 'IrbSubController.createForm' });
});
router.get('/filters', (req, res) => {
    // TODO: IrbSubController.listFilters
    res.status(501).json({ todo: 'IrbSubController.listFilters' });
});
router.get('/:form_id', (req, res) => {
    // TODO: IrbSubController.loadForm
    res.status(501).json({ todo: 'IrbSubController.loadForm' });
});
router.post('/:form_id', (req, res) => {
    // TODO: IrbSubController.submit
    res.status(501).json({ todo: 'IrbSubController.submit' });
});

export default router;

