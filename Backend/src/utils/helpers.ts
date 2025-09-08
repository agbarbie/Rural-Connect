import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.config';
import { User, JwtPayload } from '../types/user.type';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: Omit<User, 'password'>): string => {
  if (!jwtConfig.secret) {
    throw new Error('JWT secret is not defined');
  }

  const payload = {
    id: user.id,
    email: user.email,
    user_type: user.user_type
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.expiresIn as jwt.SignOptions['expiresIn']
  };

  return jwt.sign(payload, jwtConfig.secret, options);
};

export const verifyToken = (token: string): JwtPayload => {
  if (!jwtConfig.secret) {
    throw new Error('JWT secret is not defined');
  }
  
  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};