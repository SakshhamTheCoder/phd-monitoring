const express = require('express');
const router = express.Router();
const StudentSemesterOffFormController = require('../../controllers/StudentSemesterOffFormController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', StudentSemesterOffFormController.listForm);
router.post('/', StudentSemesterOffFormController.createForm);
router.post('/bulk', StudentSemesterOffFormController.bulkSubmit); // form.bulk.create
router.get('/filters', StudentSemesterOffFormController.listFilters);
router.get('/:form_id', StudentSemesterOffFormController.loadForm); // form.load
router.post('/:form_id', StudentSemesterOffFormController.submit); // form.submit

module.exports = router;

