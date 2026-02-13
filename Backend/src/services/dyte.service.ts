// services/dyte.service.ts - FIXED WITH PROPER ERROR HANDLING
import axios, { AxiosError } from 'axios';
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
  private apiKey: string;
  private orgId: string;
  private baseUrl: string;

  constructor() {
    // ✅ FIX 1: Proper credential loading with validation
    this.apiKey = process.env.DYTE_API_KEY || '';
    this.orgId = process.env.DYTE_ORG_ID || '';
    this.baseUrl = process.env.DYTE_API_URL || 'https://api.cluster.dyte.in/v2';

    console.log('🔧 Dyte Service Configuration:', {
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      hasOrgId: !!this.orgId,
      orgIdLength: this.orgId.length,
      baseUrl: this.baseUrl
    });

    // ✅ FIX 2: Early validation
    if (!this.apiKey || !this.orgId) {
      console.error('❌ CRITICAL: Dyte credentials not configured!');
      console.error('Please set DYTE_API_KEY and DYTE_ORG_ID in your .env file');
      console.error('Get these from: https://dev.dyte.io/apikeys');
    }
  }

  // ✅ FIX 3: Proper headers with Basic Auth
  private getHeaders() {
    const auth = Buffer.from(`${this.orgId}:${this.apiKey}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };
  }

  // ✅ FIX 4: Better error handling
  private handleDyteError(error: any, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`❌ Dyte ${context} Error:`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message,
        url: axiosError.config?.url
      });

      if (axiosError.response?.status === 401) {
        throw new Error('Dyte authentication failed. Check your DYTE_API_KEY and DYTE_ORG_ID');
      }

      if (axiosError.response?.status === 404) {
        throw new Error('Dyte API endpoint not found. Check your DYTE_API_URL or API version');
      }

      if (axiosError.response?.status === 403) {
        throw new Error('Dyte API access forbidden. Check your organization permissions');
      }

      const errorData = axiosError.response?.data as any;
      throw new Error(errorData?.message || `Dyte ${context} failed: ${axiosError.message}`);
    }

    throw new Error(`Dyte ${context} failed: ${error.message}`);
  }

  async createMeeting(config: DyteMeetingConfig): Promise<DyteMeeting> {
    try {
      console.log('🎥 Creating Dyte meeting:', {
        title: `${config.trainingTitle} - ${config.sessionTitle}`,
        moderator: config.moderatorName
      });

      // ✅ FIX 5: Test credentials first
      if (!this.apiKey || !this.orgId) {
        throw new Error('Dyte credentials not configured. Set DYTE_API_KEY and DYTE_ORG_ID');
      }

      // ✅ FIX 6: Create meeting with correct payload
      const meetingPayload = {
        title: `${config.trainingTitle} - ${config.sessionTitle}`,
        preferred_region: 'ap-south-1',
        record_on_start: false,
        live_stream_on_start: false
      };

      console.log('📤 Sending meeting creation request:', {
        url: `${this.baseUrl}/meetings`,
        payload: meetingPayload
      });

      const createMeetingResponse = await axios.post(
        `${this.baseUrl}/meetings`,
        meetingPayload,
        {
          headers: this.getHeaders(),
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('✅ Meeting created response:', {
        status: createMeetingResponse.status,
        data: createMeetingResponse.data
      });

      const meetingData = createMeetingResponse.data.data;
      const meetingId = meetingData.id;

      // ✅ FIX 7: Add moderator with correct preset
      console.log('👤 Adding moderator to meeting...');
      
      const moderatorPayload = {
        name: config.moderatorName,
        preset_name: 'group_call_host', // Standard Dyte preset
        custom_participant_id: config.moderatorId
      };

      const moderatorResponse = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        moderatorPayload,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      const moderatorToken = moderatorResponse.data.data.token;
      const meetingUrl = `https://app.dyte.io/${meetingId}`;
      const password = this.generateMeetingPassword();
      const roomName = `training_${config.trainingId}_session_${config.sessionId}`;

      console.log('✅ Dyte meeting fully configured:', {
        meetingId,
        roomName,
        meetingUrl
      });

      return {
        meetingUrl,
        roomName,
        password,
        moderatorToken,
        meetingId
      };

    } catch (error: any) {
      this.handleDyteError(error, 'Create Meeting');
    }
  }

  async addParticipant(
    meetingId: string,
    userName: string,
    userId: string,
    role: 'host' | 'participant'
  ): Promise<DyteParticipant> {
    try {
      const presetName = role === 'host' ? 'group_call_host' : 'group_call_participant';

      console.log('👤 Adding participant:', { meetingId, userName, role, presetName });

      const response = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: userName,
          preset_name: presetName,
          custom_participant_id: userId
        },
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      const participantData = response.data.data;

      return {
        authToken: participantData.token,
        participantId: participantData.id,
        role: role
      };
    } catch (error: any) {
      this.handleDyteError(error, 'Add Participant');
    }
  }

  async getMeeting(meetingId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      return response.data.data;
    } catch (error: any) {
      this.handleDyteError(error, 'Get Meeting');
    }
  }

  getJoinUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/${meetingId}?authToken=${authToken}`;
  }

  getIframeUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/${meetingId}?authToken=${authToken}&embed=true`;
  }

  private generateMeetingPassword(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  // ✅ FIX 8: Add health check method
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🏥 Testing Dyte API connection...');
      
      const response = await axios.get(
        `${this.baseUrl}/organizations/${this.orgId}`,
        {
          headers: this.getHeaders(),
          timeout: 5000
        }
      );

      console.log('✅ Dyte API connection successful');
      return true;
    } catch (error: any) {
      console.error('❌ Dyte API connection failed:', error.message);
      return false;
    }
  }
}

export default new DyteService();