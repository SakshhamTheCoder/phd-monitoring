const express = require('express');
const router = express.Router();
const StatusChangeFormController = require('../../controllers/StatusChangeFormController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', StatusChangeFormController.listForm);
router.post('/', StatusChangeFormController.createForm);
router.post('/bulk', StatusChangeFormController.bulkSubmit); // form.bulk.create
router.get('/filters', StatusChangeFormController.listFilters);
router.get('/:form_id', StatusChangeFormController.loadForm); // form.load
router.post('/:form_id', StatusChangeFormController.submit); // form.submit

module.exports = router;

