// Ported from Laravel's routes/web.php
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => {
    // Render welcome view or send static file
    res.sendFile('welcome.html', { root: 'public' });
});

router.get('/reset-password/:token', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://phdportal.thapar.edu';
    res.redirect(`${frontendUrl}/reset-password?token=${req.params.token}`);
});

router.get('/api/reset-password/:token', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://phdportal.thapar.edu';
    res.redirect(`${frontendUrl}/reset-password?token=${req.params.token}`);
});

export default router;

