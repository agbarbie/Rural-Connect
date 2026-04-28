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

export interface UpdateUserRequest extends Partial<CreateUserRequest> {
  password?: string;
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

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  user_type: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  user_type: string;
  iat?: number;
  exp?: number;
}

export interface Employer {
  id: string;
  user_id: number;
  company_id?: string;
  role_in_company?: string;
  department?: string;
  can_post_jobs: boolean;
  can_manage_candidates: boolean;
  created_at: Date;
  updated_at: Date;
}

import { Company } from './company.type';

export interface EmployerWithDetails extends Employer {
  user: User;
  company?: Company;
}

export interface Jobseeker {
  id: string;
  user_id: number;
  location?: string;
  contact_number?: string;
  skills: string[];
  experience_level?: string;
  preferred_salary_min?: number;
  preferred_salary_max?: number;
  availability?: string;
  profile_picture?: string;
  bio?: string;
  resume_url?: string;
  portfolio_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface JobseekerWithDetails extends Jobseeker {
  user: User;
}

export interface Admin {
  id: string;
  user_id: number;
  contact_number?: string;
  role: string;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
}

export interface AdminWithDetails extends Admin {
  user: User;
}