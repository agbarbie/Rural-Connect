// src/services/candidates.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../src/environments/environment.prod';

export interface Candidate {
  email: any;
  id: string;
  application_id: string;
  name: string;
  title: string;
  profile_picture: string | null;
  match_score: number;
  skills: string[];
  certifications: Certification[];
  experience: string;
  recent_work: string;
  location: string;
  availability: string;
  application_status: string;
  applied_at: string;
  cover_letter: string;
  expected_salary: number;
  last_active: string;
  activity_status: string;
  job_id: string;
  job_title: string;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  is_shortlisted: boolean;
  is_selected: boolean;
  education: Education[];
}

export interface Certification {
  name: string;
  verified: boolean;
  progress: number;
  issued_date?: string;
  issuer?: string;
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
}

export interface JobPost {
  location: any;
  employment_type: any;
  applications_count: number;
  skills_required: any;
  experience_level: string;
  id: string;
  title: string;
  status: string;
  match_count: number;
  pending_count: number;
  reviewed_count: number;
  shortlisted_count: number;
  created_at: string;
}

export interface CandidatesQuery {
  job_id?: string;
  match_score_min?: number;
  location?: string;
  experience?: string;
  training?: string;
  sort_by?: 'match_score' | 'newest' | 'experience' | 'recent_activity';
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CandidatesService {
  private apiUrl = `${environment.apiUrl}/employer`;

  constructor(private http: HttpClient) {}

  /**
   * Get all candidates (applicants) for employer's jobs
   */
  getCandidates(query: CandidatesQuery = {}): Observable<ApiResponse<PaginatedResponse<Candidate>>> {
    let params = new HttpParams();
    
    if (query.job_id) params = params.set('job_id', query.job_id);
    if (query.match_score_min) params = params.set('match_score_min', query.match_score_min.toString());
    if (query.location) params = params.set('location', query.location);
    if (query.experience) params = params.set('experience', query.experience);
    if (query.training) params = params.set('training', query.training);
    if (query.sort_by) params = params.set('sort_by', query.sort_by);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());
    return this.http.get<ApiResponse<PaginatedResponse<Candidate>>>(`${this.apiUrl}/candidates`, { params });
  }

  /**
   * Get employer's job posts with application counts
   */
  getJobPosts(): Observable<ApiResponse<JobPost[]>> {
    return this.http.get<ApiResponse<JobPost[]>>(`${this.apiUrl}/job-posts`);
  }

  /**
   * Get candidate full profile
   */
  getCandidateProfile(userId: string, jobId?: string): Observable<ApiResponse<any>> {
    let params = new HttpParams();
    if (jobId) params = params.set('jobId', jobId);
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/candidates/${userId}`, { params });
  }

  /**
   * Toggle shortlist status for a candidate
   */
  toggleShortlist(userId: string, jobId: string): Observable<ApiResponse<{ is_shortlisted: boolean }>> {
    return this.http.post<ApiResponse<{ is_shortlisted: boolean }>>(
      `${this.apiUrl}/candidates/${userId}/shortlist`,
      { jobId }
    );
  }

  /**
   * Send invitation to candidate
   */
  inviteCandidate(userId: string, jobId: string, message: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/candidates/${userId}/invite`,
      { jobId, message }
    );
  }

  /**
   * Update application status
   */
  updateApplicationStatus(
    applicationId: string,
    status: string,
    notes?: string
  ): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${environment.apiUrl}/applications/${applicationId}/status`,
      { status, notes }
    );
  }

  /**
   * Send bulk invitations
   */
  sendBulkInvitations(
    userIds: string[],
    jobId: string,
    message: string
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/bulk-invite`,
      { userIds, jobId, message }
    );
  }

  /**
   * Schedule interview with candidate
   */
  scheduleInterview(data: {
    applicationId: string;
    candidateId: string;
    jobId: string;
    interview_date: string;
    interview_time: string;
    duration: number;
    interview_type: string;
    location?: string;
    meeting_link?: string;
    notes?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${environment.apiUrl}/interviews/schedule`,
      data
    );
  }
}