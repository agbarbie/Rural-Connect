// src/app/services/rating.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

export interface Rating {
  id: string;
  employer_id: string;
  jobseeker_id: string;
  job_id?: string;
  application_id?: string;
  rating: number; // 1-5 stars
  feedback: string;
  skills_rating?: {
    technical: number;
    communication: number;
    professionalism: number;
    quality: number;
    timeliness: number;
  };
  task_description?: string;
  would_hire_again: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated jobseeker fields
  jobseeker_name?: string;
  jobseeker_email?: string;
  jobseeker_profile_image?: string;
  
  // Populated employer fields
  employer_name?: string;
  employer_email?: string;
  employer_image?: string;
  
  // Job information
  job_title?: string;
  
  // ✅ Company information fields
  company_name?: string;
  role_in_company?: string;
  company_industry?: string;
  company_location?: string;
  company_description?: string;
  company_size?: string;
  company_website?: string;
  company_logo?: string;
  
  // ✅ Additional employer verification fields
  verified_employer?: boolean;
  contract_type?: string;
}

export interface RatingStats {
  average_rating: number;
  total_ratings: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  skills_averages?: {
    technical: number;
    communication: number;
    professionalism: number;
    quality: number;
    timeliness: number;
  };
}

export interface CreateRatingRequest {
  jobseeker_id: string;
  job_id?: string;
  application_id?: string;
  rating: number;
  feedback: string;
  skills_rating?: {
    technical: number;
    communication: number;
    professionalism: number;
    quality: number;
    timeliness: number;
  };
  task_description?: string;
  would_hire_again: boolean;
  is_public: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RatingService {
  private apiUrl = `${environment.apiUrl}/ratings`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Create a new rating for a jobseeker
   */
  createRating(ratingData: CreateRatingRequest): Observable<ApiResponse<Rating>> {
    return this.http.post<ApiResponse<Rating>>(
      this.apiUrl,
      ratingData,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get ratings given by employer (ratings I gave)
   */
  getMyRatings(params?: {
    page?: number;
    limit?: number;
    jobseeker_id?: string;
  }): Observable<ApiResponse<{ ratings: Rating[]; pagination: any }>> {
    let url = `${this.apiUrl}/employer/given`;
    
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.jobseeker_id) queryParams.append('jobseeker_id', params.jobseeker_id);
      
      const queryString = queryParams.toString();
      if (queryString) url += `?${queryString}`;
    }

    return this.http.get<ApiResponse<{ ratings: Rating[]; pagination: any }>>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get ratings received by jobseeker (for their profile)
   */
  getJobseekerRatings(
    jobseekerId: string,
    params?: { page?: number; limit?: number; public_only?: boolean }
  ): Observable<ApiResponse<{ ratings: Rating[]; pagination: any }>> {
    let url = `${this.apiUrl}/jobseeker/${jobseekerId}`;
    
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.public_only !== undefined) {
        queryParams.append('public_only', params.public_only.toString());
      }
      
      const queryString = queryParams.toString();
      if (queryString) url += `?${queryString}`;
    }

    return this.http.get<ApiResponse<{ ratings: Rating[]; pagination: any }>>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get rating statistics for a jobseeker
   */
  getJobseekerStats(jobseekerId: string): Observable<ApiResponse<RatingStats>> {
    return this.http.get<ApiResponse<RatingStats>>(
      `${this.apiUrl}/jobseeker/${jobseekerId}/stats`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get a specific rating by ID
   */
  getRatingById(ratingId: string): Observable<ApiResponse<Rating>> {
    return this.http.get<ApiResponse<Rating>>(
      `${this.apiUrl}/${ratingId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing rating
   */
  updateRating(
    ratingId: string,
    updateData: Partial<CreateRatingRequest>
  ): Observable<ApiResponse<Rating>> {
    return this.http.put<ApiResponse<Rating>>(
      `${this.apiUrl}/${ratingId}`,
      updateData,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Delete a rating
   */
  deleteRating(ratingId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/${ratingId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Check if employer can rate a specific jobseeker for a job
   */
  canRateJobseeker(
    jobseekerId: string,
    jobId?: string
  ): Observable<ApiResponse<{ can_rate: boolean; reason?: string }>> {
    let url = `${this.apiUrl}/can-rate/${jobseekerId}`;
    if (jobId) {
      url += `?job_id=${jobId}`;
    }

    return this.http.get<ApiResponse<{ can_rate: boolean; reason?: string }>>(
      url,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get candidates eligible for rating (hired/completed applications)
   */
  getEligibleCandidatesForRating(): Observable<ApiResponse<{
    candidates: Array<{
      user_id: string;
      name: string;
      email: string;
      profile_image: string;
      job_id: string;
      job_title: string;
      application_id: string;
      application_status: string;
      hired_date?: string;
      already_rated: boolean;
    }>;
  }>> {
    return this.http.get<ApiResponse<any>>(
      `${this.apiUrl}/eligible-candidates`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Rating Service Error:', error);
    
    let errorMessage = 'An error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 0) {
      errorMessage = 'Network error - please check your connection';
    } else if (error.status === 401) {
      errorMessage = 'Unauthorized - please log in';
    } else if (error.status === 403) {
      errorMessage = 'Forbidden - you do not have permission';
    } else if (error.status === 404) {
      errorMessage = 'Resource not found';
    } else if (error.status === 409) {
      errorMessage = 'You have already rated this jobseeker for this job';
    } else if (error.status >= 500) {
      errorMessage = 'Server error - please try again later';
    }

    return throwError(() => ({
      status: error.status,
      message: errorMessage,
      error: error.error
    }));
  }
}