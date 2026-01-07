const express = require('express');
const router = express.Router();
const SupervisorChangeFormController = require('../../controllers/SupervisorChangeFormController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', SupervisorChangeFormController.listForm);
router.post('/', SupervisorChangeFormController.createForm);
router.post('/bulk', SupervisorChangeFormController.bulkSubmit); // form.bulk.create
router.get('/filters', SupervisorChangeFormController.listFilters);
router.get('/:form_id', SupervisorChangeFormController.loadForm); // form.load
router.post('/:form_id', SupervisorChangeFormController.submit); // form.submit

module.exports = router;

