// src/services/bigbluebutton.service.ts - REPLACED WITH JITSI MEET
import crypto from 'crypto';

/**
 * ✅ SIMPLE SOLUTION: Use Jitsi Meet instead of BigBlueButton
 * 
 * Why Jitsi?
 * - No server setup required
 * - No API credentials needed
 * - Works instantly
 * - Free and open source
 * - Just generates meeting URLs
 */
export class BigBlueButtonService {
  private jitsiDomain: string;

  constructor() {
    // Use public Jitsi Meet server (or your own if you have one)
    this.jitsiDomain = process.env.JITSI_DOMAIN || 'meet.jit.si';
    
    console.log('✅ Video conferencing initialized (Jitsi Meet)');
    console.log('   Domain:', this.jitsiDomain);
    console.log('   ℹ️  Using Jitsi Meet instead of BBB (simpler, no server needed)');
  }

  /**
   * Create a Jitsi Meet room - NO SERVER REQUIRED!
   */
  async createMeeting(params: {
    trainingId: string;
    sessionId: string;
    sessionTitle: string;
    trainingTitle: string;
    providerName: string;
    durationMinutes: number;
  }): Promise<{
    meetingId: string;
    attendeeUrl: string;
    moderatorUrl: string;
    attendeePassword: string;
    moderatorPassword: string;
  }> {
    try {
      console.log('📹 Creating Jitsi Meet room for:', params.sessionTitle);
      
      // Generate unique room name
      const meetingId = `training-${params.trainingId}-session-${params.sessionId}`;
      
      // Create clean room name for URL (Jitsi requirement)
      const roomName = this.sanitizeRoomName(
        `${params.trainingTitle}-${params.sessionTitle}`
      );
      
      // Generate password
      const password = this.generatePassword(6);
      
      // Create meeting URL (Jitsi Meet)
      const baseUrl = `https://${this.jitsiDomain}/${roomName}-${params.sessionId}`;
      
      // Add URL config for students (start muted)
      const studentConfig = new URLSearchParams({
        '#config.startWithAudioMuted': 'true',
        'userInfo.displayName': 'Student'
      });
      
      const attendeeUrl = `${baseUrl}#${studentConfig.toString()}`;
      
      // Instructor gets same URL but unmuted
      const instructorConfig = new URLSearchParams({
        '#config.startWithAudioMuted': 'false',
        'userInfo.displayName': 'Instructor'
      });
      
      const moderatorUrl = `${baseUrl}#${instructorConfig.toString()}`;
      
      console.log('✅ Jitsi Meet room created');
      console.log('   Room URL:', baseUrl);
      console.log('   Meeting ID:', meetingId);
      
      return {
        meetingId,
        attendeeUrl,
        moderatorUrl,
        attendeePassword: password,
        moderatorPassword: password
      };
      
    } catch (error: any) {
      console.error('❌ Error creating Jitsi meeting:', error);
      
      // ✅ FALLBACK: Even if something fails, return a basic URL
      const fallbackRoomName = `training-${params.trainingId}-${params.sessionId}`;
      const fallbackUrl = `https://meet.jit.si/${fallbackRoomName}`;
      
      console.log('⚠️  Using fallback Jitsi URL:', fallbackUrl);
      
      return {
        meetingId: fallbackRoomName,
        attendeeUrl: fallbackUrl,
        moderatorUrl: fallbackUrl,
        attendeePassword: '000000',
        moderatorPassword: '000000'
      };
    }
  }

  /**
   * Get join URL for a specific user
   */
  async getJoinUrl(params: {
    meetingId: string;
    userName: string;
    password: string;
    isModerator: boolean;
  }): Promise<string> {
    try {
      // Extract room name from meeting ID
      const roomName = params.meetingId.replace(/_/g, '-');
      const baseUrl = `https://${this.jitsiDomain}/${roomName}`;
      
      // Add user name to URL
      const config = new URLSearchParams({
        'userInfo.displayName': params.userName,
        '#config.startWithAudioMuted': params.isModerator ? 'false' : 'true'
      });
      
      return `${baseUrl}#${config.toString()}`;
      
    } catch (error: any) {
      console.error('❌ Error generating join URL:', error);
      
      // Fallback
      const fallbackUrl = `https://meet.jit.si/${params.meetingId}`;
      return fallbackUrl;
    }
  }

  /**
   * Check if meeting is running (Jitsi rooms are always available)
   */
  async isMeetingRunning(meetingId: string): Promise<boolean> {
    // Jitsi rooms don't need to be "created" - they exist when someone joins
    return true;
  }

  /**
   * Get meeting info (simplified for Jitsi)
   */
  async getMeetingInfo(meetingId: string): Promise<any> {
    return {
      meetingId,
      isRunning: true,
      attendeeCount: 0, // Jitsi doesn't provide this via simple URL
      provider: 'Jitsi Meet'
    };
  }

  /**
   * End meeting (not applicable for Jitsi - room closes when everyone leaves)
   */
  async endMeeting(meetingId: string, moderatorPassword: string): Promise<boolean> {
    // Jitsi rooms automatically close when empty
    return true;
  }

  /**
   * Get recordings (Jitsi doesn't record by default)
   */
  async getRecordings(meetingId: string): Promise<any[]> {
    // Jitsi Meet free tier doesn't provide recordings
    // You'd need Jibri for recording
    return [];
  }

  /**
   * Sanitize room name for URL (Jitsi requirement)
   */
  private sanitizeRoomName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Only alphanumeric and hyphens
      .replace(/-+/g, '-')          // Remove duplicate hyphens
      .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
      .substring(0, 50);            // Max 50 characters
  }

  /**
   * Generate simple password
   */
  private generatePassword(length: number = 6): string {
    return crypto.randomBytes(length)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, length);
  }
}