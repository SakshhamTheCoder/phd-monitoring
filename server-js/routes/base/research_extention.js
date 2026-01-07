const express = require('express');
const router = express.Router();
const ResearchExtentionController = require('../../controllers/ResearchExtentionController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', ResearchExtentionController.listForm);
router.post('/', ResearchExtentionController.createForm);
router.post('/bulk', ResearchExtentionController.bulkSubmit); // form.bulk.create
router.get('/filters', ResearchExtentionController.listFilters);
router.get('/:form_id', ResearchExtentionController.loadForm); // form.load
router.post('/:form_id', ResearchExtentionController.submit); // form.submit

module.exports = router;

