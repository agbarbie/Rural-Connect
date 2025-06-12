import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {
  // Shared form fields
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;

  // Additional fields
  name: string = '';
  companyName: string = '';
  companyPassword: string = '';
  contactNumber: string = '';

  // Mode and user type
  activeUserType: 'jobseeker' | 'employer' | 'admin' = 'jobseeker';
  isLoginMode: boolean = true;
  isSignupMode: boolean = false;

  get isSignUpVisible() {
    return this.isSignupMode;
  }

  ngOnInit() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    this.isLoginMode = mode === 'login';
    this.isSignupMode = mode === 'signup';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  setActiveUserType(userType: 'jobseeker' | 'employer' | 'admin') {
    this.activeUserType = userType;
  }

  onLogin() {
    console.log('Login attempt:', {
      email: this.email,
      password: this.password,
      rememberMe: this.rememberMe,
      userType: this.activeUserType
    });
  }

  onForgotPassword() {
    console.log('Forgot password clicked');
  }

  onSignUp() {
    const signupData: any = {
      userType: this.activeUserType,
      name: this.name,
      email: this.email,
      password: this.password
    };

    if (this.activeUserType === 'employer') {
      signupData.companyName = this.companyName;
      signupData.companyPassword = this.companyPassword;
      signupData.contactNumber = this.contactNumber;
    }

    console.log('Sign up attempt:', signupData);
  }
}
