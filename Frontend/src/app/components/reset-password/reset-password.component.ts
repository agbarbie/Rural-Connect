import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent {
  email: string = '';

  onResetPassword(): void {
    console.log('Password reset requested for:', this.email);
  }
onBackToLogin(): void {
    console.log('Navigating back to login');
    window.location.href = '/auth'; 
  }

}
