// services/dyte.service.ts - CORRECTED DYTE INTEGRATION
import axios from 'axios';
import crypto from 'crypto';

interface DyteMeetingConfig {
  trainingId: string;
  sessionId: string;
  sessionTitle: string;
  trainingTitle: string;
  providerName: string;
  durationMinutes: number;
  moderatorId: string;
  moderatorName: string;
  moderatorEmail: string;
}

interface DyteMeeting {
  meetingUrl: string;
  roomName: string;
  password: string;
  moderatorToken: string;
  meetingId: string;
}

interface DyteParticipant {
  authToken: string;
  participantId: string;
  role: 'host' | 'participant';
}

export class DyteService {
  private authHeader: string;
  private baseUrl: string;
  private orgId: string;

  constructor() {
    this.authHeader = process.env.DYTE_AUTH_HEADER || '';
    this.baseUrl = process.env.DYTE_API_URL || 'https://api.dyte.io/v2';
    this.orgId = process.env.DYTE_ORG_ID || '';

    console.log('🔧 Dyte Service Configuration:', {
      hasAuthHeader: !!this.authHeader,
      hasOrgId: !!this.orgId,
      baseUrl: this.baseUrl
    });

    if (!this.authHeader || !this.orgId) {
      console.error('❌ DYTE_AUTH_HEADER or DYTE_ORG_ID not configured!');
    }
  }

  private getHeaders() {
    return {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a new Dyte meeting
   */
  async createMeeting(config: DyteMeetingConfig): Promise<DyteMeeting> {
    try {
      const roomName = `training_${config.trainingId}_session_${config.sessionId}`;
      
      console.log('🎥 Creating Dyte meeting:', {
        roomName,
        title: config.sessionTitle
      });

      // ✅ CORRECT: Dyte API endpoint
      const createMeetingResponse = await axios.post(
        `${this.baseUrl}/meetings`,
        {
          title: `${config.trainingTitle} - ${config.sessionTitle}`,
          preferred_region: 'ap-south-1',
          record_on_start: false,
          live_stream_on_start: false
        },
        {
          headers: this.getHeaders()
        }
      );

      const meetingData = createMeetingResponse.data.data;
      const meetingId = meetingData.id;

      console.log('✅ Meeting created:', meetingId);

      // Add moderator
      const moderatorResponse = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: config.moderatorName,
          preset_name: 'group_call_host',
          custom_participant_id: config.moderatorId
        },
        {
          headers: this.getHeaders()
        }
      );

      const moderatorToken = moderatorResponse.data.data.token;
      const meetingUrl = `https://app.dyte.io/meeting?id=${meetingId}`;
      const password = this.generateMeetingPassword();

      console.log('✅ Dyte meeting created successfully');

      return {
        meetingUrl,
        roomName,
        password,
        moderatorToken,
        meetingId
      };
    } catch (error: any) {
      console.error('❌ Dyte API Error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      });

      if (error.response?.status === 401) {
        throw new Error('Dyte authentication failed. Check DYTE_AUTH_HEADER and DYTE_ORG_ID.');
      }

      throw new Error(`Failed to create Dyte meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Add participant to existing meeting
   */
  async addParticipant(
    meetingId: string,
    userName: string,
    userId: string,
    role: 'host' | 'participant'
  ): Promise<DyteParticipant> {
    try {
      const presetName = role === 'host' ? 'group_call_host' : 'group_call_participant';

      const response = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: userName,
          preset_name: presetName,
          custom_participant_id: userId
        },
        {
          headers: this.getHeaders()
        }
      );

      const participantData = response.data.data;

      return {
        authToken: participantData.token,
        participantId: participantData.id,
        role: role
      };
    } catch (error: any) {
      console.error('❌ Add participant error:', error.response?.data || error.message);
      throw new Error(`Failed to add participant: ${error.message}`);
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: this.getHeaders()
        }
      );

      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get meeting: ${error.message}`);
    }
  }

  /**
   * Get join URL
   */
  getJoinUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/${meetingId}?authToken=${authToken}`;
  }

  /**
   * Get iframe URL
   */
  getIframeUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/${meetingId}?authToken=${authToken}&embed=true`;
  }

  /**
   * Generate random meeting password
   */
  private generateMeetingPassword(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}

export default new DyteService();