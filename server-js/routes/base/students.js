import { Router } from 'express';
import * as StudentController from '../../app/Http/Controllers/StudentController.js';
import * as UserController from '../../app/Http/Controllers/UserController.js';
import authMiddleware from '../../middleware/auth.middleware.js';
import formsRouter from './forms.js';

const router = Router();

router.get('/', authMiddleware, StudentController.list);
router.post('/add', authMiddleware, StudentController.add);
router.post('/bulk-upload', authMiddleware, StudentController.bulkUpload);
router.get('/filters', authMiddleware, StudentController.listFilters);

router.use('/:id', authMiddleware, (req, res, next) => {
    req.studentId = req.params.id;
    next();
});

router.get('/:id', authMiddleware, StudentController.get);
router.get('/:id/forms', authMiddleware, UserController.listForms);
router.use('/:id/forms', formsRouter);

export default router;
