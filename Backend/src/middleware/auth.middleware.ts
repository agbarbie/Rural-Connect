// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/helpers';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/user.type';

// Main authenticated request interface - this should be the primary one used
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    user_type: 'jobseeker' | 'employer' | 'admin';
    name?: string;
    iat?: number;
    exp?: number;
    employer_id?: string;
    company_id?: string;
  };
}

// Initialize auth service instance
const authService = new AuthService();

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token required'
    });
    return;
  }

  try {
    const decoded = verifyToken(token) as JwtPayload;
    
    // Verify user still exists in database
    const user = await authService.getUserById(Number(decoded.id));
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Set the user data on the request object with proper typing
    req.user = {
      id: decoded.id,
      email: decoded.email,
      user_type: decoded.user_type as 'employer' | 'admin' | 'jobseeker',
      name: user.name,
      iat: decoded.iat,
      exp: decoded.exp
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
    return;
  }
};

// Role-based middleware
export const requireEmployer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'employer') {
    res.status(403).json({
      success: false,
      message: 'Employer access required'
    });
    return;
  }

  next();
};

export const requireJobseeker = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'jobseeker') {
    res.status(403).json({
      success: false,
      message: 'Jobseeker access required'
    });
    return;
  }

  next();
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};

// Middleware to allow multiple roles
export const requireRoles = (allowedRoles: ('jobseeker' | 'employer' | 'admin')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.user_type)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

// Optional middleware for routes that work with both authenticated and guest users
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided, continue as guest user
    req.user = undefined;
    next();
    return;
  }

  try {
    const decoded = verifyToken(token) as JwtPayload;
    const user = await authService.getUserById(Number(decoded.id));
    
    if (user) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type as 'employer' | 'admin' | 'jobseeker',
        name: user.name,
        iat: decoded.iat,
        exp: decoded.exp
      };
    } else {
      // User not found, continue as guest
      req.user = undefined;
    }
  } catch (error) {
    // Invalid token, continue as guest user
    console.warn('Invalid token in optional auth:', error);
    req.user = undefined;
  }

  next();
};

// Middleware specifically for employer operations that need employer ID
export const requireEmployerWithId = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // First authenticate
  await authenticateToken(req, res, () => {});
  
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'employer') {
    res.status(403).json({
      success: false,
      message: 'Employer access required'
    });
    return;
  }

  try {
    // Get the employer record to ensure we have the employer ID
    const employer = await authService.getEmployerByUserId(req.user.id);
    
    if (!employer) {
      res.status(403).json({
        success: false,
        message: 'Employer profile not found'
      });
      return;
    }

    // Add employer info to request
    req.user.employer_id = employer.id;
    req.user.company_id = employer.company_id;
    
    next();
  } catch (error) {
    console.error('Error fetching employer data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
    return;
  }
};

// Combined authentication and authorization middleware
export const authenticateAndAuthorize = (requiredRole?: 'jobseeker' | 'employer' | 'admin') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // First authenticate
    await authenticateToken(req, res, () => {});
    
    if (!req.user) {
      // authenticateToken already sent error response
      return;
    }

    // Then check authorization if role is specified
    if (requiredRole && req.user.user_type !== requiredRole) {
      res.status(403).json({
        success: false,
        message: `${requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)} access required`
      });
      return;
    }

    next();
  };
};

// Extended AuthenticatedRequest for employer-specific operations
export interface EmployerAuthenticatedRequest extends AuthenticatedRequest {
  user?: AuthenticatedRequest['user'] & {
    employer_id?: string;
    company_id?: string;
  };
}