// Ported from Laravel's routes/base/approvals.php
import { Router } from 'express';
// TODO: Import Approval model and implement logic
const router = Router();

router.get('/:key', (req, res) => {
    // TODO: Find approval by key
    // TODO: Get action from req.query.action
    // TODO: If not found, return 404
    // TODO: Set approval.approved based on action
    // TODO: Save approval
    // TODO: Instantiate model from approval.model_type
    // TODO: If modelInstance.handleApproval exists, call it
    // TODO: Else, return error
    res.status(501).json({ todo: 'Approval key logic, model handleApproval' });
});

export default router;

