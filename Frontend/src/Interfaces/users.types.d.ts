export interface User {
    id: number;
    name: string;
    email: string;
    user_type: 'jobseeker' | 'employer' | 'admin';
    location?: string;
    contact_number?: string;
    company_name?: string;
    role_in_company?: string;
    created_at: string;
    updated_at: string;
}
export interface AuthResponse {
    success: boolean;
    message: string;
    token?: string;
    user?: User;
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
//# sourceMappingURL=users.types.d.ts.map