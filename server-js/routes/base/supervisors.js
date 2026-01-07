const express = require('express');
const router = express.Router();
const SupervisorController = require('../../controllers/SupervisorController');
const Supervisor = require('../../models/Supervisor');
const authMiddleware = require('../../middleware/auth');

router.get('/', async (req, res) => {
    const supervisors = await Supervisor.findAll();
    res.status(200).json(supervisors);
});

router.post('/assign', authMiddleware, SupervisorController.assign);

module.exports = router;

