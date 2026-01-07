const express = require('express');
const router = express.Router();
const PublicationController = require('../../controllers/PublicationController');
const authMiddleware = require('../../middleware/auth');

router.post('/', authMiddleware, PublicationController.store);
router.get('/', authMiddleware, PublicationController.get);

module.exports = router;

