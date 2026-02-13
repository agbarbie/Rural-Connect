// src/controllers/auth.controller.ts - FIXED VERSION
// ✅ MAJOR FIX: Async email sending to prevent registration timeout
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { emailService } from '../services/email.service';
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

  /**
   * REGISTER - Creates new user and sends verification email
   * ✅ FIXED: Email is sent asynchronously to prevent timeout
   */
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

      console.log('🚀 Starting registration for:', userData.email);

      const result = await this.authService.register(userData);
      
      if (!result.success) {
        console.log('❌ Registration failed:', result.message);
        res.status(400).json(result);
        return;
      }

      console.log('✅ User registered successfully:', result.user?.email);

      // ✅ CRITICAL FIX: Send verification email ASYNCHRONOUSLY
      // This prevents the registration from waiting for email delivery
      if (result.user) {
        // Fire-and-forget: Start email sending but DON'T wait for it
        emailService.sendVerificationEmail({
          email: result.user.email,
          name: result.user.name,
          userId: result.user.id.toString(),
        })
        .then(() => {
          console.log('✅ Verification email sent successfully to:', result.user!.email);
        })
        .catch((emailError) => {
          console.error('❌ Failed to send verification email:', emailError);
          // Email failure is logged but doesn't block registration
        });
        
        console.log('📧 Verification email queued for:', result.user.email);
      }

      // ✅ Return success IMMEDIATELY without waiting for email
      res.status(201).json({
        success: true,
        message: 'Registration successful! A verification email has been sent to your inbox.',
        data: {
          user: result.user,
          token: result.token
        }
      });

      console.log('✅ Registration response sent immediately');

    } catch (error) {
      console.error('❌ Registration controller error:', error);
      next(error);
    }
  };

  /**
   * VERIFY EMAIL - Verifies user's email address from token
   * Called when user clicks verification link in email
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
        return;
      }

      try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          email: string;
        };

        console.log('Email verification for user:', decoded.userId);

        // Get user from database
        const user = await this.authService.getUserById(decoded.userId);
        
        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found'
          });
          return;
        }

        // TODO: Update user's email_verified status in database
        // For now, we assume email is verified if token is valid
        
        // ✅ Send welcome email ASYNCHRONOUSLY
        emailService.sendWelcomeEmail(
          user.email,
          user.name,
          user.user_type
        )
        .then(() => {
          console.log('✅ Welcome email sent to:', user.email);
        })
        .catch((emailError) => {
          console.error('❌ Error sending welcome email:', emailError);
          // Don't fail verification if welcome email fails
        });

        res.status(200).json({
          success: true,
          message: 'Email verified successfully! You can now log in.',
          redirect: '/auth'
        });
      } catch (jwtError: any) {
        console.error('JWT verification error:', jwtError.message);
        res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token. Please request a new verification email.'
        });
        return;
      }
    } catch (error) {
      console.error('Email verification error:', error);
      next(error);
    }
  };

  /**
   * LOGIN - Authenticates user
   */
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

  /**
   * LOGOUT - Logs out user
   */
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

  /**
   * GET PROFILE - Returns current user's profile
   */
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

  /**
   * UPDATE PROFILE - Updates user's profile
   */
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

  /**
   * REQUEST PASSWORD RESET - Sends password reset email
   * ✅ FIXED: Email sent asynchronously
   */
  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      console.log('Password reset requested for:', email);

      const user = await this.authService.getUserByEmail(email);
      
      // Always return success (security best practice - don't reveal if email exists)
      if (!user) {
        console.log('No user found with email:', email);
        res.status(200).json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.'
        });
        return;
      }

      // ✅ Send password reset email ASYNCHRONOUSLY
      emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        user.id.toString()
      )
      .then(() => {
        console.log('✅ Password reset email sent to:', user.email);
      })
      .catch((emailError) => {
        console.error('❌ Failed to send password reset email:', emailError);
        // Don't reveal error to user
      });

      // Return success immediately
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    } catch (error) {
      console.error('Request password reset error:', error);
      next(error);
    }
  };

  /**
   * RESET PASSWORD - Resets password using token from email
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
        return;
      }

      // Validate password strength (optional but recommended)
      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
        return;
      }

      try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          email: string;
        };

        console.log('Password reset for user:', decoded.userId);

        const success = await this.authService.updatePassword(decoded.userId, newPassword);

        if (!success) {
          res.status(400).json({
            success: false,
            message: 'Failed to reset password. User may not exist.'
          });
          return;
        }

        console.log('✅ Password reset successful for user:', decoded.userId);

        res.status(200).json({
          success: true,
          message: 'Password reset successfully. You can now log in with your new password.'
        });
      } catch (jwtError: any) {
        console.error('JWT verification error:', jwtError.message);
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token. Please request a new password reset.'
        });
        return;
      }
    } catch (error) {
      console.error('Reset password error:', error);
      next(error);
    }
  };
}