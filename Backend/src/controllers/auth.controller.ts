import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { validate as isValidUUID } from 'uuid';
import { CreateUserRequest, LoginRequest, AuthResponse, User, Jobseeker } from '../types/user.type';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

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

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);
      if (!result.success) {
        res.status(401).json(result);
        return;
      }
      res.status(200).json(result);
    } catch (error) {
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