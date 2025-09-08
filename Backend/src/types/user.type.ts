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
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  user_type: string;
}

// JWT payload interface for backend
export interface JwtPayload {
  id: number;
  email: string;
  user_type: string;
  iat?: number;
  exp?: number;
}