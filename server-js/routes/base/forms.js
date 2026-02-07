// Ported from Laravel's routes/base/forms.php

import { Router } from 'express';
import * as UserController from '../../app/Http/Controllers/UserController.js';
import irbcFormRouter from './irb/irbc_form.js';
import irbsFormRouter from './irb/irbs_form.js';
import presentationRouter from './presentation.js';
import thesisSubmissionRouter from './thesis_submission.js';
import thesisExtentionRouter from './thesis_extention.js';
import researchExtentionRouter from './research_extention.js';
import supervisorChangeRouter from './supervisor_change.js';
import supervisorAllocationRouter from './supervisor_allocation.js';
import studentStatusChangeRouter from './student_status_change.js';
import synopsisSubmissionRouter from './synopsis_submission.js';
import semesterOffRouter from './semester_off.js';
import listOfExaminersRouter from './list-of-examiners.js';

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

export default router;
