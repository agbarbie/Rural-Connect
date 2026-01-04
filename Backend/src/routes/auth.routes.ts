import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, requireJobseeker } from '../middleware/auth.middleware';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();
const authController = new AuthController();

console.log('Registering auth routes:');
console.log('- POST /api/auth/register');
console.log('- POST /api/auth/login');
console.log('- POST /api/auth/logout');
console.log('- GET /api/auth/profile');
console.log('- PUT /api/auth/profile');

// Public routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));

// Protected routes (require authentication)
router.post('/logout', authenticateToken, asyncHandler(authController.logout));
router.get('/profile', authenticateToken, asyncHandler(authController.getProfile));
router.put('/profile', authenticateToken, requireJobseeker, asyncHandler(authController.updateProfile));

export default router;