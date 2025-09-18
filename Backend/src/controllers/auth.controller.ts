import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { validate as isValidUUID } from 'uuid';
import { CreateUserRequest, LoginRequest, AuthResponse, User, Jobseeker } from '../types/user.type';
import jwt from 'jsonwebtoken';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // ADD THIS DEBUG METHOD
  debugJWT = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.json({ error: 'No token provided' });
        return;
      }

      try {
        // Decode without verification to see the payload
        const decoded = jwt.decode(token);
        console.log('Token decoded (no verification):', decoded);
        
        // Try to verify
        const verified = jwt.verify(token, process.env.JWT_SECRET!);
        console.log('Token verified:', verified);
        
        // Check timestamps
        const now = Math.floor(Date.now() / 1000);
        console.log('Current timestamp:', now);
        
        res.json({
          decoded,
          verified,
          currentTime: now,
          isValid: true
        });
      } catch (error: any) {
        console.error('JWT Error:', error.message);
        res.json({
          error: error.message,
          decoded: jwt.decode(token),
          currentTime: Math.floor(Date.now() / 1000)
        });
      }
    } catch (error) {
      console.error('Debug JWT error:', error);
      res.status(500).json({
        success: false,
        message: 'Debug failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: CreateUserRequest = req.body;
      const result = await this.authService.register(userData);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // FIXED LOGIN METHOD
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('Login attempt for:', req.body.email);
      
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);
      
      if (!result.success) {
        res.status(401).json(result);
        return;
      }

      // IF YOUR AUTH SERVICE RETURNS THE USER, REGENERATE TOKEN WITH CORRECT FORMAT
      if ((result as any).data && (result as any).data.user) {
        const user = (result as any).data.user;

        // Generate CORRECT JWT token
        const correctToken = jwt.sign(
          {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        name: user.name,
        first_name: user.first_name || '',
        last_name: user.last_name || ''
          },
          process.env.JWT_SECRET!,
          {
        expiresIn: '24h', // 24 hours
        issuer: 'job-portal-api'
          }
        );

        // Log token generation details
        console.log('Token generation debug:', {
          currentTime: Math.floor(Date.now() / 1000),
          tokenPayload: jwt.decode(correctToken),
          userId: user.id,
          userType: user.user_type
        });

        // Return response with corrected token
        res.status(200).json({
          success: true,
          message: 'Login successful',
          data: {
        user: {
          id: user.id,
          email: user.email,
          user_type: user.user_type,
          name: user.name
        },
        token: correctToken, // Use the correctly generated token
        expiresIn: '30d'  // Match the actual JWT expiry
          }
        });
        return;
      }

      // If auth service doesn't return user details, use original result
      res.status(200).json(result);
    } catch (error) {
      console.error('Login error:', error);
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      const user = await this.authService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      let profileData: any = user;
      if (user.user_type === 'jobseeker') {
        const jobseeker = await this.authService.getJobseekerWithDetails(userId);
        if (jobseeker) {
          profileData = { ...user, jobseeker };
        }
      } else if (user.user_type === 'employer') {
        const employer = await this.authService.getEmployerWithDetails(userId);
        if (employer) {
          profileData = { ...user, employer };
        }
      }

      res.status(200).json({
        success: true,
        data: profileData
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Only jobseekers can update their profiles'
        });
        return;
      }

      const { name, location, contact_number, skills, bio, resume_url, portfolio_url, experience_level, preferred_salary_min, preferred_salary_max, availability } = req.body;

      // Update user table (common fields)
      const userUpdateData: Partial<User> = {
        name,
        location,
        contact_number
      };

      const updatedUser = await this.authService.updateUserProfile(userId, userUpdateData);
      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update jobseeker table (jobseeker-specific fields)
      const jobseekerUpdateData: Partial<Jobseeker> = {
        skills,
        bio,
        resume_url,
        portfolio_url,
        experience_level,
        preferred_salary_min,
        preferred_salary_max,
        availability
      };

      const updatedJobseeker = await this.authService.updateJobseekerProfile(userId, jobseekerUpdateData);
      if (!updatedJobseeker) {
        res.status(404).json({
          success: false,
          message: 'Jobseeker profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { ...updatedUser, jobseeker: updatedJobseeker }
      });
    } catch (error) {
      next(error);
    }
  };
}