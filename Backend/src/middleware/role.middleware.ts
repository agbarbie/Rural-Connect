// middleware/role.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    if (!roles.includes(req.user.user_type)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        currentRole: req.user.user_type,
        requiredRoles: roles
      });
      return;
    }
    
    next();
  };
};

// Export as 'authorize' to match routes import
export const authorize = authorizeRoles;

export const requireRole = authorizeRoles;

export const isJobseeker = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
      message: 'Access denied. Jobseeker role required.',
      currentRole: req.user.user_type
    });
    return;
  }
  
  next();
};

export const isEmployer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
      message: 'Access denied. Employer role required.',
      currentRole: req.user.user_type
    });
    return;
  }
  
  next();
};

export const isAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
      message: 'Access denied. Admin role required.',
      currentRole: req.user.user_type
    });
    return;
  }
  
  next();
};

// Convenience exports for specific roles
export const requireEmployer = authorizeRoles('employer');
export const requireJobseeker = authorizeRoles('jobseeker');
export const requireAdmin = authorizeRoles('admin');
export const requireEmployerOrJobseeker = authorizeRoles('employer', 'jobseeker');
export const requireEmployerOrAdmin = authorizeRoles('employer', 'admin');
export const requireAnyUser = authorizeRoles('employer', 'jobseeker', 'admin');