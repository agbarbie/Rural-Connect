// src/routes/auth.routes.ts - COMPLETE UPDATED VERSION WITH EMAIL ENDPOINTS
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();
const authController = new AuthController();

console.log('Registering auth routes:');
console.log('- POST /api/auth/register - Register new user (sends verification email)');
console.log('- POST /api/auth/login - Login user');
console.log('- GET /api/auth/verify-email - Verify email address');
console.log('- POST /api/auth/request-password-reset - Request password reset');
console.log('- POST /api/auth/reset-password - Reset password with token');
console.log('- POST /api/auth/logout - Logout user (protected)');
console.log('- GET /api/auth/profile - Get user profile (protected)');
console.log('- PUT /api/auth/profile - Update user profile (protected)');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Register new user (sends verification email automatically)
router.post('/register', asyncHandler(authController.register));

// Login user
router.post('/login', asyncHandler(authController.login));

// Verify email address
// Called when user clicks verification link from email
// Example: GET /api/auth/verify-email?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
router.get('/verify-email', asyncHandler(authController.verifyEmail));

// Request password reset
// Sends password reset email to user
router.post('/request-password-reset', asyncHandler(authController.requestPasswordReset));

// Reset password with token
// Called when user submits new password from reset page
router.post('/reset-password', asyncHandler(authController.resetPassword));

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Logout user
router.post('/logout', authenticate, asyncHandler(authController.logout));

// Get current user profile
router.get('/profile', authenticate, asyncHandler(authController.getProfile));

// Update user profile
router.put('/profile', authenticate, asyncHandler(authController.updateProfile));

export default router;