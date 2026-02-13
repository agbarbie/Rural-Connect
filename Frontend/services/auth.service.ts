import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../src/environments/environments';
import { User, AuthResponse, RegisterRequest, LoginRequest } from '../src/Interfaces/users.types';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  updateToken(newToken: any) {
    throw new Error('Method not implemented.');
  }
  storeToken(newToken: any) {
    throw new Error('Method not implemented.');
  }
  setToken(newToken: any) {
    throw new Error('Method not implemented.');
  }
  refreshToken() {
    throw new Error('Method not implemented.');
  }
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        // Basic token validation
        if (this.isValidTokenFormat(storedToken)) {
          this.tokenSubject.next(storedToken);
          const user = JSON.parse(storedUser);
          this.currentUserSubject.next(user);
          console.log('Auth initialized from storage for user:', user.email);
          
          // 🔥 NEW: Log company info if employer
          if (user.user_type === 'employer') {
            console.log('Employer company info:', {
              company_name: user.company_name,
              company_id: user.company_id,
              role_in_company: user.role_in_company
            });
          }
        } else {
          console.warn('Invalid token format in storage, clearing auth data');
          this.clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error initializing auth from storage:', error);
      this.clearAuthData();
    }
  }

  private isValidTokenFormat(token: string): boolean {
    try {
      const parts = token.split('.');
      return parts.length === 3 && parts.every(part => part.length > 0);
    } catch {
      return false;
    }
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    console.log('Registration attempt:', {
      email: userData.email,
      name: userData.name,
      user_type: userData.user_type,
      // 🔥 NEW: Log company info for employers (without password)
      ...(userData.user_type === 'employer' && {
        company_name: userData.company_name,
        role_in_company: userData.role_in_company
      })
    });

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, userData)
      .pipe(
        tap(response => {
          console.log('=== REGISTRATION DEBUG ===');
          console.log('Full registration response:', response);
          console.log('Response type:', typeof response);
          console.log('Response.success:', response.success);
          console.log('Response.data:', response.data);
          
          if (response.data) {
            console.log('Response.data.token:', response.data.token);
            console.log('Response.data.user:', response.data.user);
            
            if (response.data.user) {
              console.log('User type from data.user:', response.data.user.user_type);
              console.log('User email from data.user:', response.data.user.email);
              console.log('User ID from data.user:', response.data.user.id);
              
              // 🔥 NEW: Log company info if employer
              if (response.data.user.user_type === 'employer') {
                console.log('Company name:', response.data.user.company_name);
                console.log('Company ID:', response.data.user.company_id);
                console.log('Role in company:', response.data.user.role_in_company);
              }
            }
          } else {
            console.log('No data found in response');
            console.log('All response keys:', Object.keys(response));
          }
          console.log('=== END REGISTRATION DEBUG ===');
          
          // FIXED: Access token and user from the correct nested structure
          if (response.success && response.data?.token && response.data?.user) {
            this.setAuthData(response.data.token, response.data.user);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Registration error:', error);
          const errorMessage = this.extractErrorMessage(error);
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    console.log('Login attempt:', { email: credentials.email });

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          console.log('=== LOGIN DEBUG ===');
          console.log('Full login response:', response);
          console.log('Response type:', typeof response);
          console.log('Response.success:', response.success);
          console.log('Response.data:', response.data);
          
          if (response.data) {
            console.log('Response.data.token:', response.data.token);
            console.log('Response.data.user:', response.data.user);
            
            if (response.data.user) {
              console.log('User type from data.user:', response.data.user.user_type);
              console.log('User email from data.user:', response.data.user.email);
              console.log('User ID from data.user:', response.data.user.id);
              console.log('User user_id from data.user:', response.data.user.user_id);
              
              // 🔥 NEW: Log company info if employer
              if (response.data.user.user_type === 'employer') {
                console.log('Company name:', response.data.user.company_name);
                console.log('Company ID:', response.data.user.company_id);
                console.log('Role in company:', response.data.user.role_in_company);
              }
            }
          } else {
            console.log('No data found in response');
            console.log('All response keys:', Object.keys(response));
          }
          console.log('=== END LOGIN DEBUG ===');
          
          // FIXED: Access token and user from the correct nested structure
          if (response.success && response.data?.token && response.data?.user) {
            this.setAuthData(response.data.token, response.data.user);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Login error:', error);
          const errorMessage = this.extractErrorMessage(error);
          return throwError(() => new Error(errorMessage));
        })
      );
  }

 logout(): Observable<any> {
  const headers = this.getAuthHeaders();
  
  return this.http.post<AuthResponse>(`${this.apiUrl}/auth/logout`, {}, { headers })
    .pipe(
      tap(() => {
        console.log('Logout successful');
        this.clearAuthData();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Logout error:', error);
        // Clear auth data even if logout request fails
        this.clearAuthData();
        return throwError(() => error);
      })
    );
}

  getProfile(): Observable<AuthResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<AuthResponse>(`${this.apiUrl}/auth/profile`, { headers })
      .pipe(
        tap(response => {
          if (response.success && response.data?.user) {
            // Update current user with fresh profile data
            this.currentUserSubject.next(response.data.user);
            // Also update localStorage
            localStorage.setItem('user', JSON.stringify(response.data.user));
            
            // 🔥 NEW: Log company info update if employer
            if (response.data.user.user_type === 'employer') {
              console.log('Updated employer profile:', {
                company_name: response.data.user.company_name,
                company_id: response.data.user.company_id,
                role_in_company: response.data.user.role_in_company
              });
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Get profile error:', error);
          const errorMessage = this.extractErrorMessage(error);
          
          // If unauthorized, clear auth data
          if (error.status === 401) {
            console.log('Unauthorized access, clearing auth data');
            this.clearAuthData();
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  updateProfile(profileData: any): Observable<AuthResponse> {
    const headers = this.getAuthHeaders();
    return this.http.put<AuthResponse>(`${this.apiUrl}/auth/profile`, profileData, { headers })
      .pipe(
        tap(response => {
          console.log('Profile update response:', response);
          if (response.success && response.data?.user) {
            // Update current user with updated profile data
            this.currentUserSubject.next(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            
            // 🔥 NEW: Log company info update if employer
            if (response.data.user.user_type === 'employer') {
              console.log('Updated company profile:', {
                company_name: response.data.user.company_name,
                company_id: response.data.user.company_id,
                role_in_company: response.data.user.role_in_company
              });
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Update profile error:', error);
          const errorMessage = this.extractErrorMessage(error);
          
          // If unauthorized, clear auth data
          if (error.status === 401) {
            this.clearAuthData();
          }
          
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  // 🔥 NEW: Method to update company profile specifically
  // SECURITY: Does NOT include company_password
  updateCompanyProfile(companyData: {
    company_name?: string;
    role_in_company?: string;
    company_description?: string;
    company_size?: string;
    industry?: string;
    founded?: string;
    headquarters?: string;
  }): Observable<AuthResponse> {
    return this.updateProfile(companyData);
  }

  // 🔥 NEW: Get company information from current user
  // Returns company data for employers only
  getCompanyInfo(): {
    company_name: string | undefined;
    company_id: string | undefined;
    role_in_company: string | undefined;
  } | null {
    const user = this.getCurrentUser();
    if (user?.user_type === 'employer') {
      return {
        company_name: user.company_name,
        company_id: user.company_id,
        role_in_company: user.role_in_company
      };
    }
    return null;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  private setAuthData(token: string, user: User): void {
    try {
      if (!token || !user) {
        throw new Error('Invalid token or user data');
      }

      // Validate token format before storing
      if (!this.isValidTokenFormat(token)) {
        throw new Error('Invalid token format');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id); // Store the string ID
      localStorage.setItem('user_id', user.user_id); // Also store user_id if different
      
      // 🔥 NEW: Store company info separately for easy access
      if (user.user_type === 'employer' && user.company_name) {
        localStorage.setItem('company_name', user.company_name);
        if (user.company_id) {
          localStorage.setItem('company_id', user.company_id);
        }
        if (user.role_in_company) {
          localStorage.setItem('role_in_company', user.role_in_company);
        }
      }
      
      this.tokenSubject.next(token);
      this.currentUserSubject.next(user);

      console.log('Auth data set successfully for user:', user.email);
    } catch (error) {
      console.error('Error setting auth data:', error);
      this.clearAuthData();
      throw error;
    }
  }

  private clearAuthData(): void {
  try {
    // Clear all auth-related items from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('user_id');
    localStorage.removeItem('company_name');
    localStorage.removeItem('company_id');
    localStorage.removeItem('role_in_company');
    
    // Clear BehaviorSubjects
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    
    console.log('Auth data cleared successfully');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
}

  private extractErrorMessage(error: HttpErrorResponse): string {
    // Handle connection errors first
    if (error.status === 0) {
      return 'Cannot connect to server. Please check if the server is running on port 5000.';
    }

    // Handle backend error responses
    if (error.error) {
      // Direct message from backend
      if (typeof error.error === 'string') {
        return error.error;
      }
      
      // Structured error response
      if (error.error.message) {
        return error.error.message;
      }
    }

    // Fallback error messages based on status code
    switch (error.status) {
      case 400:
        return 'Invalid request data. Please check your input.';
      case 401:
        return 'Invalid credentials. Please check your email and password.';
      case 403:
        return 'Access denied.';
      case 404:
        return 'Service not found.';
      case 409:
        return 'Account already exists with this email address.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // Utility methods
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user && this.isValidTokenFormat(token) && !this.isTokenExpired());
  }

  getUserType(): string | null {
    const user = this.getCurrentUser();
    return user?.user_type || null;
  }

  getUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.id || null;
  }

  // Get the user_id field specifically
  getUserUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.user_id || null;
  }

  // Get company_id for employers
  getCompanyId(): string | null {
    const user = this.getCurrentUser();
    if (user?.user_type === 'employer') {
      return user.company_id || null;
    }
    return null;
  }

  isJobseeker(): boolean {
    return this.getUserType() === 'jobseeker';
  }

  isEmployer(): boolean {
    return this.getUserType() === 'employer';
  }

  isAdmin(): boolean {
    return this.getUserType() === 'admin';
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < currentTime;
      
      if (isExpired) {
        console.log('Token has expired');
        this.clearAuthData();
      }
      
      return isExpired;
    } catch {
      console.log('Invalid token format, clearing auth data');
      this.clearAuthData();
      return true;
    }
  }

  // Force refresh of auth state
  refreshAuthState(): void {
    if (this.isAuthenticated()) {
      this.getProfile().subscribe({
        next: (response) => {
          console.log('Auth state refreshed successfully');
        },
        error: (error) => {
          console.error('Failed to refresh auth state:', error);
        }
      });
    }
  }
}