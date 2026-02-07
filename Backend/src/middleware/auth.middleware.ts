// middleware/auth.middleware.ts - ADD THIS NEW MIDDLEWARE

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
 * ✅ REQUIRED AUTHENTICATION middleware
 * Verifies JWT token and attaches user to request - BLOCKS if no token
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        details: 'No valid authorization header found'
      });
      return;
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type,
        first_name: decoded.first_name,
        last_name: decoded.last_name
      };

      console.log('✅ Authentication successful:', {
        userId: req.user.id,
        userType: req.user.user_type,
        endpoint: `${req.method} ${req.path}`
      });

      next();
    } catch (jwtError: any) {
      console.error('❌ JWT verification failed:', jwtError.message);
      
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        details: jwtError.message
      });
      return;
    }
  } catch (error: any) {
    console.error('❌ Authentication error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: error.message
    });
    return;
  }
};

export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // No token? Continue as guest
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('ℹ️  No auth header - continuing as guest');
      return next();
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      
      // Valid token - attach user
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type,
        first_name: decoded.first_name,
        last_name: decoded.last_name
      };

      console.log('✅ Optional auth successful:', {
        userId: req.user.id,
        userType: req.user.user_type,
        endpoint: `${req.method} ${req.path}`
      });
      
    } catch (jwtError: any) {
      // Invalid token - continue as guest (don't block)
      console.log('⚠️  Invalid token in optional auth - continuing as guest');
    }
    
    next();
    
  } catch (error: any) {
    // Any error - continue as guest (don't block)
    console.error('⚠️  Optional auth error - continuing as guest:', error.message);
    next();
  }
};



/**
 * ✅ ROLE-BASED AUTHENTICATION
 * Requires authentication AND specific user type
 */
export const requireRole = (...allowedRoles: Array<'employer' | 'jobseeker' | 'admin'>) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // First ensure user is authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.user_type)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.user_type
      });
      return;
    }

    next();
  };
};