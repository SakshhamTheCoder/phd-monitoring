const express = require('express');
const router = express.Router();
const PatentsController = require('../../controllers/PatentsController');
const authMiddleware = require('../../middleware/auth');

// router.post('/', PatentsController.load); // commented out in PHP
router.post('/', authMiddleware, PatentsController.store);
// router.put('/', authMiddleware, PatentsController.update); // commented out in PHP
// router.post('/submit', authMiddleware, PatentsController.submit); // commented out in PHP

module.exports = router;

