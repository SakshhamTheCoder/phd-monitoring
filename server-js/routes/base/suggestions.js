import { Router } from 'express';
import * as SuggestionController from '../../app/Http/Controllers/SuggestionController.js';
import authMiddleware from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/specialization', SuggestionController.suggestSpecialization);
router.post('/faculty', SuggestionController.suggestFaculty);
router.post('/outside-expert', SuggestionController.suggestOutsideExpert);
router.post('/department', SuggestionController.suggestDepartment);
router.post('/examiner', SuggestionController.suggestExaminer);
router.post('/country', SuggestionController.suggestCountry);
router.post('/state', SuggestionController.suggestState);
router.post('/city', SuggestionController.suggestCity);
router.post('/designation', SuggestionController.suggestDesignation);

export default router;
