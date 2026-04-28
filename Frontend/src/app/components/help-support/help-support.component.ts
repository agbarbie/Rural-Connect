import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../src/environments/environment.prod';

interface FAQ {
  question: string;
  answer: string;
  open: boolean;
}

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './help-support.component.html',
  styleUrl: './help-support.component.css'
})
export class HelpSupportComponent {
  activeTab: 'faq' | 'contact' | 'guides' = 'faq';
  searchQuery: string = '';

  // Contact form
  subject: string = '';
  message: string = '';
  contactLoading = false;
  contactSuccess = '';
  contactError = '';

  private apiUrl = environment.apiUrl;

  faqs: FAQ[] = [
    {
      question: 'How do I verify my email after signing up?',
      answer: 'After registering, we send a verification email to your inbox. Click the "Verify Email Address" button in that email. If you didn\'t receive it, check your spam folder. The link expires in 24 hours — contact support if you need a new one.',
      open: false
    },
    {
      question: 'I didn\'t receive a verification email. What should I do?',
      answer: 'First, check your spam or junk folder. If it\'s not there, make sure the email address you used is correct. You can also contact our support team and we will manually verify your account or resend the email.',
      open: false
    },
    {
      question: 'How do I reset my password?',
      answer: 'Click "Forgot Password?" on the login page, enter your registered email, and click "Send Reset Link". You\'ll receive an email with a link to set a new password. The reset link expires in 1 hour.',
      open: false
    },
    {
      question: 'Why is the reset password link not working?',
      answer: 'Reset links expire after 1 hour for security. If your link has expired, go back to the login page and request a new reset link. Make sure to use the link only once and in the same browser session.',
      open: false
    },
    {
      question: 'How do I apply for a training program?',
      answer: 'Go to Training in the left sidebar, browse available programs, and click "Apply" on any program you\'re interested in. You\'ll receive an email notification once the employer reviews your application.',
      open: false
    },
    {
      question: 'How do I join a virtual training session?',
      answer: 'When you\'re shortlisted for a training, you\'ll receive an invitation email with a Jitsi meeting link. You can also find the link on the Training page under "Upcoming Sessions". Join 5 minutes early to test your audio and video.',
      open: false
    },
    {
      question: 'How do I complete my profile?',
      answer: 'Click "Profile" in the sidebar and fill in your personal information, skills, experience level, and upload your CV. A complete profile increases your chances of being noticed by employers.',
      open: false
    },
    {
      question: 'Can I delete my account?',
      answer: 'Yes. Go to Settings → Security → Danger Zone and click "Delete Account". You will be prompted to confirm. Account deletion is permanent — please contact support if you\'d like to discuss alternatives.',
      open: false
    },
    {
      question: 'How do I update my notification preferences?',
      answer: 'Go to Settings → Notifications and toggle on or off the types of emails you want to receive, such as job alerts, training opportunities, or application updates.',
      open: false
    },
    {
      question: 'I\'m an employer. How do I post a training program?',
      answer: 'After logging in as an employer, click "Training" in the sidebar and then "Post New Training". Fill in the details, schedule, and requirements, and your training will be visible to job seekers.',
      open: false
    }
  ];

  get filteredFaqs(): FAQ[] {
    if (!this.searchQuery.trim()) return this.faqs;
    const q = this.searchQuery.toLowerCase();
    return this.faqs.filter(f =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }

  toggleFaq(faq: FAQ): void {
    faq.open = !faq.open;
  }

  sendMessage(): void {
    this.contactError = '';
    this.contactSuccess = '';
    if (!this.subject.trim()) { this.contactError = 'Please enter a subject.'; return; }
    if (!this.message.trim() || this.message.length < 20) { this.contactError = 'Please describe your issue in at least 20 characters.'; return; }

    this.contactLoading = true;
    // Simulate sending (in production this would hit a /support endpoint)
    setTimeout(() => {
      this.contactLoading = false;
      this.contactSuccess = 'Your message has been sent! Our support team will respond within 24 hours.';
      this.subject = '';
      this.message = '';
    }, 1500);
  }

  guides = [
    { icon: 'fas fa-user-plus', title: 'Getting Started', desc: 'Create your account, verify your email, and set up your profile in minutes.', steps: ['Sign up with your email', 'Verify your email address', 'Complete your profile', 'Start browsing opportunities'] },
    { icon: 'fas fa-search', title: 'Finding Opportunities', desc: 'Browse jobs and training programs matched to your skills and location.', steps: ['Use Job Explorer to filter by location/skill', 'Apply with one click', 'Track applications in the Applications tab', 'Get notified on status updates'] },
    { icon: 'fas fa-video', title: 'Virtual Training Sessions', desc: 'Join live training sessions via Jitsi Meet — no extra software needed.', steps: ['Get invited to a training session', 'Click the Jitsi link in your email', 'Test camera & mic before joining', 'Attend and earn your certificate'] },
    { icon: 'fas fa-file-alt', title: 'CV Builder & Portfolio', desc: 'Create a professional CV and showcase your work to employers.', steps: ['Go to CV Builder in the sidebar', 'Fill in your experience & skills', 'Download or share your CV link', 'Add portfolio projects too'] }
  ];
}
