const express = require('express');
const router = express.Router();
const SupervisorAllocationController = require('../../controllers/SupervisorAllocationController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', SupervisorAllocationController.listForm);
router.post('/', SupervisorAllocationController.createForm);
router.post('/bulk', SupervisorAllocationController.bulkSubmit); // form.bulk.create
router.get('/filters', SupervisorAllocationController.listFilters);
router.get('/:form_id', SupervisorAllocationController.loadForm); // form.load
router.post('/:form_id', SupervisorAllocationController.submit); // form.submit

module.exports = router;

