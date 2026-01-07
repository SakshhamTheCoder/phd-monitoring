const express = require('express');
const router = express.Router();
const RolesController = require('../../controllers/RolesController');
const Role = require('../../models/Role');
const authMiddleware = require('../../middleware/auth');

router.get('/', async (req, res) => {
    const roles = await Role.findAll();
    res.status(200).json(roles);
});

router.post('/add', authMiddleware, RolesController.add);

module.exports = router;

