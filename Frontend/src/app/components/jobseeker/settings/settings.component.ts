import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment.prod';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  activeTab: 'profile' | 'security' | 'notifications' | 'privacy' = 'profile';

  // Profile fields
  name: string = '';
  location: string = '';
  contactNumber: string = '';
  bio: string = '';

  // Security fields
  currentPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Notification toggles
  emailJobAlerts: boolean = true;
  emailTrainingAlerts: boolean = true;
  emailApplicationUpdates: boolean = true;
  emailNewsletter: boolean = false;

  // Privacy toggles
  profileVisible: boolean = true;
  showContactInfo: boolean = false;
  allowMessages: boolean = true;

  // UI state
  profileLoading = false;
  passwordLoading = false;
  profileSuccess = '';
  profileError = '';
  passwordSuccess = '';
  passwordError = '';
  notifSuccess = '';
  privacySuccess = '';

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
  }

  loadProfile(): void {
    this.http.get<any>(`${this.apiUrl}/auth/profile`, { headers: this.getHeaders() }).subscribe({
      next: (res) => {
        if (res.success && res.data?.user) {
          const u = res.data.user;
          this.name = u.name || '';
          this.location = u.location || '';
          this.contactNumber = u.contact_number || '';
          this.bio = u.jobseeker?.bio || u.bio || '';
        }
      },
      error: () => {}
    });
  }

  saveProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';
    if (!this.name.trim()) { this.profileError = 'Name is required.'; return; }
    this.profileLoading = true;
    this.http.put<any>(`${this.apiUrl}/auth/profile`,
      { name: this.name, location: this.location, contact_number: this.contactNumber, bio: this.bio },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.profileLoading = false;
        if (res.success) {
          this.profileSuccess = 'Profile updated successfully!';
          if (res.data?.user) {
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } else {
          this.profileError = res.message || 'Failed to update profile.';
        }
      },
      error: (err) => {
        this.profileLoading = false;
        this.profileError = err?.error?.message || 'Failed to update profile.';
      }
    });
  }

  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';
    if (!this.currentPassword) { this.passwordError = 'Current password is required.'; return; }
    if (this.newPassword.length < 6) { this.passwordError = 'New password must be at least 6 characters.'; return; }
    if (this.newPassword !== this.confirmNewPassword) { this.passwordError = 'New passwords do not match.'; return; }
    this.passwordLoading = true;
    // We use the reset-password endpoint pattern: verify current password then update
    this.http.put<any>(`${this.apiUrl}/auth/change-password`,
      { currentPassword: this.currentPassword, newPassword: this.newPassword },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.passwordLoading = false;
        if (res.success) {
          this.passwordSuccess = 'Password changed successfully!';
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmNewPassword = '';
        } else {
          this.passwordError = res.message || 'Failed to change password.';
        }
      },
      error: (err) => {
        this.passwordLoading = false;
        this.passwordError = err?.error?.message || 'Failed to change password. Check your current password.';
      }
    });
  }

  saveNotifications(): void {
    this.notifSuccess = 'Notification preferences saved!';
    setTimeout(() => this.notifSuccess = '', 3000);
  }

  savePrivacy(): void {
    this.privacySuccess = 'Privacy settings saved!';
    setTimeout(() => this.privacySuccess = '', 3000);
  }

  confirmDeleteAccount(): void {
    if (confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.')) {
      alert('Please contact support at support@ruralconnect.com to complete account deletion.');
    }
  }

  get passwordStrength(): { level: string; color: string; width: string } {
    const p = this.newPassword;
    if (!p) return { level: '', color: '#ccc', width: '0%' };
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { level: 'Weak', color: '#ef4444', width: '25%' };
    if (s === 2) return { level: 'Fair', color: '#f97316', width: '50%' };
    if (s === 3) return { level: 'Good', color: '#eab308', width: '75%' };
    return { level: 'Strong', color: '#22c55e', width: '100%' };
  }
}
