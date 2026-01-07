const express = require('express');
const router = express.Router();
const SuggestionController = require('../../controllers/SuggestionController');
const authMiddleware = require('../../middleware/auth');

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

module.exports = router;

