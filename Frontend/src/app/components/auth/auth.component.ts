import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../../../../services/auth.service';
import { RegisterRequest, LoginRequest } from '../../../Interfaces/users.types';

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

  onLogin(): void {
    // Validation
    if (!this.loginEmail || !this.loginPassword) {
      this.error = 'Email and password are required';
      return;
    }

    this.loading = true;
    this.clearMessages();

    const loginData: LoginRequest = {
      email: this.loginEmail,
      password: this.loginPassword
    };

    console.log('Login attempt:', loginData);

    this.authService.login(loginData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = 'Login successful!';
          console.log('Login successful:', response);
          
          // Navigate based on user type
          setTimeout(() => {
            if (response.user?.user_type === 'jobseeker') {
              this.router.navigate(['/jobseeker/dashboard']);
            } else if (response.user?.user_type === 'employer') {
              this.router.navigate(['/employer/employer-dashboard']);
            } else if (response.user?.user_type === 'admin') {
              this.router.navigate(['/admin/dashboard']);
            }
          }, 1000);
        } else {
          this.error = response.message || 'Login failed';
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        this.error = error.error?.message || 'Login failed. Please try again.';
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
      name: this.signupName,
      email: this.signupEmail,
      password: this.signupPassword,
      user_type: this.activeUserType
    };

    // Add user type specific fields
    if (this.activeUserType === 'jobseeker') {
      registerData.location = this.signupLocation;
      registerData.contact_number = this.contactNumber;
    } else if (this.activeUserType === 'employer') {
      registerData.company_name = this.companyName;
      registerData.company_password = this.companyPassword;
      registerData.role_in_company = this.RoleInTheCompany;
    } else if (this.activeUserType === 'admin') {
      registerData.contact_number = this.contactNumber;
    }

    console.log('Signup attempt:', registerData);

    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.success = 'Registration successful!';
          console.log('Registration successful:', response);
          
          // Navigate based on user type
          setTimeout(() => {
            if (response.user?.user_type === 'jobseeker') {
              this.router.navigate(['/jobseeker/dashboard']);
            } else if (response.user?.user_type === 'employer') {
              this.router.navigate(['/employer/employer-dashboard']);
            } else if (response.user?.user_type === 'admin') {
              this.router.navigate(['/admin/dashboard']);
            }
          }, 1000);
        } else {
          this.error = response.message || 'Registration failed';
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Registration error:', error);
        this.error = error.error?.message || 'Registration failed. Please try again.';
      }
    });
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
    // You can implement forgot password functionality here
  }
}