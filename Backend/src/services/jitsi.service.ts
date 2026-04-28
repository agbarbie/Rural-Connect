// services/dyte.service.ts - COMPLETE FIXED VERSION
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
  private orgId: string;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.orgId = process.env.DYTE_ORG_ID || '';
    this.apiKey = process.env.DYTE_API_KEY || '';
    this.baseUrl = process.env.DYTE_API_URL || 'https://api.dyte.io/v2';
    
    if (!this.orgId || !this.apiKey) {
      console.warn('⚠️  Dyte credentials not configured');
    }
  }

  async createMeeting(config: DyteMeetingConfig): Promise<DyteMeeting> {
    try {
      const roomName = `training_${config.trainingId}_session_${config.sessionId}_${Date.now()}`;
      
      console.log('🎥 Creating Dyte meeting:', {
        roomName,
        title: config.sessionTitle,
        moderator: config.moderatorName
      });

      const meetingResponse = await axios.post(
        `${this.baseUrl}/meetings`,
        {
          title: `${config.trainingTitle} - ${config.sessionTitle}`,
          preferred_region: 'ap-south-1',
          record_on_start: false,
          live_stream_on_start: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const meetingId = meetingResponse.data.data.id;

      const moderatorResponse = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: config.moderatorName,
          preset_name: 'group_call_host',
          custom_participant_id: config.moderatorId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const moderatorToken = moderatorResponse.data.data.token;
      const meetingUrl = `https://app.dyte.io/meeting?id=${meetingId}`;
      const password = this.generateMeetingPassword();

      console.log('✅ Dyte meeting created successfully:', {
        meetingId,
        roomName,
        moderator: config.moderatorName
      });

      return {
        meetingUrl,
        roomName,
        password,
        moderatorToken,
        meetingId
      };
    } catch (error: any) {
      console.error('❌ Dyte createMeeting error:', error.response?.data || error.message);
      throw new Error(`Failed to create Dyte meeting: ${error.message}`);
    }
  }

  async addParticipant(
    meetingId: string,
    userName: string,
    userId: string,
    role: 'host' | 'participant'
  ): Promise<DyteParticipant> {
    try {
      console.log('👤 Adding participant to Dyte meeting:', {
        meetingId,
        userName,
        role
      });

      const presetName = role === 'host' ? 'group_call_host' : 'group_call_participant';

      const response = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: userName,
          preset_name: presetName,
          custom_participant_id: userId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Participant added successfully');

      return {
        authToken: response.data.data.token,
        participantId: response.data.data.id,
        role: role
      };
    } catch (error: any) {
      console.error('❌ Dyte addParticipant error:', error.response?.data || error.message);
      throw new Error(`Failed to add participant: ${error.message}`);
    }
  }

  async getMeeting(meetingId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('❌ Dyte getMeeting error:', error.response?.data || error.message);
      throw new Error(`Failed to get meeting: ${error.message}`);
    }
  }

  async endMeeting(meetingId: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/active-session/kick-all`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      console.log('✅ Meeting ended successfully');
    } catch (error: any) {
      console.error('❌ Dyte endMeeting error:', error.response?.data || error.message);
      throw new Error(`Failed to end meeting: ${error.message}`);
    }
  }

  // ✅ FIX: Add missing getJoinUrl method
  getJoinUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/meeting?id=${meetingId}&authToken=${authToken}`;
  }

  // ✅ FIX: Add missing getIframeUrl method
  getIframeUrl(meetingId: string, authToken: string): string {
    return `https://app.dyte.io/meeting?id=${meetingId}&authToken=${authToken}&embed=true`;
  }

  private generateMeetingPassword(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}

export default new DyteService();