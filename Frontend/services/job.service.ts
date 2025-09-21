// src/app/services/job.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../src/environments/environment.prod';

export interface Job {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  work_arrangement: 'Remote' | 'Hybrid' | 'On-site';
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  skills_required: string[];
  experience_level?: string;
  education_level?: string;
  benefits?: string[];
  department?: string;
  status: 'Open' | 'Closed' | 'Paused' | 'Filled';
  application_deadline?: string;
  is_featured: boolean;
  applications_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  employer_id: string;
  company_id: string;
  // Company details (from join)
  company_name?: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
}

export interface JobStats {
  total_jobs: number;
  active_jobs: number;
  paused_jobs: number;
  closed_jobs: number;
  total_applications: number;
  average_applications_per_job: number;
  featured_jobs_count: number;
  remote_jobs_count: number;
  hybrid_jobs_count: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  work_arrangement: 'Remote' | 'Hybrid' | 'On-site';
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  skills_required: string[];
  experience_level?: string;
  education_level?: string;
  benefits?: string[];
  department?: string;
  application_deadline?: string;
  is_featured?: boolean;
}

export interface JobQuery {
  page?: number;
  limit?: number;
  status?: 'Open' | 'Closed' | 'Paused' | 'Filled';
  employment_type?: string;
  work_arrangement?: string;
  search?: string;
  sort_by?: 'created_at' | 'salary_max' | 'applications_count' | 'views_count';
  sort_order?: 'ASC' | 'DESC';
  // Add these missing properties for salary filtering
  salary_min?: number;
  salary_max?: number;
  // Add these for additional filtering
  location?: string;
  skills?: string[];
  company_id?: string;
  employer_id?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  jobs: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private apiUrl = `${environment.apiUrl}/jobs`;
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Employer Job Management
  createJob(jobData: CreateJobRequest): Observable<ApiResponse<Job>> {
    return this.http.post<ApiResponse<Job>>(this.apiUrl, jobData, {
      headers: this.getAuthHeaders()
    });
  }

  getMyJobs(query?: JobQuery): Observable<ApiResponse<PaginatedResponse<Job>>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<Job>>>(`${this.apiUrl}/my-jobs`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  getJobById(jobId: string): Observable<ApiResponse<Job>> {
    return this.http.get<ApiResponse<Job>>(`${this.apiUrl}/${jobId}`, {
      headers: this.getAuthHeaders()
    });
  }

  updateJob(jobId: string, updateData: Partial<CreateJobRequest>): Observable<ApiResponse<Job>> {
    return this.http.put<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}`, updateData, {
      headers: this.getAuthHeaders()
    });
  }

  deleteJob(jobId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/employer/${jobId}`, {
      headers: this.getAuthHeaders()
    });
  }

  toggleJobStatus(jobId: string): Observable<ApiResponse<Job>> {
    return this.http.patch<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}/toggle-status`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  markJobAsFilled(jobId: string): Observable<ApiResponse<Job>> {
    return this.http.patch<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}/mark-filled`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  duplicateJob(jobId: string): Observable<ApiResponse<Job>> {
    return this.http.post<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}/duplicate`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  getJobStats(): Observable<ApiResponse<JobStats>> {
    return this.http.get<ApiResponse<JobStats>>(`${this.apiUrl}/stats`, {
      headers: this.getAuthHeaders()
    });
  }

  getJobApplications(jobId: string, query?: { page?: number; limit?: number; status?: string }): Observable<ApiResponse<any>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/employer/${jobId}/applications`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  // Public Job Browsing (for job seekers)
  getAllJobs(query?: JobQuery): Observable<ApiResponse<PaginatedResponse<Job>>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    const headers = this.getAuthHeaders();
    return this.http.get<ApiResponse<PaginatedResponse<Job>>>(this.apiUrl, {
      headers,
      params
    });
  }

  getJobDetails(jobId: string): Observable<ApiResponse<Job>> {
    return this.http.get<ApiResponse<Job>>(`${this.apiUrl}/details/${jobId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Jobseeker-specific endpoints
  getRecommendedJobs(query?: { page?: number; limit?: number }): Observable<ApiResponse<PaginatedResponse<Job>>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<Job>>>(`${this.apiUrl}/jobseeker/recommended`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  saveJob(jobId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/jobseeker/bookmark/${jobId}`, {}, {
      headers: this.getAuthHeaders()
    });
  }

  unsaveJob(jobId: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/jobseeker/bookmark/${jobId}`, {
      headers: this.getAuthHeaders()
    });
  }

  getSavedJobs(query?: { page?: number; limit?: number }): Observable<ApiResponse<PaginatedResponse<any>>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<any>>>(`${this.apiUrl}/jobseeker/bookmarked`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  applyToJob(jobId: string, applicationData: {
    coverLetter?: string;
    resumeId?: string;
    portfolioUrl?: string;
    expectedSalary?: number;
    availabilityDate?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/jobseeker/apply/${jobId}`, applicationData, {
      headers: this.getAuthHeaders()
    });
  }

  getAppliedJobs(query?: { page?: number; limit?: number; status?: string }): Observable<ApiResponse<PaginatedResponse<any>>> {
    let params = new HttpParams();
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<any>>>(`${this.apiUrl}/jobseeker/applications`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  getJobseekerStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/jobseeker/stats`, {
      headers: this.getAuthHeaders()
    });
  }

  // Utility methods
  formatSalary(min?: number, max?: number, currency: string = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

    if (min && max) {
      return `${formatter.format(min)} - ${formatter.format(max)}`;
    } else if (min) {
      return `From ${formatter.format(min)}`;
    } else if (max) {
      return `Up to ${formatter.format(max)}`;
    }
    return 'Salary not specified';
  }

  formatJobType(employment_type: string, work_arrangement: string): string {
    return `${employment_type} • ${work_arrangement}`;
  }

  // Update local jobs array
  updateJobsCache(jobs: Job[]): void {
    this.jobsSubject.next(jobs);
  }

  // Get local jobs array
  getJobsCache(): Job[] {
    return this.jobsSubject.value;
  }
}