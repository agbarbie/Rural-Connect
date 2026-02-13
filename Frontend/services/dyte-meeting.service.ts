// services/dyte-meeting.service.ts - COMPLETE
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../src/environments/environment.prod';

export interface DyteJoinResponse {
  success: boolean;
  data: {
    joinUrl: string;
    authToken: string;
    meetingId: string;
    role: 'moderator' | 'participant';
    session?: {
      title: string;
      training_title: string;
      scheduled_at: string;
    };
  };
}

export interface DyteIframeResponse {
  success: boolean;
  data: {
    iframeUrl: string;
    session?: {
      title: string;
      training_title: string;
      scheduled_at: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class DyteMeetingService {
  private readonly API_BASE = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  joinMeeting(sessionId: string): Observable<DyteJoinResponse> {
    return this.http.get<DyteJoinResponse>(
      `${this.API_BASE}/trainings/sessions/${sessionId}/join`,
      { headers: this.getAuthHeaders() }
    );
  }

  getIframeUrl(sessionId: string): Observable<DyteIframeResponse> {
    return this.http.get<DyteIframeResponse>(
      `${this.API_BASE}/trainings/sessions/${sessionId}/iframe`,
      { headers: this.getAuthHeaders() }
    );
  }

  getMeetingDetails(meetingId: string): Observable<any> {
    return this.http.get(
      `${this.API_BASE}/meetings/${meetingId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  endMeeting(meetingId: string): Observable<any> {
    return this.http.post(
      `${this.API_BASE}/meetings/${meetingId}/end`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }
}