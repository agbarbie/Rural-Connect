import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environments';

@Component({
  selector: 'app-employer-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class EmployerSettingsComponent implements OnInit {
  activeTab: 'profile' | 'security' | 'notifications' | 'privacy' = 'profile';

  // Profile
  name: string = '';
  companyName: string = '';
  roleInCompany: string = '';
  location: string = '';
  contactNumber: string = '';

  // Security
  currentPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Notifications
  emailNewApplications: boolean = true;
  emailTrainingAlerts: boolean = true;
  emailPlatformUpdates: boolean = false;

  // Privacy
  companyVisible: boolean = true;
  showContactInfo: boolean = true;

  profileLoading = false;
  passwordLoading = false;
  profileSuccess = ''; profileError = '';
  passwordSuccess = ''; passwordError = '';
  notifSuccess = ''; privacySuccess = '';

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadProfile(); }

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
          this.companyName = u.company_name || '';
          this.roleInCompany = u.role_in_company || '';
          this.location = u.location || '';
          this.contactNumber = u.contact_number || '';
        }
      }
    });
  }

  saveProfile(): void {
    this.profileError = ''; this.profileSuccess = '';
    if (!this.name.trim()) { this.profileError = 'Name is required.'; return; }
    this.profileLoading = true;
    this.http.put<any>(`${this.apiUrl}/auth/profile`,
      { name: this.name, location: this.location, contact_number: this.contactNumber,
        company_name: this.companyName, role_in_company: this.roleInCompany },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.profileLoading = false;
        if (res.success) { this.profileSuccess = 'Profile updated successfully!'; if (res.data?.user) localStorage.setItem('user', JSON.stringify(res.data.user)); }
        else { this.profileError = res.message || 'Failed to update.'; }
      },
      error: (err) => { this.profileLoading = false; this.profileError = err?.error?.message || 'Failed to update.'; }
    });
  }

  changePassword(): void {
    this.passwordError = ''; this.passwordSuccess = '';
    if (!this.currentPassword) { this.passwordError = 'Current password is required.'; return; }
    if (this.newPassword.length < 6) { this.passwordError = 'New password must be at least 6 characters.'; return; }
    if (this.newPassword !== this.confirmNewPassword) { this.passwordError = 'Passwords do not match.'; return; }
    this.passwordLoading = true;
    this.http.put<any>(`${this.apiUrl}/auth/change-password`,
      { currentPassword: this.currentPassword, newPassword: this.newPassword },
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.passwordLoading = false;
        if (res.success) { this.passwordSuccess = 'Password changed!'; this.currentPassword = ''; this.newPassword = ''; this.confirmNewPassword = ''; }
        else { this.passwordError = res.message || 'Failed.'; }
      },
      error: (err) => { this.passwordLoading = false; this.passwordError = err?.error?.message || 'Check your current password.'; }
    });
  }

  saveNotifications(): void { this.notifSuccess = 'Saved!'; setTimeout(() => this.notifSuccess = '', 3000); }
  savePrivacy(): void { this.privacySuccess = 'Saved!'; setTimeout(() => this.privacySuccess = '', 3000); }
  confirmDeleteAccount(): void {
    if (confirm('Delete your employer account? This is permanent.')) alert('Contact support@ruralconnect.com to complete deletion.');
  }

  get passwordStrength(): { level: string; color: string; width: string } {
    const p = this.newPassword; if (!p) return { level: '', color: '#ccc', width: '0%' };
    let s = 0;
    if (p.length >= 6) s++; if (p.length >= 10) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    if (s <= 1) return { level: 'Weak', color: '#ef4444', width: '25%' };
    if (s === 2) return { level: 'Fair', color: '#f97316', width: '50%' };
    if (s === 3) return { level: 'Good', color: '#eab308', width: '75%' };
    return { level: 'Strong', color: '#22c55e', width: '100%' };
  }
}
