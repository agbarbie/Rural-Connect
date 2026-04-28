import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware to check if the authenticated user is an admin
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Check if user is authenticated (should be done by authenticateToken middleware first)
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Check if user has admin role
    if (req.user.user_type !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
      return;
    }

    // User is admin, proceed to next middleware/controller
    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to check if user is either admin or the owner of the resource
 */
export const requireAdminOrOwner = (resourceIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;
      const userType = req.user.user_type;

      // Allow if user is admin
      if (userType === 'admin') {
        next();
        return;
      }

      // Allow if user is the owner of the resource
      if (resourceId === userId) {
        next();
        return;
      }

      // Neither admin nor owner
      res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this resource.'
      });
    } catch (error) {
      console.error('Admin or owner authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

/**
 * Middleware to log admin actions for audit trail
 */
export const logAdminAction = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.user && req.user.user_type === 'admin') {
      const action = {
        admin_id: req.user.id,
        admin_email: req.user.email,
        action: `${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        user_agent: req.get('user-agent')
      };

      console.log('ADMIN ACTION:', JSON.stringify(action, null, 2));
      
      // In production, you would save this to a database table
      // await logAdminActionToDatabase(action);
    }

    next();
  } catch (error) {
    console.error('Admin action logging error:', error);
    // Don't block the request if logging fails
    next();
  }
};

/**
 * Middleware to prevent admin from performing actions on themselves
 */
export const preventSelfAction = (resourceIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // Prevent admin from performing action on themselves
      if (resourceId === userId) {
        res.status(400).json({
          success: false,
          message: 'You cannot perform this action on your own account.'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Self-action prevention error:', error);
      res.status(500).json({
        success: false,
        message: 'Validation check failed'
      });
    }
  };
};

/**
 * Middleware to validate bulk action permissions
 */
export const validateBulkActionPermissions = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const { userIds } = req.body;
    const adminId = req.user.id;

    // Prevent admin from including themselves in bulk actions
    if (userIds && Array.isArray(userIds) && userIds.includes(adminId)) {
      res.status(400).json({
        success: false,
        message: 'You cannot include your own account in bulk actions.'
      });
      return;
    }

    // Check bulk action limits (prevent abuse)
    if (userIds && userIds.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Bulk actions are limited to 100 users at a time.'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Bulk action validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation check failed'
    });
  }
};