import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { CreateUserRequest, LoginRequest, AuthUser } from '../types/user.type';
import { RequestWithUser } from '../middleware/protect';
import asyncHandler from '../middleware/asyncHandler';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userData: CreateUserRequest = req.body;
    
    // Basic validation
    if (!userData.name || !userData.email || !userData.password || !userData.user_type) {
      res.status(400).json({
        success: false,
        message: 'Name, email, password, and user_type are required'
      });
      return;
    }

    const result = await this.authService.register(userData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const loginData: LoginRequest = req.body;
    
    // Basic validation
    if (!loginData.email || !loginData.password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    const result = await this.authService.login(loginData);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  });

  getProfile = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
    // Ensure req.user is defined
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Log for debugging (remove in production)
    console.log('getProfile - req.user:', req.user);

    // Return data from req.user
    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        user_type: req.user.user_type
      }
    });
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // JWT logout is client-side
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}