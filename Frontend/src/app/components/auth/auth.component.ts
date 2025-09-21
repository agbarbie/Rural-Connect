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

  // Helper method to navigate based on user type
  private navigateToUserDashboard(userType: string): void {
    console.log('Navigating for user type:', userType);
    
    // Ensure we have a valid user type
    if (!userType) {
      console.error('No user type provided for navigation');
      this.router.navigate(['/']);
      return;
    }
    
    switch (userType.toLowerCase()) {
      case 'jobseeker':
        console.log('Navigating to jobseeker dashboard');
        this.router.navigate(['/jobseeker/dashboard']).then(success => {
          if (!success) {
            console.error('Navigation to jobseeker dashboard failed');
          }
        });
        break;
      case 'employer':
        console.log('Navigating to employer dashboard');
        this.router.navigate(['/employer/employer-dashboard']).then(success => {
          if (!success) {
            console.error('Navigation to employer dashboard failed');
          }
        });
        break;
      case 'admin':
        console.log('Navigating to admin dashboard');
        this.router.navigate(['/admin/dashboard']).then(success => {
          if (!success) {
            console.error('Navigation to admin dashboard failed');
          }
        });
        break;
      default:
        console.log('Unknown user type:', userType, 'redirecting to landing');
        this.router.navigate(['/']);
        break;
    }
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
      email: this.loginEmail.trim(),
      password: this.loginPassword
    };

    console.log('Login attempt:', { email: loginData.email });

    this.authService.login(loginData).subscribe({
      next: (response) => {
        this.loading = false;
        console.log('Full login response:', response);
        
        if (response.success) {
          this.success = 'Login successful!';
          
          // Get user type from response (based on your backend structure)
          let userType = response.user?.user_type || null;
          
          console.log('User object from response:', response.user);
          console.log('User type from response.user.user_type:', userType);
          
          console.log('Detected user type:', userType);
          
          // Navigate immediately with the correct user type
          this.navigateToUserDashboard(userType ?? '');
          
        } else {
          this.error = response.message || 'Login failed';
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        this.error = error.message || 'Login failed. Please try again.';
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
        this.loading = false;
        console.log('Full registration response:', response);
        
        if (response.success) {
          this.success = 'Registration successful!';
          
          // Get user type from response (your backend returns it in response.user.user_type)
          let userType = response.user?.user_type || this.activeUserType;
          
          console.log('User object from response:', response.user);
          console.log('User type from response:', userType);
          
          console.log('Registration user type:', userType);
          
          // Navigate immediately with the correct user type
          this.navigateToUserDashboard(userType);
          
        } else {
          this.error = response.message || 'Registration failed';
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Registration error:', error);
        this.error = error.message || 'Registration failed. Please try again.';
      }
    });
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
    // You can implement forgot password functionality here
  }
}