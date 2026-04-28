import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environments';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  step: 'request' | 'reset' | 'done' = 'request';

  email: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  resetToken: string = '';

  loading: boolean = false;
  error: string = '';
  successMessage: string = '';

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.resetToken = params['token'];
        this.step = 'reset';
      }
    });
  }

  onRequestReset(): void {
    this.error = '';
    this.successMessage = '';

    if (!this.email || !this.email.includes('@')) {
      this.error = 'Please enter a valid email address.';
      return;
    }

    this.loading = true;

    this.http.post<any>(`${this.apiUrl}/auth/request-password-reset`, { email: this.email })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.successMessage = 'A password reset link has been sent to your email. Please check your inbox (and spam folder).';
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Unable to send reset email. Please try again later.';
        }
      });
  }

  onResetPassword(): void {
    this.error = '';
    this.successMessage = '';

    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = 'Password must be at least 6 characters long.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    if (!this.resetToken) {
      this.error = 'Invalid reset link. Please request a new password reset.';
      return;
    }

    this.loading = true;

    this.http.post<any>(`${this.apiUrl}/auth/reset-password`, {
      token: this.resetToken,
      newPassword: this.newPassword
    }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          this.step = 'done';
        } else {
          this.error = response.message || 'Failed to reset password. Please try again.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Reset link may have expired. Please request a new one.';
      }
    });
  }

  onBackToLogin(): void {
    this.router.navigate(['/auth']);
  }

  onRequestNewLink(): void {
    this.step = 'request';
    this.resetToken = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.error = '';
    this.successMessage = '';
    this.router.navigate(['/reset-password']);
  }

  get passwordStrength(): { level: string; color: string; width: string } {
    const p = this.newPassword;
    if (!p) return { level: '', color: '#ccc', width: '0%' };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { level: 'Weak', color: '#ef4444', width: '25%' };
    if (score === 2) return { level: 'Fair', color: '#f97316', width: '50%' };
    if (score === 3) return { level: 'Good', color: '#eab308', width: '75%' };
    return { level: 'Strong', color: '#22c55e', width: '100%' };
  }
}
