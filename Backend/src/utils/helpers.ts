import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { validate as isValidUUID } from 'uuid';
import { User, JwtPayload } from '../types/user.type';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: Omit<User, 'password'>): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }

  // Validate UUID
  const userId = String(user.id).trim();
  if (!isValidUUID(userId)) {
    console.error(`DEBUG - Invalid UUID format for user id: ${userId}`);
    throw new Error(`Invalid user ID format: ${userId}`);
  }

  const payload = {
    id: userId,
    email: user.email.trim(),
    user_type: user.user_type
  };

  const options: SignOptions = {
    expiresIn: '1h'
  };

  console.log(`DEBUG - Generating token with payload:`, payload);
  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    // Validate UUID in decoded token
    if (!isValidUUID(String(decoded.id).trim())) {
      console.error(`DEBUG - Invalid UUID in token: ${decoded.id}`);
      throw new Error('Invalid user ID format in token');
    }
    console.log(`DEBUG - Verified token:`, decoded);
    return decoded;
  } catch (error: any) {
    console.error('Token verification error:', error.message);
    throw new Error('Invalid or expired token');
  }
};