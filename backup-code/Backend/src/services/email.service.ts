// src/services/email.service.ts
import { createEmailTransporter } from '../config/email.config';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface VerificationEmailData {
  email: string;
  name: string;
  userId: string;
}

export interface TrainingInvitationData {
  trainingTitle: string;
  jitsiLink: string;
  scheduledDate: string;
  scheduledTime: string;
  employerName: string;
  trainingId: string;
  sessionId?: string;
}

export interface NewTrainingNotificationData {
  trainingTitle: string;
  description: string;
  employerName: string;
  category: string;
  postedDate: string;
  trainingId: string;
}

export class EmailService {
  private transporter = createEmailTransporter();
  private fromEmail = process.env.EMAIL_FROM || 'Digital Skilling App <noreply@digitalskilling.com>';
  private appUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  private apiUrl = process.env.API_URL || 'http://localhost:5000';

  /**
   * Send generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: options.from || this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending email:', error.message);
      return false;
    }
  }

  /**
   * Send verification email to new users
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<boolean> {
    try {
      // Generate verification token (valid for 24 hours)
      const verificationToken = jwt.sign(
        { userId: data.userId, email: data.email },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🌾 Digital Skilling App</div>
              <h1>Welcome to Digital Skilling!</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.name},</h2>
              <p>Thank you for signing up with Digital Skilling App! We're excited to have you join our community of learners and employers.</p>
              <p>Please verify your email address by clicking the button below:</p>
              <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </center>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea; background: #f0f0f0; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
              <p><strong>⏰ This link will expire in 24 hours.</strong></p>
              <p>If you didn't create an account with Digital Skilling App, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
              <p>Your Skills. Your Future. One Platform.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: data.email,
        subject: 'Verify Your Email - Digital Skilling App',
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending verification email:', error.message);
      return false;
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, name: string, userType: 'jobseeker' | 'employer' | 'admin'): Promise<boolean> {
    try {
      const dashboardUrl = `${this.appUrl}/${userType}/dashboard`;

      const userTypeContent = {
        jobseeker: {
          title: 'Welcome, Job Seeker!',
          features: `
            <ul>
              <li>🎯 Browse training opportunities tailored to your skills</li>
              <li>📝 Apply for training programs</li>
              <li>💼 Join live virtual training sessions via Jitsi</li>
              <li>📊 Track your training progress</li>
              <li>🏆 Earn certificates upon completion</li>
              <li>📈 Build your skills portfolio</li>
            </ul>
          `,
        },
        employer: {
          title: 'Welcome, Employer!',
          features: `
            <ul>
              <li>📢 Post training opportunities</li>
              <li>👥 Review and shortlist applicants</li>
              <li>🎓 Conduct virtual training sessions via Jitsi</li>
              <li>✅ Mark attendance and completion</li>
              <li>🏅 Issue digital certificates</li>
              <li>📊 Track participant progress and analytics</li>
            </ul>
          `,
        },
        admin: {
          title: 'Welcome, Administrator!',
          features: `
            <ul>
              <li>👥 Manage users and permissions</li>
              <li>📊 Monitor platform activity</li>
              <li>🔍 Review and moderate content</li>
              <li>📈 Access system analytics</li>
              <li>⚙️ Configure platform settings</li>
            </ul>
          `,
        },
      };

      const content = userTypeContent[userType];

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            ul { text-align: left; }
            li { margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ${content.title}</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Your email has been verified successfully! Welcome to the Digital Skilling App community.</p>
              
              <h3>What you can do now:</h3>
              ${content.features}

              <center>
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </center>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>Happy ${userType === 'jobseeker' ? 'learning' : 'training'}!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: 'Welcome to Digital Skilling App! 🎉',
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending welcome email:', error.message);
      return false;
    }
  }

  /**
   * Send training invitation with Jitsi meeting link
   */
  async sendTrainingInvitation(email: string, name: string, data: TrainingInvitationData): Promise<boolean> {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .info-box { background-color: white; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .checklist { background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
            ul { margin: 10px 0; }
            li { margin: 8px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Training Session Invitation</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Great news! You've been invited to join a training session.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0;">${data.trainingTitle}</h3>
                <p><strong>📅 Date:</strong> ${data.scheduledDate}</p>
                <p><strong>🕐 Time:</strong> ${data.scheduledTime}</p>
                <p><strong>👤 Trainer:</strong> ${data.employerName}</p>
                <p><strong>🔗 Platform:</strong> Jitsi Meet (built-in video conferencing)</p>
              </div>

              <center>
                <a href="${data.jitsiLink}" class="button">Join Training Session</a>
              </center>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #3b82f6; background: #f0f0f0; padding: 10px; border-radius: 5px;">${data.jitsiLink}</p>
              
              <div class="checklist">
                <h3>📋 Before the session:</h3>
                <ul>
                  <li>✅ Test your camera and microphone</li>
                  <li>✅ Find a quiet place with good lighting</li>
                  <li>✅ Have a notepad ready for notes</li>
                  <li>✅ Join 5 minutes early to avoid delays</li>
                  <li>✅ Use headphones for better audio quality</li>
                </ul>
              </div>

              <p><strong>💡 Tip:</strong> Make sure you have a stable internet connection for the best experience.</p>
              <p>We look forward to seeing you there!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: `Training Invitation: ${data.trainingTitle}`,
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending training invitation:', error.message);
      return false;
    }
  }

  /**
   * Send notification about new training opportunity
   */
  async sendNewTrainingNotification(email: string, name: string, data: NewTrainingNotificationData): Promise<boolean> {
    try {
      const trainingUrl = `${this.appUrl}/jobseeker/trainings/${data.trainingId}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .badge { display: inline-block; background-color: #f59e0b; color: white; padding: 5px 15px; border-radius: 15px; font-size: 12px; font-weight: bold; margin: 10px 0; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .description { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Training Opportunity!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>A new training opportunity that might interest you has been posted!</p>
              
              <h3>${data.trainingTitle}</h3>
              <span class="badge">${data.category}</span>
              
              <p><strong>Posted by:</strong> ${data.employerName}</p>
              <p><strong>Posted on:</strong> ${data.postedDate}</p>
              
              <div class="description">
                <strong>Description:</strong>
                <p>${data.description}</p>
              </div>

              <center>
                <a href="${trainingUrl}" class="button">View Training Details & Apply</a>
              </center>
              
              <p>Don't miss this opportunity to enhance your skills and advance your career!</p>
              
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                You're receiving this email because you've expressed interest in training opportunities. 
                <a href="${this.appUrl}/jobseeker/settings/notifications">Update your notification preferences</a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: `New Training: ${data.trainingTitle}`,
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending training notification:', error.message);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, userId: string): Promise<boolean> {
    try {
      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { userId, email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>We received a request to reset your password for your Digital Skilling App account.</p>
              <p>Click the button below to create a new password:</p>
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #ef4444; background: #f0f0f0; padding: 10px; border-radius: 5px;">${resetUrl}</p>
              
              <div class="warning">
                <p style="margin: 0;"><strong>⏰ This link will expire in 1 hour.</strong></p>
              </div>

              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: 'Password Reset Request - Digital Skilling App',
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending password reset email:', error.message);
      return false;
    }
  }

  /**
   * Send application status update email
   */
  async sendApplicationStatusEmail(
    email: string,
    name: string,
    trainingTitle: string,
    status: 'shortlisted' | 'rejected' | 'enrolled',
    message?: string
  ): Promise<boolean> {
    try {
      const statusConfig = {
        shortlisted: {
          color: '#10b981',
          icon: '🎯',
          title: 'You\'ve Been Shortlisted!',
          action: 'The employer is reviewing your application positively.',
        },
        rejected: {
          color: '#ef4444',
          icon: '❌',
          title: 'Application Update',
          action: 'Unfortunately, your application was not selected this time.',
        },
        enrolled: {
          color: '#8b5cf6',
          icon: '🎉',
          title: 'Congratulations! You\'re Enrolled!',
          action: 'You have been officially enrolled in the training program.',
        },
      };

      const config = statusConfig[status];

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${config.color}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .status-box { background: white; padding: 20px; border-left: 4px solid ${config.color}; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.icon} ${config.title}</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <div class="status-box">
                <h3 style="margin-top: 0;">${trainingTitle}</h3>
                <p><strong>Status:</strong> ${status.toUpperCase()}</p>
                <p>${config.action}</p>
                ${message ? `<p><strong>Message from employer:</strong><br>${message}</p>` : ''}
              </div>
              ${status === 'enrolled' ? '<p>You will receive further details about the training schedule soon. Stay tuned!</p>' : ''}
              ${status === 'rejected' ? '<p>Don\'t be discouraged! Keep exploring other training opportunities on our platform.</p>' : ''}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: `Training Application Update: ${trainingTitle}`,
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending application status email:', error.message);
      return false;
    }
  }

  /**
   * Send certificate issuance email
   */
  async sendCertificateEmail(
    email: string,
    name: string,
    trainingTitle: string,
    certificateCode: string,
    certificateUrl?: string
  ): Promise<boolean> {
    try {
      const verifyUrl = `${this.appUrl}/verify-certificate?code=${certificateCode}`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px; }
            .certificate-box { background: white; padding: 25px; border: 3px solid #8b5cf6; margin: 20px 0; border-radius: 10px; text-align: center; }
            .certificate-code { font-size: 24px; font-weight: bold; color: #8b5cf6; letter-spacing: 2px; margin: 15px 0; }
            .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏆 Congratulations!</h1>
              <p style="font-size: 18px; margin: 10px 0;">You've Earned Your Certificate!</p>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Congratulations on successfully completing your training!</p>
              
              <div class="certificate-box">
                <h3 style="color: #8b5cf6; margin-top: 0;">Certificate of Completion</h3>
                <h4 style="margin: 15px 0;">${trainingTitle}</h4>
                <p><strong>Verification Code:</strong></p>
                <div class="certificate-code">${certificateCode}</div>
                <p style="font-size: 12px; color: #666;">Use this code to verify your certificate</p>
              </div>

              <center>
                ${certificateUrl ? `<a href="${certificateUrl}" class="button">Download Certificate</a>` : ''}
                <a href="${verifyUrl}" class="button">Verify Certificate</a>
              </center>

              <p>Share your achievement with potential employers and add it to your portfolio!</p>
              <p>This certificate demonstrates your commitment to professional development and skill enhancement.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Digital Skilling App. All rights reserved.</p>
              <p>Your Skills. Your Future. One Platform.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.sendEmail({
        to: email,
        subject: `🏆 Your Certificate: ${trainingTitle}`,
        html,
      });
    } catch (error: any) {
      console.error('❌ Error sending certificate email:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;