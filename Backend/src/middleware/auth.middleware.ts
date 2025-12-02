// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Export the interface so it can be imported by other files
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    user_type: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let token: string | null = null;
    // Extract token from Authorization header
    if (authHeader && typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      } else {
        token = authHeader; // In case token is sent without Bearer prefix
      }
    }
    console.log('Auth Debug:', {
      hasAuthHeader: !!authHeader,
      authHeaderValue: typeof authHeader === 'string' ? `${authHeader.substring(0, 20)}...` : 'None',
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token',
      url: req.url,
      method: req.method
    });
    if (!token || token.trim() === '') {
      console.log('Authentication failed: No token provided');
      res.status(401).json({
        success: false,
        message: 'Access token required',
        details: 'Please include Authorization header with Bearer token'
      });
      return;
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
      return;
    }
    // Use synchronous verification
    try {
      const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET) as any;
      
      console.log('Token decoded successfully:', {
        userId: decoded.id,
        userType: decoded.user_type,
        email: decoded.email,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'No expiration'
      });
      // Validate that required fields exist
      if (!decoded.id || !decoded.email || !decoded.user_type) {
        console.log('Token missing required fields:', decoded);
        res.status(403).json({
          success: false,
          message: 'Invalid token structure',
          details: 'Token is missing required user information'
        });
        return;
      }
      // Add user info to request object
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type
      };
      console.log('Authentication successful for user:', req.user.id);
      next();
    } catch (jwtError: any) {
      console.log('Token verification failed:', {
        errorName: jwtError.name,
        errorMessage: jwtError.message,
        tokenLength: token.length
      });
      let message = 'Invalid or expired token';
      let statusCode = 403;
      if (jwtError.name === 'TokenExpiredError') {
        message = 'Token has expired';
        statusCode = 401;
      } else if (jwtError.name === 'JsonWebTokenError') {
        message = 'Invalid token format';
        statusCode = 403;
      } else if (jwtError.name === 'NotBeforeError') {
        message = 'Token not active yet';
        statusCode = 403;
      }
      res.status(statusCode).json({
        success: false,
        message: message,
        details: 'Please login again to get a valid token'
      });
      return;
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      details: 'Internal server error during authentication'
    });
    return;
  }
};

// Export as 'authenticate' to match routes import
export const authenticate = authenticateToken;

export const requireJobseeker = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  console.log('Jobseeker role check:', {
    userExists: !!req.user,
    userType: req.user?.user_type,
    userId: req.user?.id
  });
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      details: 'Please login first'
    });
    return;
  }
  if (req.user.user_type !== 'jobseeker') {
    console.log('Access denied - not a jobseeker:', req.user.user_type);
    res.status(403).json({
      success: false,
      message: 'Access denied. Jobseeker role required.',
      currentRole: req.user.user_type,
      requiredRole: 'jobseeker'
    });
    return;
  }
  console.log('Jobseeker role check passed for user:', req.user.id);
  next();
};

export const requireEmployer = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  console.log('Employer role check:', {
    userExists: !!req.user,
    userType: req.user?.user_type,
    userId: req.user?.id,
    url: req.url
  });
  if (!req.user) {
    console.log('Employer check failed: No user in request');
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      details: 'Please login with an employer account'
    });
    return;
  }
  if (req.user.user_type !== 'employer') {
    console.log('Access denied - not an employer:', {
      actualRole: req.user.user_type,
      requiredRole: 'employer',
      userId: req.user.id
    });
    res.status(403).json({
      success: false,
      message: 'Access denied. Employer role required.',
      currentRole: req.user.user_type,
      requiredRole: 'employer'
    });
    return;
  }
  console.log('Employer role check passed for user:', req.user.id);
  next();
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  console.log('Admin role check:', {
    userExists: !!req.user,
    userType: req.user?.user_type,
    userId: req.user?.id
  });
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      details: 'Please login with an admin account'
    });
    return;
  }
  if (req.user.user_type !== 'admin') {
    console.log('Access denied - not an admin:', req.user.user_type);
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.',
      currentRole: req.user.user_type,
      requiredRole: 'admin'
    });
    return;
  }
  console.log('Admin role check passed for user:', req.user.id);
  next();
};

// Optional auth middleware - allows both authenticated and non-authenticated users
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token: string | null = null;
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
  }
  if (!token || token.trim() === '') {
    // No token provided - continue without user info
    console.log('Optional auth: No token provided');
    next();
    return;
  }
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET not configured');
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token.trim(), process.env.JWT_SECRET) as any;
    
    if (decoded.id && decoded.email && decoded.user_type) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type
      };
      console.log('Optional auth: User authenticated:', req.user.id);
    }
    next();
  } catch (error) {
    // Invalid token - continue without user info
    console.log('Optional auth: Invalid token, continuing without user');
    next();
  }
};

// Middleware to require either employer or jobseeker role
export const requireEmployerOrJobseeker = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  console.log('EmployerOrJobseeker role check:', {
    userExists: !!req.user,
    userType: req.user?.user_type,
    userId: req.user?.id
  });
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      details: 'Please login first'
    });
    return;
  }
  if (req.user.user_type !== 'employer' && req.user.user_type !== 'jobseeker') {
    res.status(403).json({
      success: false,
      message: 'Access denied. Employer or jobseeker role required.',
      currentRole: req.user.user_type,
      allowedRoles: ['employer', 'jobseeker']
    });
    return;
  }
  console.log('EmployerOrJobseeker role check passed for user:', req.user.id);
  next();
};