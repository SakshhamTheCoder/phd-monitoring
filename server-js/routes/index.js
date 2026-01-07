// Main router, will import and use all route files
import { Router } from 'express';
// import apiRoutes from './api.js';
// import webRoutes from './web.js';

const router = Router();

// router.use('/api', apiRoutes);
// router.use('/', webRoutes);

router.get('/', (req, res) => {
    res.send('Express server replica root');
});

export default router;

