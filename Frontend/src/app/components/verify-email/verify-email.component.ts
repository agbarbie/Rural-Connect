import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environments';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css'
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  message: string = '';
  private apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.verifyEmail(token);
      } else {
        this.status = 'error';
        this.message = 'No verification token found. Please use the link from your email.';
      }
    });
  }

  private verifyEmail(token: string): void {
    this.http.get<any>(`${this.apiUrl}/auth/verify-email?token=${token}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.status = 'success';
            this.message = 'Your email has been verified successfully! You can now log in.';
            // Auto-redirect after 3 seconds
            setTimeout(() => this.router.navigate(['/auth']), 3000);
          } else {
            this.status = 'error';
            this.message = response.message || 'Verification failed. Please try again.';
          }
        },
        error: (err) => {
          this.status = 'error';
          this.message = err?.error?.message || 'Verification link has expired or is invalid. Please register again or request a new verification email.';
        }
      });
  }

  goToLogin(): void {
    this.router.navigate(['/auth']);
  }
}
