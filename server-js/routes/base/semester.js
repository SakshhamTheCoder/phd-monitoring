const express = require('express');
const router = express.Router();
const SemesterController = require('../../controllers/SemesterController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/recent', SemesterController.getRecent);
router.get('/:semester_id', SemesterController.getRecent);
router.post('/', SemesterController.create);

module.exports = router;

