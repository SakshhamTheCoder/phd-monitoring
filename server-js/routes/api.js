/**
 * API Routes
 * Ported from PHP Laravel's routes/api.php
 * 
 * Complete implementation of all API endpoints
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../app/Models/User.js';
import Role from '../app/Models/Role.js';
import CloudflareHelper from '../app/Helpers/CloudflareHelper.js';
import authMiddleware from '../middleware/auth.middleware.js';
import * as HomeController from '../app/Http/Controllers/HomeController.js';

const router = Router();

/**
 * POST /login
 * Authenticate user and return token
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, captcha_token } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(422).json({ error: 'Email and password are required' });
        }

        // Verify captcha if provided (optional)
        if (captcha_token) {
            const captchaValid = await CloudflareHelper.verifyCaptcha(captcha_token);
            if (!captchaValid) {
                return res.status(422).json({ error: 'Captcha verification failed' });
            }
        }

        // Find user
        const user = await User.findOne({ 
            where: { email },
            include: ['role', 'current_role', 'default_role']
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        // Handle role assignment if current_role_id is null
        if (user.current_role_id === null) {
            if (user.default_role_id === null) {
                user.current_role_id = user.role_id;
                user.default_role_id = user.role_id;
            } else {
                user.current_role_id = user.default_role_id;
            }
            await user.save();
            await user.reload({ include: ['role', 'current_role', 'default_role'] });
        }

        // Prepare response
        const userResponse = {
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
            role: {
                role: user.current_role ? user.current_role.role : null
            }
        };

        // Get available roles
        const availableRoles = await user.availableRoles();

        // Generate JWT token (10 days expiry like Laravel)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '10d' }
        );

        return res.status(200).json({
            user: userResponse,
            available_roles: availableRoles,
            token: token
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /forgot-password
 * Send password reset link
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, captcha_token } = req.body;

        // Validation
        if (!email) {
            return res.status(422).json({
                success: false,
                errors: { email: ['The email field is required.'] }
            });
        }

        // Verify captcha if provided
        if (captcha_token) {
            const captchaValid = await CloudflareHelper.verifyCaptcha(captcha_token);
            if (!captchaValid) {
                return res.status(422).json({
                    success: false,
                    error: 'Captcha verification failed'
                });
            }
        }

        // Check if user exists
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(422).json({
                success: false,
                errors: { email: ['The selected email is invalid.'] }
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Store token (you may want to create a password_resets table)
        // For now, we'll use the remember_token field
        user.remember_token = resetToken;
        await user.save();

        // Send password reset notification
        await user.sendPasswordResetNotification(resetToken);

        return res.status(200).json({
            success: true,
            message: 'We have emailed your password reset link.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send reset link'
        });
    }
});

/**
 * POST /reset-password
 * Reset user password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, email, password, password_confirmation } = req.body;

        // Validation
        const errors = {};
        if (!token) errors.token = ['The token field is required.'];
        if (!email) errors.email = ['The email field is required.'];
        if (!password) errors.password = ['The password field is required.'];
        if (password && password.length < 8) {
            errors.password = ['The password must be at least 8 characters.'];
        }
        if (password !== password_confirmation) {
            errors.password_confirmation = ['The password confirmation does not match.'];
        }

        if (Object.keys(errors).length > 0) {
            return res.status(422).json({ errors });
        }

        // Find user with matching email and token
        const user = await User.findOne({ 
            where: { email, remember_token: token } 
        });

        if (!user) {
            return res.status(500).json({
                success: false,
                error: 'This password reset token is invalid.'
            });
        }

        // Update password
        user.password = password; // Will be hashed by beforeUpdate hook
        user.remember_token = crypto.randomBytes(30).toString('hex');
        
        // Mark first activation as complete if this is their first time
        if (user.first_activation === null) {
            user.first_activation = new Date();
        }
        
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Your password has been reset.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

/**
 * POST /switch-role
 * Switch user's current role (requires auth)
 */
router.post('/switch-role', authMiddleware, async (req, res) => {
    try {
        const { role: roleName } = req.body;

        if (!roleName) {
            return res.status(422).json({ error: 'Role is required' });
        }

        const user = req.user;

        // Find the role
        const role = await Role.findOne({ where: { role: roleName } });
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        // Check if user is authorized for this role
        const allowed = await user.isAuthorized(role.role);
        if (!allowed) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Update user's current role
        user.current_role_id = role.id;
        await user.save();
        await user.reload({ include: ['current_role'] });

        const userResponse = {
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
            role: {
                role: role.role
            }
        };

        return res.status(200).json({ user: userResponse });
    } catch (error) {
        console.error('Switch role error:', error);
        return res.status(401).json({ error: 'Invalid Request' });
    }
});

/**
 * POST /register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { first_name, last_name, phone, email, password, gender } = req.body;

        // Validation
        const errors = {};
        if (!first_name) errors.first_name = ['The first name field is required.'];
        if (!last_name) errors.last_name = ['The last name field is required.'];
        if (!phone) errors.phone = ['The phone field is required.'];
        if (!email) errors.email = ['The email field is required.'];
        if (!password) errors.password = ['The password field is required.'];
        if (!gender) errors.gender = ['The gender field is required.'];

        if (Object.keys(errors).length > 0) {
            return res.status(422).json({ errors });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(422).json({
                errors: { email: ['The email has already been taken.'] }
            });
        }

        // Create user
        const user = await User.create({
            first_name,
            last_name,
            phone,
            email,
            password,  // Will be hashed by beforeCreate hook
            gender,
            role_id: 1  // Default role
        });

        return res.status(200).json(user);
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * POST /create-role
 * Create a new role (admin functionality)
 */
router.post('/create-role', async (req, res) => {
    try {
        const role = await Role.create({
            role: 'Default'
        });

        return res.status(200).json(role);
    } catch (error) {
        console.error('Create role error:', error);
        return res.status(500).json({ error: 'Failed to create role' });
    }
});

/**
 * GET /home
 * Get home data for authenticated user
 */
router.get('/home', authMiddleware, HomeController.getHomeData);

// ============================================
// Route Group Imports
// ============================================

import rolesRoutes from './base/roles.js';
import notificationsRoutes from './base/notifications.js';
import departmentsRoutes from './base/departments.js';
import publicationsRoutes from './base/publications.js';
import patentsRoutes from './base/patents.js';
import facultiesRoutes from './base/faculties.js';
import studentsRoutes from './base/students.js';
import supervisorsRoutes from './base/supervisors.js';
import formsRoutes from './base/forms.js';
import presentationRoutes from './base/presentation.js';
import suggestionsRoutes from './base/suggestions.js';
import semesterRoutes from './base/semester.js';
import approvalsRoutes from './base/approvals.js';
import adminRoutes from './base/admin.js';
import coursesRoutes from './base/courses.js';
import outsideExpertsRoutes from './base/outside_experts.js';
import supervisorDoctoralChangesRoutes from './base/supervisor_doctoral_changes.js';
import usersRoutes from './base/users.js';
import googleAuthRoutes from './base/google_auth.js';

// ============================================
// Route Group Registrations
// ============================================

router.use('/roles', rolesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/departments', departmentsRoutes);
router.use('/publications', publicationsRoutes);
router.use('/patents', patentsRoutes);
router.use('/faculty', facultiesRoutes);
router.use('/students', studentsRoutes);
router.use('/supervisors', supervisorsRoutes);
router.use('/forms', formsRoutes);
router.use('/presentation', presentationRoutes);
router.use('/suggestions', suggestionsRoutes);
router.use('/semester', semesterRoutes);
router.use('/approval', approvalsRoutes);
router.use('/admin', adminRoutes);
router.use('/courses', coursesRoutes);
router.use('/outside-experts', outsideExpertsRoutes);
router.use('/supervisor-doctoral-changes', supervisorDoctoralChangesRoutes);
router.use('/users', usersRoutes);
router.use('/google', googleAuthRoutes);

export default router;
