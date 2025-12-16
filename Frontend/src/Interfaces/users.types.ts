export interface User {
  user_id: string;
  id: string;  // Changed from number to string to match your API
  name: string;
  email: string;
  user_type: 'jobseeker' | 'employer' | 'admin';
  location?: string;
  contact_number?: string;
  company_name?: string;
  role_in_company?: string;
  company_id?: string; // Added company_id as optional
  created_at: string;
  updated_at: string;
}

// Fixed AuthResponse to match your actual API structure
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
  };
}

export interface RegisterRequest {
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