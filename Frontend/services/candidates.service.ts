// frontend/src/app/services/candidates.service.ts - ACTUALLY FIXED (ALL PROPERTIES OPTIONAL)

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../src/environments/environment.prod';

// ✅ Complete Candidate interface with RATINGS
export interface Candidate {
  // Basic info
  id: string;
  application_id: string;
  name: string;
  email: string;
  phone?: string;
  
  // Profile info
  title: string;
  profile_picture: string | null;
  bio?: string;
  location: string;
  
  // Match and skills
  match_score: number;
  skills: string[];
  certifications: Certification[];
  
  // Experience
  experience: string;
  years_of_experience?: number;
  current_position?: string;
  recent_work: string;
  
  // Availability
  availability: string;
  availability_status?: string;
  
  // Application details
  application_status: string;
  applied_at: string;
  cover_letter: string;
  expected_salary: number;
  
  // Activity
  last_active: string;
  activity_status: string;
  
  // Job details
  job_id: string;
  job_title: string;
  
  // Social links
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  
  // Status flags
  is_shortlisted: boolean;
  is_selected: boolean;
  
  // Education
  education: Education[];
  
  // Career preferences
  preferred_job_types?: string[];
  preferred_locations?: string[];
  salary_expectation_min?: number;
  salary_expectation_max?: number;
  
  // ✅ Rating information
  average_rating?: number;
  total_ratings?: number;
  would_hire_again_count?: number;
  success_rate?: number;
}

export interface Certification {
  name: string;
  verified: boolean;
  progress?: number;
  issued_date?: string;
  issuer?: string;
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
}

// ✅ FIXED: All properties optional
export interface SkillsRating {
  technical?: number;
  communication?: number;
  professionalism?: number;
  quality?: number;
  timeliness?: number;
}

export interface RatingEmployer {
  name: string;
  role: string;
  company_name: string;
  company_industry?: string;
  company_size?: string;
  company_location?: string;
  company_description?: string;
  company_website?: string;
  company_logo?: string;
}

export interface Rating {
  id: string;
  rating: number;
  feedback: string;
  would_hire_again: boolean;
  task_description?: string;
  created_at: string;
  employer: RatingEmployer;
  job_title?: string;
  skills_rating?: SkillsRating;
}

export interface RatingStats {
  average_rating?: number;          // ✅ Now optional
  total_ratings?: number;           // ✅ Now optional
  would_hire_again_count?: number;
  rating_distribution?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  success_rate?: number;            // ✅ Now optional
  skill_ratings?: SkillsRating;
}

// ✅ Profile with ratings - rating_stats is optional
export interface CandidateProfile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  profile_image: string;
  bio: string;
  title: string;
  years_of_experience: number;
  current_position: string;
  availability_status: string;
  skills: string[];
  social_links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  application?: {
    id: string;
    status: string;
    cover_letter: string;
    expected_salary: number;
    availability_date: string;
    applied_at: string;
  };
  preferences: {
    job_types: string[];
    locations: string[];
    salary_min: number;
    salary_max: number;
  };
  rating_stats?: RatingStats;
  ratings?: Rating[];
}

export interface JobPost {
  id: string;
  title: string;
  status: string;
  match_count: number;
  pending_count: number;
  reviewed_count: number;
  shortlisted_count: number;
  created_at: string;
  applications_count: number;
  location?: string;
  employment_type?: string;
  skills_required?: string[];
  experience_level?: string;
}

export interface CandidatesQuery {
  job_id?: string;
  match_score_min?: number;
  location?: string;
  experience?: string;
  training?: string;
  sort_by?: 'match_score' | 'newest' | 'experience' | 'recent_activity' | 'highestRated';
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

  getJobPosts(): Observable<ApiResponse<JobPost[]>> {
    return this.http.get<ApiResponse<JobPost[]>>(`${this.apiUrl}/job-posts`);
  }

  getCandidateProfile(userId: string, jobId?: string): Observable<ApiResponse<CandidateProfile>> {
    const params = jobId ? new HttpParams().set('jobId', jobId) : new HttpParams();

    return this.http.get<ApiResponse<CandidateProfile>>(
      `${this.apiUrl}/candidates/${userId}`,
      { headers: this.getHeaders(), params }
    ).pipe(
      map(response => {
        if (response?.success && response.data?.profile_image) {
          response.data.profile_image = this.getFullImageUrl(response.data.profile_image);
        }
        return response;
      })
    );
  }

  private getHeaders(): { [header: string]: string } {
    return {};
  }

  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;

    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }

    return imagePath;
  }

  toggleShortlist(userId: string, jobId: string): Observable<ApiResponse<{ is_shortlisted: boolean }>> {
    return this.http.post<ApiResponse<{ is_shortlisted: boolean }>>(
      `${this.apiUrl}/candidates/${userId}/shortlist`,
      { jobId }
    );
  }

  inviteCandidate(userId: string, jobId: string, message: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/candidates/${userId}/invite`,
      { jobId, message }
    );
  }

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

  getStarArray(rating: number): number[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) stars.push(1);
    if (hasHalfStar && fullStars < 5) stars.push(0.5);
    const remaining = 5 - stars.length;
    for (let i = 0; i < remaining; i++) stars.push(0);

    return stars;
  }

  formatRatingDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  getRatingPercentage(count: number, total: number): number {
    if (total === 0) return 0;
    return (count / total) * 100;
  }
}