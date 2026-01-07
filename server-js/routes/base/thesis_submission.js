const express = require('express');
const router = express.Router();
const ThesisSubmissionController = require('../../controllers/ThesisSubmissionController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', ThesisSubmissionController.listForm);
router.post('/', ThesisSubmissionController.createForm);
router.post('/bulk', ThesisSubmissionController.bulkSubmit); // form.bulk.create
router.get('/filters', ThesisSubmissionController.listFilters);
router.post('/:form_id/link', ThesisSubmissionController.linkPublication); // form.load
router.post('/:form_id/unlink', ThesisSubmissionController.unlinkPublication); // form.load
router.get('/:form_id', ThesisSubmissionController.loadForm); // form.load
router.post('/:form_id', ThesisSubmissionController.submit); // form.submit

module.exports = router;

