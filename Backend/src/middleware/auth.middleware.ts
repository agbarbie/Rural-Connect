// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Define the authenticated user structure
export interface AuthUser {
  id: string;
  email: string;
  user_type: 'employer' | 'jobseeker' | 'admin';
  first_name?: string;
  last_name?: string;
}

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: 'No valid authorization header found'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      
      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type,
        first_name: decoded.first_name,
        last_name: decoded.last_name
      };

      console.log('Authentication successful:', {
        userId: req.user.id,
        userType: req.user.user_type,
        endpoint: `${req.method} ${req.path}`
      });

      next();
    } catch (jwtError: any) {
      console.error('JWT verification failed:', jwtError.message);
      
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        details: jwtError.message
      });
      return;
    }
  } catch (error: any) {
    console.error('Authentication error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: error.message
    });
    return;
  }
};