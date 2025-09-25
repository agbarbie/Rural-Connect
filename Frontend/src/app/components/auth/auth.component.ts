import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../../../../services/auth.service';
import { RegisterRequest, LoginRequest } from '../../../Interfaces/users.types';

// Add this interface for role-specific login
interface RoleSpecificLoginRequest extends LoginRequest {
  expected_role: string;
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  activeUserType: 'jobseeker' | 'employer' | 'admin' = 'jobseeker';
  activeForm: 'login' | 'signup' = 'login';
  
  // Login form data
  loginEmail: string = '';
  loginPassword: string = '';
  rememberMe: boolean = false;
  showLoginPassword: boolean = false;
  
  // Signup form data
  signupName: string = '';
  signupLocation: string = '';
  signupEmail: string = '';
  signupPassword: string = '';
  showSignupPassword: boolean = false;
  
  // Employer specific fields
  companyName: string = '';
  companyPassword: string = '';
  RoleInTheCompany: string = '';
  showCompanyPassword: boolean = false;
  
  // Common fields
  contactNumber: string = '';
  
  // UI state
  loading: boolean = false;
  error: string = '';
  success: string = '';

  roleContent = {
    jobseeker: {
      heading: "Discover Your Potential",
      subheading: "Uncover new possibilities with AI"
    },
    employer: {
      heading: "Find the Right Talent",
      subheading: "Connect with skilled professionals in rural areas"
    },
    admin: {
      heading: "Manage & Oversee",
      subheading: "Control and monitor platform operations"
    }
  };

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  getRoleContent() {
    return this.roleContent[this.activeUserType];
  }

  setActiveUserType(type: 'jobseeker' | 'employer' | 'admin'): void {
    this.activeUserType = type;
    this.clearMessages();
  }

  setActiveForm(form: 'login' | 'signup'): void {
    this.activeForm = form;
    this.clearMessages();
  }

  toggleLoginPassword(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  toggleSignupPassword(): void {
    this.showSignupPassword = !this.showSignupPassword;
  }

  toggleCompanyPassword(): void {
    this.showCompanyPassword = !this.showCompanyPassword;
  }

  clearMessages(): void {
    this.error = '';
    this.success = '';
  }

  // Helper method to navigate based on user type
  private navigateToUserDashboard(userType: string): void {
    console.log('Navigating for user type:', userType);
    
    // Ensure we have a valid user type
    if (!userType) {
      console.error('No user type provided for navigation');
      this.router.navigate(['/']);
      return;
    }
    
    // Add a small delay to ensure the success message is visible
    setTimeout(() => {
      switch (userType.toLowerCase()) {
        case 'jobseeker':
          console.log('Navigating to jobseeker dashboard');
          this.router.navigate(['/jobseeker/dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to jobseeker dashboard failed');
              this.router.navigate(['/jobseeker']);
            }
          });
          break;
        case 'employer':
          console.log('Navigating to employer dashboard');
          this.router.navigate(['/employer/employer-dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to employer dashboard failed');
              this.router.navigate(['/employer']);
            }
          });
          break;
        case 'admin':
          console.log('Navigating to admin dashboard');
          this.router.navigate(['/admin/dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to admin dashboard failed');
              this.router.navigate(['/admin']);
            }
          });
          break;
        default:
          console.log('Unknown user type:', userType, 'redirecting to landing');
          this.router.navigate(['/']);
          break;
      }
    }, 500);
  }

  onLogin(): void {
    // Validation
    if (!this.loginEmail || !this.loginPassword) {
      this.error = 'Email and password are required';
      return;
    }

    this.loading = true;
    this.clearMessages();

    // FIXED: Include expected role in login request for validation
    const loginData: RoleSpecificLoginRequest = {
      email: this.loginEmail.trim(),
      password: this.loginPassword,
      expected_role: this.activeUserType // This is the key addition
    };

    console.log('Login attempt:', { 
      email: loginData.email, 
      expected_role: loginData.expected_role 
    });

    this.authService.login(loginData).subscribe({
      next: (response) => {
        console.log('Full login response:', response);
        
        if (response.success) {
          this.success = 'Login successful! Redirecting...';
          alert(`The logged in user type is: ${(response.data as any)?.user?.user_type || 'unknown'} and the token is ${response.data?.token}`);
          
          
          // Get user type from response
          let userType = (response.data as any)?.user?.user_type || null;
          
          console.log('Full response:', response);
          console.log('Response.data:', response.data);
          console.log('User type from response.data.user.user_type:', userType);
          
          if (!userType) {
            // Try alternative access patterns
            userType = (response.data as any)?.user_type || null;
            console.log('Fallback 1 - response.data.user_type:', userType);
          }
          
          if (!userType) {
            // Another fallback
            userType = (response as any).user?.user_type || null;
            console.log('Fallback 2 - response.user.user_type:', userType);
          }
          
          // IMPORTANT: Validate that the returned user type matches the expected role
          if (userType && userType !== this.activeUserType) {
            this.error = `Account type mismatch. This account is registered as ${userType}, but you're trying to login as ${this.activeUserType}. Please select the correct role or use the appropriate credentials.`;
            this.loading = false;
            return;
          }
          
          if (userType) {
            console.log('Successfully validated user type:', userType);
            this.navigateToUserDashboard(userType);
          } else {
            console.error('No user type detected, staying on auth page');
            this.error = 'Unable to determine user type. Please try again.';
          }
          
        } else {
          this.error = response.message || 'Login failed';
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        
        // Handle specific role mismatch error from backend
        if (error.status === 403 && error.error?.message?.includes('role mismatch')) {
          this.error = error.error.message;
        } else if (error.error?.data?.user?.user_type) {
          // If user info is in error response, still validate role
          const userType = error.error.data.user.user_type;
          if (userType !== this.activeUserType) {
            this.error = `Account type mismatch. This account is registered as ${userType}, but you're trying to login as ${this.activeUserType}.`;
          } else {
            this.navigateToUserDashboard(userType);
          }
        } else {
          this.error = error.error?.message || error.message || 'Login failed. Please try again.';
        }
      }
    });
  }

  onSignUp(): void {
    // Basic validation
    if (!this.signupName || !this.signupEmail || !this.signupPassword) {
      this.error = 'Name, email, and password are required';
      return;
    }

    // User type specific validation
    if (this.activeUserType === 'jobseeker') {
      if (!this.signupLocation || !this.contactNumber) {
        this.error = 'Location and contact number are required for job seekers';
        return;
      }
    } else if (this.activeUserType === 'employer') {
      if (!this.companyName || !this.companyPassword || !this.RoleInTheCompany) {
        this.error = 'Company details are required for employers';
        return;
      }
    } else if (this.activeUserType === 'admin') {
      if (!this.contactNumber) {
        this.error = 'Contact number is required for admins';
        return;
      }
    }

    this.loading = true;
    this.clearMessages();

    // Build registration data based on user type
    const registerData: RegisterRequest = {
      name: this.signupName.trim(),
      email: this.signupEmail.trim(),
      password: this.signupPassword,
      user_type: this.activeUserType
    };

    // Add user type specific fields
    if (this.activeUserType === 'jobseeker') {
      registerData.location = this.signupLocation.trim();
      registerData.contact_number = this.contactNumber.trim();
    } else if (this.activeUserType === 'employer') {
      registerData.company_name = this.companyName.trim();
      registerData.company_password = this.companyPassword;
      registerData.role_in_company = this.RoleInTheCompany.trim();
    } else if (this.activeUserType === 'admin') {
      registerData.contact_number = this.contactNumber.trim();
    }

    console.log('Signup attempt:', { 
      email: registerData.email, 
      name: registerData.name, 
      user_type: registerData.user_type 
    });

    this.authService.register(registerData).subscribe({
      next: (response) => {
        console.log('Full registration response:', response);
        
        if (response.success) {
          this.success = 'Registration successful! Redirecting...';
          
          // For registration, use the selected role since we're creating the account
          let userType = response.data?.user?.user_type || this.activeUserType;
          
          console.log('User object from response.data:', response.data);
          console.log('User object from response.data.user:', response.data?.user);
          console.log('User type from response:', userType);
          
          // For registration, the user type should match what was selected
          console.log('Final registration user type:', userType);
          this.navigateToUserDashboard(userType);
          
        } else {
          this.error = response.message || 'Registration failed';
        }
        
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Registration error:', error);
        this.error = error.error?.message || error.message || 'Registration failed. Please try again.';
      }
    });
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
    // You can implement forgot password functionality here
  }
}