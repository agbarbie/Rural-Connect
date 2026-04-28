import { Response, Request, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/db.config';
import { AppError } from './errorMiddlewares';
import asyncHandler from '../middleware/asyncHandler';
import { AuthUser, JwtPayload } from '../../src/types/user.type';

export interface RequestWithUser extends Request {
  user?: AuthUser;
}

// Auth middleware to protect routes
export const protect = asyncHandler(async (req: RequestWithUser, res: Response, next: NextFunction) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // If no token is found
  if (!token) {
    return next(new AppError('Not authorized, no token provided', 401));
  }

  try {
    // Ensure JWT_SECRET is defined
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    // Log decoded for debugging (remove in production)
    console.log('Decoded JWT in protect:', decoded);

    // Check if id exists in decoded payload
    if (!decoded.id) {
      return next(new AppError('Invalid token, no id found in payload', 401));
    }

    // Fetch the user from the database
    const userQuery = await pool.query(
      "SELECT id, name, email, user_type FROM users WHERE id = $1",
      [decoded.id]
    );

    if (userQuery.rows.length === 0) {
      return next(new AppError('User not found', 401));
    }

    const user = userQuery.rows[0];

    // Attach the user to the request (mapping user_type to role for consistency)
    req.user = {
      id: user.id.toString(), // Convert number to string to match AuthUser
      email: user.email,
      role: user.user_type,
      name: user.name,
      user_type: user.user_type
    } as AuthUser;

    // Log req.user for debugging (remove in production)
    console.log('req.user set in protect:', req.user);

    // Proceed to the next middleware
    next();
  } catch (error: any) {
    console.error("JWT Error:", error.message);

    // Handle token expiration or invalid token
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired, please log in again', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token, not authorized', 401));
    }

    return next(new AppError('Not authorized, token failed: ' + error.message, 401));
  }
});

// Role-based access control middleware
export const checkRole = (roles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Not authorized, authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Not authorized, ${roles.join(' or ')} role required`, 403));
    }

    next();
  };
};