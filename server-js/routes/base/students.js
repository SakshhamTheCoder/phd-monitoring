const express = require('express');
const router = express.Router();
const StudentController = require('../../controllers/StudentController');
const UserController = require('../../controllers/UserController');
const authMiddleware = require('../../middleware/auth');

router.get('/', authMiddleware, StudentController.list);
router.post('/add', authMiddleware, StudentController.add);
router.post('/bulk-upload', authMiddleware, StudentController.bulkUpload);
router.get('/filters', authMiddleware, StudentController.listFilters);

const formsRouter = require('./forms');

router.use('/:id', authMiddleware, (req, res, next) => {
    req.studentId = req.params.id;
    next();
});

router.get('/:id', authMiddleware, StudentController.get);
router.get('/:id/forms', authMiddleware, UserController.listForms);
router.use('/:id/forms', formsRouter);

module.exports = router;

