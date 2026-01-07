const express = require('express');
const router = express.Router();
const PresentationController = require('../../controllers/PresentationController');
const SemesterController = require('../../controllers/SemesterController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

// get semesters
router.get('/', PresentationController.listSemesterPresentation);
router.post('/', PresentationController.createForm);
router.get('/semester', PresentationController.listSemesterPresentation);

// Filters
router.get('/filters', PresentationController.listFilters);
router.get('/form/filters', PresentationController.listFilters);

// Bulk Scheduling
router.get('/semester/:semester_id', PresentationController.listForm);
router.post('/semester/:semester_id', PresentationController.createForm);
router.post('/semester/:semester_id/bulk-schedule', PresentationController.createMultipleForm);
router.get('/semester/:semester_id/filters', PresentationController.listFilters);
router.get('/semester/:semester_id/not-scheduled', SemesterController.notScheduled);
router.post('/semester/:semester_id/bulk', PresentationController.bulkSubmit);

// Form with ID (view, submit, link/unlink)
router.get('/semester/:semester_id/:form_id', PresentationController.loadForm);
router.post('/semester/:semester_id/:form_id', PresentationController.submit);
router.post('/semester/:semester_id/:form_id/link', PresentationController.linkPublication);
router.post('/semester/:semester_id/:form_id/unlink', PresentationController.unlinkPublication);

module.exports = router;

