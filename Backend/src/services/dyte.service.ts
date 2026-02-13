// services/dyte.service.ts - FIXED WITH CORRECT PRESET NAMES
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
  
  // ✅ FIX: Make preset names configurable
  private hostPresetName: string;
  private participantPresetName: string;

  constructor() {
    this.apiKey = process.env.DYTE_API_KEY || '';
    this.orgId = process.env.DYTE_ORG_ID || '';
    this.baseUrl = process.env.DYTE_API_URL || 'https://api.dyte.io/v2';
    
    // ✅ FIX: Use environment variables for preset names with fallbacks
    // Common preset names: 'host', 'moderator', 'webinar_presenter', 'group_call_host'
    this.hostPresetName = process.env.DYTE_HOST_PRESET || 'host';
    this.participantPresetName = process.env.DYTE_PARTICIPANT_PRESET || 'participant';

    console.log('🔧 Dyte Service Configuration:', {
      hasApiKey: !!this.apiKey,
      hasOrgId: !!this.orgId,
      baseUrl: this.baseUrl,
      hostPreset: this.hostPresetName,
      participantPreset: this.participantPresetName
    });

    if (!this.apiKey || !this.orgId) {
      console.error('❌ CRITICAL: Dyte credentials not configured!');
      console.error('Set DYTE_API_KEY and DYTE_ORG_ID in .env');
    }
  }

  private getHeaders() {
    const auth = Buffer.from(`${this.orgId}:${this.apiKey}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };
  }

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
        throw new Error('Dyte authentication failed. Check DYTE_API_KEY and DYTE_ORG_ID');
      }

      if (axiosError.response?.status === 404) {
        const errorData = axiosError.response?.data as any;
        if (errorData?.error?.message?.includes('preset')) {
          throw new Error(
            `Dyte preset not found! Current: "${this.hostPresetName}". ` +
            `Run: node check-dyte-presets.js to see available presets, ` +
            `then update DYTE_HOST_PRESET and DYTE_PARTICIPANT_PRESET in .env`
          );
        }
        throw new Error('Dyte API endpoint not found. Check DYTE_API_URL');
      }

      if (axiosError.response?.status === 403) {
        throw new Error('Dyte access forbidden. Check organization permissions');
      }

      // Handle 422 Unprocessable Content - often due to invalid preset names
      if (axiosError.response?.status === 422) {
        const errorData = axiosError.response?.data as any;
        const errorMessage = errorData?.error?.message || errorData?.message || 'Unprocessable Content';
        
        if (errorMessage.includes('preset') || errorMessage.includes('userpreset')) {
          throw new Error(
            `Dyte preset error (422): "${errorMessage}". ` +
            `Current presets: host="${this.hostPresetName}", participant="${this.participantPresetName}". ` +
            `Run: node Backend/check-dyte-presets.js to see available presets in your organization, ` +
            `then update DYTE_HOST_PRESET and DYTE_PARTICIPANT_PRESET in .env file. ` +
            `See Backend/DYTE_SETUP.md for detailed instructions.`
          );
        }
        throw new Error(`Dyte validation error (422): ${errorMessage}`);
      }

      const errorData = axiosError.response?.data as any;
      throw new Error(errorData?.error?.message || `Dyte ${context} failed: ${axiosError.message}`);
    }

    throw new Error(`Dyte ${context} failed: ${error.message}`);
  }

  async createMeeting(config: DyteMeetingConfig): Promise<DyteMeeting> {
    try {
      console.log('🎥 Creating Dyte meeting:', {
        title: `${config.trainingTitle} - ${config.sessionTitle}`,
        moderator: config.moderatorName,
        hostPreset: this.hostPresetName
      });

      if (!this.apiKey || !this.orgId) {
        throw new Error('Dyte credentials not configured');
      }

      // Create meeting
      const meetingPayload = {
        title: `${config.trainingTitle} - ${config.sessionTitle}`,
        preferred_region: 'ap-south-1',
        record_on_start: false,
        live_stream_on_start: false
      };

      console.log('📤 Creating meeting...');

      const createMeetingResponse = await axios.post(
        `${this.baseUrl}/meetings`,
        meetingPayload,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );

      const meetingData = createMeetingResponse.data.data;
      const meetingId = meetingData.id;

      console.log('✅ Meeting created:', meetingId);

      // ✅ FIX: Add moderator with correct preset name
      console.log(`👤 Adding moderator with preset: ${this.hostPresetName}`);
      
      const moderatorPayload = {
        name: config.moderatorName,
        preset_name: this.hostPresetName,  // ✅ Use configured preset
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

      console.log('✅ Dyte meeting fully configured');

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
      // ✅ FIX: Use correct preset based on role
      const presetName = role === 'host' 
        ? this.hostPresetName 
        : this.participantPresetName;

      console.log('👤 Adding participant:', { 
        meetingId, 
        userName, 
        role, 
        preset: presetName 
      });

      const response = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: userName,
          preset_name: presetName,  // ✅ Use correct preset
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
  
  // ✅ NEW: Method to fetch available presets
  async listPresets(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/presets`,
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      );
      
      return response.data.data || [];
    } catch (error: any) {
      console.error('❌ Failed to fetch presets:', error.message);
      return [];
    }
  }
}

export default new DyteService();