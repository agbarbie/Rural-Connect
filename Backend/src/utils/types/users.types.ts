import { Request } from 'express';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  user_type: 'jobseeker' | 'employer' | 'admin';
  location?: string;
  contact_number?: string;
  company_name?: string;
  company_password?: string;
  role_in_company?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  user_type: 'jobseeker' | 'employer' | 'admin';
  location?: string;
  contact_number?: string;
  company_name?: string;
  company_password?: string;
  role_in_company?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: Omit<User, 'password'>;
}

// JWT payload interface
export interface JwtPayload {
  id: number;
  email: string;
  user_type: string;
  iat?: number;
  exp?: number;
}

// User object that gets attached to request (from database)
export interface AuthUser {
  id: number;
  email: string;
  role: string; // This matches your database query SELECT role
  name?: string;
  user_type?: string;
}

// Extended Request interface with user
export interface RequestWithUser extends Request {
  user?: AuthUser;
}