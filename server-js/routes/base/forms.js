// Ported from Laravel's routes/base/forms.php

import { Router } from 'express';
const UserController = require('../../controllers/UserController');
const irbcFormRouter = require('./irb/irbc_form');
const irbsFormRouter = require('./irb/irbs_form');
const presentationRouter = require('./presentation');
const thesisSubmissionRouter = require('./thesis_submission');
const thesisExtentionRouter = require('./thesis_extention');
const researchExtentionRouter = require('./research_extention');
const supervisorChangeRouter = require('./supervisor_change');
const supervisorAllocationRouter = require('./supervisor_allocation');
const studentStatusChangeRouter = require('./student_status_change');
const synopsisSubmissionRouter = require('./synopsis_submission');
const semesterOffRouter = require('./semester_off');
const listOfExaminersRouter = require('./list-of-examiners');
const router = Router();

// All routes below should be protected by auth middleware if available
// router.use(authMiddleware);

router.get('/', UserController.listForms);
router.use('/irb-constitution', irbcFormRouter);
router.use('/presentation', presentationRouter);
router.use('/irb-submission', irbsFormRouter);
router.use('/thesis-submission', thesisSubmissionRouter);
router.use('/thesis-extension', thesisExtentionRouter);
router.use('/irb-extension', researchExtentionRouter);
router.use('/supervisor-change', supervisorChangeRouter);
router.use('/supervisor-allocation', supervisorAllocationRouter);
router.use('/status-change', studentStatusChangeRouter);
router.use('/synopsis-submission', synopsisSubmissionRouter);
router.use('/revise-title', synopsisSubmissionRouter);
router.use('/semester-off', semesterOffRouter);
router.use('/list-of-examiners', listOfExaminersRouter);

module.exports = router;

