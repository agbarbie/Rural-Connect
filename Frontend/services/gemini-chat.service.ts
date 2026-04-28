// src/app/services/gemini-chat.service.ts - COMPLETE FIXED VERSION
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiResponse {
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
   * FOR JOBSEEKERS ONLY
   */
  getInitialRecommendations(): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    return this.http.get<GeminiResponse>(
      `${this.apiUrl}/recommendations`,
      { headers }
    ).pipe(
      map(response => {
        console.log('✅ Initial recommendations received:', response);
        return response;
      }),
      catchError(error => {
        console.error('❌ Error getting initial recommendations:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * JOBSEEKER: Send a chat message to Gemini with conversation history
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

    console.log('💬 [Jobseeker] Sending message:', message);

    return this.http.post<GeminiResponse>(
      `${this.apiUrl}/chat`,
      payload,
      { headers }
    ).pipe(
      map(response => {
        console.log('✅ [Jobseeker] Gemini chat response:', response);
        return response;
      }),
      catchError(error => {
        console.error('❌ [Jobseeker] Error sending message to Gemini:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * EMPLOYER: Send a chat message with employer context (jobs, trainings, candidates)
   * THIS IS THE KEY METHOD FOR EMPLOYER CANDIDATE ANALYSIS
   */
  sendEmployerMessage(
    message: string,
    conversationHistory: ChatMessage[] = [],
    context: {
      jobs: any[];
      trainings: any[];
      candidates: any[];
      selectedJob: any;
    }
  ): Observable<GeminiResponse> {
    const headers = this.getHeaders();
    
    const payload = {
      message: message,
      conversationHistory: conversationHistory,
      context: context
    };

    console.log('📤 [Employer] Sending chat with context:', {
      message: message,
      jobs: context.jobs.length,
      trainings: context.trainings.length,
      candidates: context.candidates.length,
      trainingTitles: context.trainings.map(t => t.title),
      selectedJob: context.selectedJob?.title || 'All Jobs'
    });

    return this.http.post<GeminiResponse>(
      `${this.apiUrl}/employer-chat`,
      payload,
      { headers }
    ).pipe(
      map(response => {
        console.log('✅ [Employer] Chat response received:', {
          success: response.success,
          messageLength: response.message?.length || 0,
          hasRecommendations: !!response.recommendations
        });
        return response;
      }),
      catchError(error => {
        console.error('❌ [Employer] Error in employer chat:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Get job recommendations based on specific criteria
   * FOR JOBSEEKERS
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
   * FOR JOBSEEKERS
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
   * FOR JOBSEEKERS
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
   * FOR JOBSEEKERS
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
    
    if (!token) {
      console.warn('⚠️ No authentication token found');
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }
}