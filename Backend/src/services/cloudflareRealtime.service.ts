import axios from 'axios';

class CloudflareRealtimeService {
  private orgId: string;
  private apiKey: string;
  private baseUrl: string;
  private authHeader: string;

  constructor() {
    this.orgId = process.env.CLOUDFLARE_ORG_ID || '';
    this.apiKey = process.env.CLOUDFLARE_API_KEY || '';
    this.baseUrl = process.env.REALTIME_API_URL || 'https://api.realtime.cloudflare.com/v2';
    this.authHeader = `Basic ${Buffer.from(`${this.orgId}:${this.apiKey}`).toString('base64')}`;
  }

  // Create meeting room
  async createMeeting(title: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/meetings`,
        {
          title: title,
          preferred_region: 'ap-south-1',
          record_on_start: false,
          waiting_room: false
        },
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Create meeting error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Add participant and get token
  async addParticipant(meetingId: string, name: string, userId: string | number, role: 'employer' | 'jobseeker') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/meetings/${meetingId}/participants`,
        {
          name: name,
          preset_name: role === 'employer' ? 'host' : 'participant',
          client_specific_id: userId.toString()
        },
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Add participant error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get meeting details
  async getMeeting(meetingId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/meetings/${meetingId}`,
        {
          headers: {
            'Authorization': this.authHeader
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Get meeting error:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default new CloudflareRealtimeService();