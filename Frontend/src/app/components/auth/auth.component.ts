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
  
  // ✅ NEW: Prevent double submission
  submitted: boolean = false;
  registrationInProgress: boolean = false;

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
    // ✅ NEW: Reset submission flags when switching user type
    this.submitted = false;
    this.registrationInProgress = false;
  }

  setActiveForm(form: 'login' | 'signup'): void {
    this.activeForm = form;
    this.clearMessages();
    // ✅ NEW: Reset submission flags when switching forms
    this.submitted = false;
    this.registrationInProgress = false;
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
    
    if (!userType) {
      console.error('No user type provided for navigation');
      this.error = 'Invalid user type';
      return;
    }
    
    // Check if there's a stored redirect URL
    const redirectUrl = localStorage.getItem('redirectUrl');
    if (redirectUrl) {
      console.log('Found stored redirect URL:', redirectUrl);
      localStorage.removeItem('redirectUrl');
      
      // Verify the redirect URL matches the user's role
      if (
        (userType === 'jobseeker' && redirectUrl.startsWith('/jobseeker')) ||
        (userType === 'employer' && redirectUrl.startsWith('/employer')) ||
        (userType === 'admin' && redirectUrl.startsWith('/admin'))
      ) {
        this.router.navigate([redirectUrl]).then(success => {
          if (success) {
            console.log('✅ Redirected to stored URL:', redirectUrl);
          } else {
            console.warn('❌ Failed to redirect to stored URL, using default');
            this.navigateToDefaultDashboard(userType);
          }
        });
        return;
      }
    }
    
    // Default navigation
    this.navigateToDefaultDashboard(userType);
  }

  private navigateToDefaultDashboard(userType: string): void {
    setTimeout(() => {
      switch (userType.toLowerCase()) {
        case 'jobseeker':
          console.log('Navigating to jobseeker dashboard');
          this.router.navigate(['/jobseeker/dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to jobseeker dashboard failed');
              this.error = 'Navigation failed. Please try again.';
            }
          });
          break;
        case 'employer':
          console.log('Navigating to employer dashboard');
          this.router.navigate(['/employer/employer-dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to employer dashboard failed');
              this.error = 'Navigation failed. Please try again.';
            }
          });
          break;
        case 'admin':
          console.log('Navigating to admin dashboard');
          this.router.navigate(['/admin/dashboard']).then(success => {
            if (!success) {
              console.error('Navigation to admin dashboard failed');
              this.error = 'Navigation failed. Please try again.';
            }
          });
          break;
        default:
          console.log('Unknown user type:', userType);
          this.error = 'Invalid user type';
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

    const loginData: RoleSpecificLoginRequest = {
      email: this.loginEmail.trim(),
      password: this.loginPassword,
      expected_role: this.activeUserType
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
          
          let userType = (response.data as any)?.user?.user_type || null;
          
          console.log('User type from response:', userType);
          
          // IMPORTANT: Validate that the returned user type matches the expected role
          if (userType && userType !== this.activeUserType) {
            this.error = `Account type mismatch. This account is registered as ${userType}, but you're trying to login as ${this.activeUserType}. Please select the correct role.`;
            this.loading = false;
            return;
          }
          
          if (userType) {
            console.log('Successfully validated user type:', userType);
            this.navigateToUserDashboard(userType);
          } else {
            console.error('No user type detected');
            this.error = 'Unable to determine user type. Please try again.';
            this.loading = false;
          }
          
        } else {
          this.error = response.message || 'Login failed';
          this.loading = false;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Login error:', error);
        
        if (error.status === 403 || error.status === 400) {
          if (error.error?.message?.includes('mismatch') || error.error?.message?.includes('type')) {
            this.error = error.error.message;
            return;
          }
        }
        
        this.error = error.error?.message || error.message || 'Login failed. Please check your credentials and try again.';
      }
    });
  }

  onSignUp(): void {
    // ✅ CRITICAL: Check if already submitting or submitted
    if (this.submitted || this.registrationInProgress || this.loading) {
      console.warn('⚠️ Registration already in progress, ignoring duplicate request');
      return;
    }

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

    // ✅ NEW: Set flags IMMEDIATELY to prevent double submission
    this.loading = true;
    this.submitted = true;
    this.registrationInProgress = true;
    this.clearMessages();

    console.log('🚀 Starting registration (timestamp:', Date.now(), ')');

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

    console.log('📝 Registration data prepared for:', registerData.email);

    this.authService.register(registerData).subscribe({
      next: (response) => {
        console.log('✅ Registration response received:', response);
        
        if (response.success) {
          this.success = 'Registration successful! Redirecting...';
          this.loading = false;
          
          // For registration, use the selected role since we're creating the account
          let userType = response.data?.user?.user_type || this.activeUserType;
          
          console.log('User registered with type:', userType);
          
          // ✅ NEW: Disable all form fields after successful registration
          this.disableForm();
          
          // Navigate to dashboard
          this.navigateToUserDashboard(userType);
          
        } else {
          // Registration failed
          console.warn('⚠️ Registration failed:', response.message);
          this.error = response.message || 'Registration failed';
          this.loading = false;
          
          // ✅ NEW: Allow retry on failure
          this.submitted = false;
          this.registrationInProgress = false;
        }
      },
      error: (error) => {
        console.error('❌ Registration error:', error);
        this.loading = false;
        
        // ✅ NEW: Allow retry on error
        this.submitted = false;
        this.registrationInProgress = false;
        
        // Handle specific error messages
        let errorMessage = error.error?.message || error.message || 'Registration failed. Please try again.';
        
        // ✅ NEW: Enhanced error handling for "already exists"
        if (errorMessage.includes('already exists')) {
          this.error = `This email is already registered! 
          
Options:
1. Try logging in instead
2. Use "Forgot Password" if you can't remember your password
3. Use a different email address`;
          
          // Suggest switching to login after 3 seconds
          setTimeout(() => {
            if (confirm('This email is already registered. Switch to login page?')) {
              this.setActiveForm('login');
              this.loginEmail = this.signupEmail; // Pre-fill login email
            }
          }, 1500);
        } else {
          this.error = errorMessage;
        }
      }
    });
  }

  // ✅ NEW: Method to disable form after successful registration
  private disableForm(): void {
    // Clear form fields to prevent accidental resubmission
    this.signupName = '';
    this.signupEmail = '';
    this.signupPassword = '';
    this.signupLocation = '';
    this.contactNumber = '';
    this.companyName = '';
    this.companyPassword = '';
    this.RoleInTheCompany = '';
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
    // You can implement forgot password functionality here
  }
}