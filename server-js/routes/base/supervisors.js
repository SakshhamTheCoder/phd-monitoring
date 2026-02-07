import { Router } from 'express';
import * as SupervisorController from '../../app/Http/Controllers/SupervisorController.js';
import { Supervisor } from '../../app/Models/index.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', async (req, res) => {
    const supervisors = await Supervisor.findAll();
    res.status(200).json(supervisors);
});

router.post('/assign', authMiddleware, SupervisorController.assign);

export default router;
