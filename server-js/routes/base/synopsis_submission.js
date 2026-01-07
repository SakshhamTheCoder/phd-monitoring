const express = require('express');
const router = express.Router();
const SynopsisSubmissionController = require('../../controllers/SynopsisSubmissionController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', SynopsisSubmissionController.listForm);
router.post('/', SynopsisSubmissionController.createForm);
router.post('/bulk', SynopsisSubmissionController.bulkSubmit); // form.bulk.create
router.get('/filters', SynopsisSubmissionController.listFilters);
router.post('/:form_id/link', SynopsisSubmissionController.linkPublication); // form.load
router.post('/:form_id/unlink', SynopsisSubmissionController.unlinkPublication); // form.load
router.get('/:form_id', SynopsisSubmissionController.loadForm); // form.load
router.post('/:form_id', SynopsisSubmissionController.submit); // form.submit

module.exports = router;

