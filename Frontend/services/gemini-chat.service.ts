// src/services/gemini-chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../src/environments/environments';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiResponse {
  success: boolean;
  message: string;
  recommendations?: {
    matchedJobs: any[];
    skillGaps: string[];
    learningPaths: string[];
    careerAdvice: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GeminiChatService {
  private apiUrl = `${environment.apiUrl}/gemini`;

  constructor(private http: HttpClient) { }

  /**
   * Get initial career recommendations when user first opens AI Assistant
   */
  getInitialRecommendations(): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    return this.http.get<GeminiResponse>(
      `${this.apiUrl}/recommendations`,
      { headers }
    ).pipe(
      map(response => {
        console.log('Initial recommendations received:', response);
        return response;
      }),
      catchError(error => {
        console.error('Error getting initial recommendations:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Send a chat message to Gemini with conversation history
   */
  sendMessage(
    message: string,
    conversationHistory: ChatMessage[] = []
  ): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    const payload = {
      message: message,
      conversationHistory: conversationHistory
    };

    return this.http.post<GeminiResponse>(
      `${this.apiUrl}/chat`,
      payload,
      { headers }
    ).pipe(
      map(response => {
        console.log('Gemini chat response:', response);
        return response;
      }),
      catchError(error => {
        console.error('Error sending message to Gemini:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get job recommendations based on specific criteria
   */
  getJobRecommendations(filters?: {
    skillFocus?: string;
    location?: string;
    jobType?: string;
  }): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    const params: any = {};
    if (filters?.skillFocus) params.skillFocus = filters.skillFocus;
    if (filters?.location) params.location = filters.location;
    if (filters?.jobType) params.jobType = filters.jobType;

    return this.http.get<GeminiResponse>(
      `${this.apiUrl}/jobs`,
      { headers, params }
    ).pipe(
      catchError(error => {
        console.error('Error getting job recommendations:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get skill gap analysis and learning recommendations
   */
  getSkillGapAnalysis(): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    return this.http.get<GeminiResponse>(
      `${this.apiUrl}/skill-gaps`,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error getting skill gap analysis:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get career path recommendations
   */
  getCareerPathAdvice(): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    return this.http.get<GeminiResponse>(
      `${this.apiUrl}/career-path`,
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error getting career path advice:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Simulate adding a new skill and see its impact
   */
  simulateSkillAddition(skill: string): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    return this.http.post<GeminiResponse>(
      `${this.apiUrl}/simulate-skill`,
      { skill },
      { headers }
    ).pipe(
      catchError(error => {
        console.error('Error simulating skill addition:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get helper method for authorization headers
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }
}