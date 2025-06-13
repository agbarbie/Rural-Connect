import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  activeUserType: 'jobseeker' | 'employer' | 'admin' = 'jobseeker';
  activeForm: 'login' | 'signup' = 'login';
  loginEmail: string = '';
  loginPassword: string = '';
  rememberMe: boolean = false;
  showLoginPassword: boolean = false;
  signupName: string = '';
  signupEmail: string = '';
  signupPassword: string = '';
  showSignupPassword: boolean = false;

  companyName: string = '';
  companyPassword: string = '';
  contactNumber: string = '';
  showCompanyPassword: boolean = false;

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

  getRoleContent() {
    return this.roleContent[this.activeUserType];
  }

  setActiveUserType(type: 'jobseeker' | 'employer' | 'admin'): void {
    this.activeUserType = type;
  }

  setActiveForm(form: 'login' | 'signup'): void {
    this.activeForm = form;
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

  onLogin(): void {
    const loginData = {
      email: this.loginEmail,
      password: this.loginPassword,
      rememberMe: this.rememberMe,
      userType: this.activeUserType
    };
    console.log('Login attempt:', loginData);
  }

  onSignUp(): void {
    const signupData = {
      name: this.signupName,
      email: this.signupEmail,
      password: this.signupPassword,
      userType: this.activeUserType,
      ...(this.activeUserType === 'employer' && {
        companyName: this.companyName,
        companyPassword: this.companyPassword,
        contactNumber: this.contactNumber
      })
    };
    console.log('Signup attempt:', signupData);
  }

  onForgotPassword(): void {
    console.log('Forgot password clicked');
  }
}