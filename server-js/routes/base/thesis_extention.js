const express = require('express');
const router = express.Router();
const ThesisExtentionController = require('../../controllers/ThesisExtentionController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', ThesisExtentionController.listForm);
router.post('/', ThesisExtentionController.createForm);
router.post('/bulk', ThesisExtentionController.bulkSubmit); // form.bulk.create
router.get('/filters', ThesisExtentionController.listFilters);
router.get('/:form_id', ThesisExtentionController.loadForm); // form.load
router.post('/:form_id', ThesisExtentionController.submit); // form.submit

module.exports = router;

