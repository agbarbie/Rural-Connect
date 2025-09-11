import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { protect } from '../middleware/protect';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));

// Protected routes
router.get('/profile', protect, asyncHandler(authController.getProfile));

export default router;