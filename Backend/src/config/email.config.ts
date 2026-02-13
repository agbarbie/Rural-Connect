// src/config/email.config.ts
import nodemailer from 'nodemailer';
import dns from 'dns';

// 🔧 Force IPv4 DNS resolution globally
dns.setDefaultResultOrder('ipv4first');

export const createEmailTransporter = () => {
  // Validate environment variables
  const { EMAIL_USER, EMAIL_PASSWORD, EMAIL_HOST, EMAIL_PORT } = process.env;
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.error('❌ Email configuration missing: EMAIL_USER or EMAIL_PASSWORD not set');
    throw new Error('Email service not configured');
  }

  const host = EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(EMAIL_PORT || '587');

  console.log('📧 Configuring email transporter...');
  console.log('Host:', host);
  console.log('Port:', port);
  console.log('User:', EMAIL_USER);
  console.log('IPv4 forced: YES');

  // Create Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD, // Use App Password if Gmail 2FA is enabled
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
    debug: process.env.NODE_ENV !== 'production',
    logger: process.env.NODE_ENV !== 'production',
    family: 4, // Force IPv4
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any); // 'any' bypasses TypeScript warnings

  // Test the connection on startup
  transporter.verify((error: Error | null, success: boolean) => {
    if (error) {
      console.error('❌ Email transporter verification failed');
      console.error('Error:', error.message);
    } else {
      console.log('✅ Email server ready to send messages');
    }
  });

  return transporter;
};

export default createEmailTransporter;
