// Ported from Laravel's routes/base/google_auth.php
import { Router } from 'express';
import * as GoogleAuthController from '../../app/Http/Controllers/GoogleAuthController.js';

const router = Router();

// Redirect to Google OAuth (for web-based flow)
router.get('/redirect', GoogleAuthController.redirectToGoogle);

// Handle Google OAuth callback (for web-based flow)
router.get('/callback', GoogleAuthController.handleGoogleCallback);

// Login with Google access token (for SPA/mobile apps)
router.post('/login', GoogleAuthController.loginWithGoogleToken);

export default router;
