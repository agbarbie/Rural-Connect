import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { validate as isValidUUID } from 'uuid';
import { CreateUserRequest, LoginRequest, AuthResponse, User, Jobseeker } from '../types/user.type';
import jwt from 'jsonwebtoken';

// Update this interface for login request with user type validation
interface LoginRequestWithUserType extends LoginRequest {
  user_type?: string; // Optional user type for validation
}

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // DEBUG METHOD - Remove in production
  debugJWT = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.json({ error: 'No token provided' });
        return;
      }

      try {
        const decoded = jwt.decode(token);
        console.log('Token decoded (no verification):', decoded);
        
        const verified = jwt.verify(token, process.env.JWT_SECRET!);
        console.log('Token verified:', verified);
        
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
      
      // Validate required fields
      if (!userData.email || !userData.password || !userData.name || !userData.user_type) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: email, password, name, user_type'
        });
        return;
      }

      const result = await this.authService.register(userData);
      
      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      // Ensure consistent response format
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: result.user,
          token: result.token
        }
      });
    } catch (error) {
      console.error('Registration controller error:', error);
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Login attempt for:', req.body.email);
    console.log('Requested user type:', req.body.user_type);
    
    const loginData: LoginRequestWithUserType = req.body;
    
    if (!loginData.email || !loginData.password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    const basicLoginData: LoginRequest = {
      email: loginData.email,
      password: loginData.password
    };

    const result = await this.authService.login(basicLoginData);
    
    if (!result.success) {
      res.status(401).json({
        success: false,
        message: result.message || 'Invalid credentials'
      });
      return;
    }

    // Validate user type if provided
    if (loginData.user_type && result.user && result.user.user_type !== loginData.user_type) {
      console.log(`User type mismatch: requested ${loginData.user_type}, actual ${result.user.user_type}`);
      res.status(400).json({
        success: false,
        message: `Account type mismatch. This account is registered as ${result.user.user_type}, but you selected ${loginData.user_type}. Please select the correct user type.`
      });
      return;
    }

    console.log(`Login successful - User type: ${result.user?.user_type}`);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    console.error('Login controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      await this.authService.logout(userId);
      console.log(`Logout successful for user: ${userId}`);
    }
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null
    });
  } catch (error) {
    console.error('Logout controller error:', error);
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
        const jobseeker = await this.authService.getJobseekerByUserId(userId);
        if (jobseeker) {
          profileData = { ...user, jobseeker };
        }
      } else if (user.user_type === 'employer') {
        const employer = await this.authService.getEmployerByUserId(userId);
        if (employer) {
          profileData = { ...user, employer };
        }
      }

      res.status(200).json({
        success: true,
        data: {
          user: profileData,
          token: null // Profile endpoint doesn't return a new token
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
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

      const { 
        name, 
        location, 
        contact_number, 
        skills, 
        bio, 
        resume_url, 
        portfolio_url, 
        experience_level, 
        preferred_salary_min, 
        preferred_salary_max, 
        availability 
      } = req.body;

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
        data: {
          user: { ...updatedUser, jobseeker: updatedJobseeker },
          token: null
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      next(error);
    }
  };
}