// Main router, will import and use all route files
import { Router } from 'express';
// import apiRoutes from './api.js';
// import webRoutes from './web.js';
import authRoutes from "./auth.routes.js";
import homeRoutes from "./home.routes.js";

const router = Router();

router.use('/auth', authRoutes);
// router.use('/api', apiRoutes);
// router.use('/', webRoutes);
router.use("/home", homeRoutes);
router.get('/', (req, res) => {
    res.send('Express server replica root');
});

export default router;

