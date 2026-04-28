import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface MeetingResponse {
  success: boolean;
  meetingId: string;
  meetingTitle: string;
  roomName: string;
  authToken: string;
  createdAt: string;
  training?: any;
}

export interface JoinResponse {
  success: boolean;
  meetingId: string;
  authToken: string;
  participantId: string;
  role: 'host' | 'participant';
  training?: {
    id: number;
    title: string;
    description: string;
    employerName: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CloudflareMeetingService {
  // Change this to your backend URL
  private apiUrl = 'https://rural-connect-3.onrender.com/api/meetings';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * EMPLOYER: Create meeting when creating training
   */
  createMeeting(trainingData: {
    trainingId: number;
    title: string;
  }): Observable<MeetingResponse> {
    return this.http.post<MeetingResponse>(`${this.apiUrl}/create`, trainingData);
  }

  /**
   * BOTH: Join an existing meeting
   */
  joinMeeting(meetingId: string): Observable<JoinResponse> {
    return this.http.get<JoinResponse>(`${this.apiUrl}/${meetingId}/join`);
  }

  /**
   * Get meeting details
   */
  getMeetingDetails(meetingId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${meetingId}`);
  }

  /**
   * EMPLOYER: End meeting
   */
  endMeeting(meetingId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${meetingId}/end`, {});
  }

  /**
   * EMPLOYER: Get active meetings
   */
  getActiveMeetings(): Observable<any> {
    return this.http.get(`${this.apiUrl}/employer/active`);
  }

  /**
   * JOBSEEKER: Get upcoming meetings
   */
  getUpcomingMeetings(): Observable<any> {
    return this.http.get(`${this.apiUrl}/jobseeker/upcoming`);
  }
}