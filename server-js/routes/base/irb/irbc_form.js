// Ported from Laravel's routes/base/irb/irbc_form.php
import { Router } from 'express';
// TODO: Import auth:sanctum middleware equivalent
// TODO: Import ConstituteOfIRBController
const router = Router();

// All routes below should be protected by auth:sanctum middleware
// TODO: Add auth middleware when implemented

router.get('/', (req, res) => {
    // TODO: ConstituteOfIRBController.listForm
    res.status(501).json({ todo: 'ConstituteOfIRBController.listForm' });
});
router.post('/', (req, res) => {
    // TODO: ConstituteOfIRBController.createForm
    res.status(501).json({ todo: 'ConstituteOfIRBController.createForm' });
});
router.get('/filters', (req, res) => {
    // TODO: ConstituteOfIRBController.listFilters
    res.status(501).json({ todo: 'ConstituteOfIRBController.listFilters' });
});
router.get('/:form_id', (req, res) => {
    // TODO: ConstituteOfIRBController.loadForm
    res.status(501).json({ todo: 'ConstituteOfIRBController.loadForm' });
});
router.post('/:form_id', (req, res) => {
    // TODO: ConstituteOfIRBController.submit
    res.status(501).json({ todo: 'ConstituteOfIRBController.submit' });
});

export default router;

