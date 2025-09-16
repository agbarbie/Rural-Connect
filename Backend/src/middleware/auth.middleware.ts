import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/helpers';
import { AuthService } from '../services/auth.service';
import { JwtPayload } from '../types/user.type';
import { validate as isValidUUID } from 'uuid';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    user_type: 'jobseeker' | 'employer' | 'admin';
    name?: string;
    iat?: number;
    exp?: number;
    employer_id?: string;
    company_id?: string;
  };
}

const authService = new AuthService();

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]?.trim();

  if (!token) {
    console.log('DEBUG - No token provided');
    res.status(401).json({
      success: false,
      message: 'Access token required'
    });
    return;
  }

  try {
    const decoded = verifyToken(token) as JwtPayload;
    console.log('DEBUG - Decoded token:', decoded);

    // Validate UUID format
    const userId = String(decoded.id).trim();
    if (!isValidUUID(userId)) {
      console.log(`DEBUG - Invalid UUID format in token: ${userId}`);
      res.status(401).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    const user = await authService.getUserById(userId);

    if (!user) {
      console.log(`DEBUG - User not found for id: ${userId}`);
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('DEBUG - User from database:', user);

    req.user = {
      id: userId,
      email: decoded.email,
      user_type: decoded.user_type as 'employer' | 'admin' | 'jobseeker',
      name: user.name,
      iat: decoded.iat,
      exp: decoded.exp
    };
    
    console.log('DEBUG - req.user set to:', req.user);
    next();
  } catch (error: any) {
    console.error('Token verification error:', error.message);
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
    return;
  }
};

export const requireEmployer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    console.log('DEBUG - No authenticated user');
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'employer') {
    console.log(`DEBUG - User type ${req.user.user_type} is not employer`);
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
    console.log('DEBUG - No authenticated user');
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'jobseeker') {
    console.log(`DEBUG - User type ${req.user.user_type} is not jobseeker`);
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
    console.log('DEBUG - No authenticated user');
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'admin') {
    console.log(`DEBUG - User type ${req.user.user_type} is not admin`);
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
};

export const requireRoles = (allowedRoles: ('jobseeker' | 'employer' | 'admin')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.log('DEBUG - No authenticated user');
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.user_type)) {
      console.log(`DEBUG - User type ${req.user.user_type} not in allowed roles: ${allowedRoles.join(', ')}`);
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]?.trim();

  if (!token) {
    console.log('DEBUG - No token provided, continuing as guest');
    req.user = undefined;
    next();
    return;
  }

  try {
    const decoded = verifyToken(token) as JwtPayload;
    const userId = String(decoded.id).trim();
    if (!isValidUUID(userId)) {
      console.log(`DEBUG - Invalid UUID format in token: ${userId}`);
      req.user = undefined;
      next();
      return;
    }

    const user = await authService.getUserById(userId);

    if (user) {
      req.user = {
        id: userId,
        email: decoded.email,
        user_type: decoded.user_type as 'employer' | 'admin' | 'jobseeker',
        name: user.name,
        iat: decoded.iat,
        exp: decoded.exp
      };
    } else {
      console.log(`DEBUG - User not found for id: ${userId}, continuing as guest`);
      req.user = undefined;
    }
  } catch (error: any) {
    console.warn('Invalid token in optional auth:', error.message);
    req.user = undefined;
  }

  next();
};

export const requireEmployerWithId = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  await authenticateToken(req, res, () => {});
  
  if (!req.user) {
    console.log('DEBUG - No authenticated user');
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'employer') {
    console.log(`DEBUG - User type ${req.user.user_type} is not employer`);
    res.status(403).json({
      success: false,
      message: 'Employer access required'
    });
    return;
  }

  try {
    const userId = req.user.id.trim();
    if (!isValidUUID(userId)) {
      console.log(`DEBUG - Invalid UUID format: ${userId}`);
      res.status(401).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    const employer = await authService.getEmployerByUserId(userId);
    
    if (!employer) {
      console.log(`DEBUG - No employer profile found for user_id: ${userId}`);
      res.status(403).json({
        success: false,
        message: 'Employer profile not found'
      });
      return;
    }

    req.user.employer_id = employer.id;
    req.user.company_id = employer.company_id;
    next();
  } catch (error: any) {
    console.error('Error fetching employer data:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
    return;
  }
};

export const authenticateAndAuthorize = (requiredRole?: 'jobseeker' | 'employer' | 'admin') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    await authenticateToken(req, res, () => {});
    
    if (!req.user) {
      return;
    }

    if (requiredRole && req.user.user_type !== requiredRole) {
      console.log(`DEBUG - User type ${req.user.user_type} does not match required role: ${requiredRole}`);
      res.status(403).json({
        success: false,
        message: `${requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)} access required`
      });
      return;
    }

    next();
  };
};

export interface EmployerAuthenticatedRequest extends AuthenticatedRequest {
  user?: AuthenticatedRequest['user'] & {
    employer_id?: string;
    company_id?: string;
  };
}