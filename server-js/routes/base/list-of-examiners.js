const express = require('express');
const router = express.Router();
const ListOfExaminersController = require('../../controllers/ListOfExaminersController');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', ListOfExaminersController.listForm);
router.post('/', ListOfExaminersController.createForm);
router.post('/bulk', ListOfExaminersController.bulkSubmit); // form.bulk.create
router.get('/filters', ListOfExaminersController.listFilters);
router.get('/:form_id', ListOfExaminersController.loadForm); // form.load
router.post('/:form_id', ListOfExaminersController.submit); // form.submit

module.exports = router;

