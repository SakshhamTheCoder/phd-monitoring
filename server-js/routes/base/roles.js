import { Router } from 'express';
import * as RolesController from '../../app/Http/Controllers/RolesController.js';
import { Role } from '../../app/Models/index.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/', async (req, res) => {
    const roles = await Role.findAll();
    res.status(200).json(roles);
});

router.post('/add', authMiddleware, RolesController.add);

export default router;
