// src/middleware/role.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

interface AuthRequest extends Request {
  user?: any;
}

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    return next();
  };
};

// Export as 'authorize' to match routes import
export const authorize = authorizeRoles;

export const isJobseeker = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.user_type !== 'jobseeker') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Jobseeker role required.',
      currentRole: req.user.user_type
    });
  }
  return next();
};