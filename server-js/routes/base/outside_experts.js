const express = require('express');
const router = express.Router();
const OutsideExpertController = require('../../controllers/OutsideExpertController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/list', OutsideExpertController.list);
router.get('/all', OutsideExpertController.all);
router.get('/filters', OutsideExpertController.listFilters);
router.post('/add', OutsideExpertController.add);
router.post('/bulk-import', OutsideExpertController.bulkImportFromCSV);
router.put('/update/:id', OutsideExpertController.update);
router.delete('/delete/:id', OutsideExpertController.delete);

module.exports = router;

