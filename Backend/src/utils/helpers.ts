import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
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

  const payload = {
    id: user.id,
    email: user.email,
    user_type: user.user_type
  };

  const options: SignOptions = {
    expiresIn: '1h'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};