// src/app/services/job.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../src/environments/environments';
import { AuthService } from './auth.service';

interface User {
  id: string;
  company_id?: string;
  user_type?: string;
  // add other properties as needed
}

export interface Job {
  skills?: any;
  rating?: any;
  salary?: any;
  postedDays?: any;
  type?: any;
  matchScore?: any;
  company?: any;
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
  company_name?: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
  // Optional runtime fields used by the frontend (not persisted by API)
  has_applied?: boolean;
  application_status?: string | null;
}

export interface JobStats {
  overview: {
    total_jobs: number;
    active_jobs: number;
    filled_jobs: number;
    paused_jobs: number;
    closed_jobs: number;
    total_applications: number;
    total_views: number;
    avg_applications_per_job: string;
    avg_views_per_job: string;
    featured_jobs_count: number;
    remote_jobs_count: number;
    hybrid_jobs_count: number;
  };
  recent_activity: {
    jobs_posted_last_30_days: number;
    applications_last_30_days: number;
  };
  top_performing_jobs: Array<{
    id: string;
    title: string;
    applications_count: number;
    views_count: number;
    status: string;
    created_at: string;
  }>;
  application_status_breakdown: {
    pending: number;
    reviewing: number;
    shortlisted: number;
    interviewed: number;
    offered: number;
    hired: number;
    rejected: number;
  };
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
  employer_id?: string;
  company_id?: string;
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
  salary_min?: number;
  salary_max?: number;
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
  data: PaginatedResponse<any>;
  jobs: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class JobService {
  withdrawApplication(jobId: string) {
    throw new Error('Method not implemented.');
  }
  private apiUrl = `${environment.apiUrl}/jobs`;
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  // 🔥 NEW: Observable for real-time application updates
  private applicationUpdateSubject = new BehaviorSubject<{
    jobId: string;
    count: number;
  } | null>(null);
  public applicationUpdate$ = this.applicationUpdateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();

    if (!token) {
      console.error('No authentication token found in localStorage');
      throw new Error('Authentication required: No token found');
    }

    console.log('Using token for API call:', token.substring(0, 20) + '...');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private getUserInfoFromAuth(): {
    userId: string | null;
    companyId: string | null;
    userType: string | null;
  } {
    const user = this.authService.getCurrentUser();

    if (!user) {
      console.warn('No authenticated user found in AuthService');
      return { userId: null, companyId: null, userType: null };
    }

    console.log('Current user from AuthService:', {
      id: user.id,
      user_type: user.user_type,
    });

    const userId = user.id || null;
    const companyId = user.company_id || null;
    const userType = user.user_type || null;

    console.log(
      'Extracted - User ID:',
      userId,
      'Company ID:',
      companyId,
      'User Type:',
      userType,
    );

    return { userId, companyId, userType };
  }

  withdrawApplicationByJobId(jobId: string): Observable<ApiResponse<void>> {
    if (!this.authService.isAuthenticated()) {
      console.error('withdrawApplicationByJobId: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('🔄 Withdrawing application for job ID:', jobId);

    return this.http
      .delete<
        ApiResponse<void>
      >(`${this.apiUrl}/jobseeker/withdraw/${jobId}`, { headers: this.getAuthHeaders() })
      .pipe(
        tap((response) => {
          console.log('✅ Withdraw application response:', response);

          if (response.success) {
            // Remove from appliedJobIds cache
            this.appliedJobIds = this.appliedJobIds.filter(
              (id) => id !== jobId,
            );

            // Update local jobs cache
            const jobs = this.jobsSubject.value;
            const jobIndex = jobs.findIndex((j) => j.id === jobId);

            if (jobIndex !== -1) {
              jobs[jobIndex] = {
                ...jobs[jobIndex],
                has_applied: false,
                application_status: undefined,
              };
              this.jobsSubject.next([...jobs]);
            }

            console.log('✅ Local state updated after withdrawal');
          }
        }),
        catchError((error) => {
          console.error('❌ Error withdrawing application:', error);

          let errorMsg = 'Failed to withdraw application. Please try again.';

          if (error.status === 401) {
            errorMsg = '🔐 Please log in to withdraw applications';
            this.authService.logout();
          } else if (error.status === 404) {
            errorMsg = 'Application not found or already withdrawn';
            // Clean up local state anyway
            this.appliedJobIds = this.appliedJobIds.filter(
              (id) => id !== jobId,
            );
          } else if (error.status === 400) {
            errorMsg =
              error.error?.message || 'Cannot withdraw this application';
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }

          return throwError(() => ({ ...error, userMessage: errorMsg }));
        }),
      );
  }

  // Also add a helper property to track appliedJobIds
  private appliedJobIds: string[] = [];

  // Add getter/setter methods
  getAppliedJobIds(): string[] {
    return [...this.appliedJobIds];
  }

  setAppliedJobIds(ids: string[]): void {
    this.appliedJobIds = [...ids];
  }

  addAppliedJobId(jobId: string): void {
    if (!this.appliedJobIds.includes(jobId)) {
      this.appliedJobIds.push(jobId);
    }
  }

  removeAppliedJobId(jobId: string): void {
    this.appliedJobIds = this.appliedJobIds.filter((id) => id !== jobId);
  }

  createJob(jobData: CreateJobRequest): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      console.error('User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    const { userId, companyId, userType } = this.getUserInfoFromAuth();

    if (userType !== 'employer') {
      console.error('User is not an employer:', userType);
      return throwError(() => ({
        error: { message: 'Only employers can create jobs' },
      }));
    }

    const enhancedJobData: CreateJobRequest = {
      ...jobData,
      employer_id: jobData.employer_id ?? userId ?? undefined,
      company_id: jobData.company_id ?? companyId ?? undefined,
    };

    console.log('Creating job with data:', enhancedJobData);

    if (!enhancedJobData.employer_id) {
      console.error('No employer ID available');
      return throwError(() => ({
        error: {
          message: 'Employer ID is required but not found in user data',
        },
      }));
    }

    return this.http
      .post<ApiResponse<Job>>(this.apiUrl, enhancedJobData, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Create job response:', response)),
        catchError((error) => {
          console.error('Job creation error:', error);
          if (error.status === 403) {
            console.error(
              '403 Forbidden: User may not have employer permissions or job ownership mismatch',
            );
          } else if (error.status === 401) {
            console.error('401 Unauthorized: Token may be expired or invalid');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getMyJobs(query?: JobQuery): Observable<ApiResponse<PaginatedResponse<Job>>> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log('Fetching my jobs with params:', params.toString());

    return this.http
      .get<ApiResponse<PaginatedResponse<Job>>>(`${this.apiUrl}/my-jobs`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        tap((response) => {
          console.log('Get my jobs response:', response);
          // 🔥 Update cache when fetching jobs
          if (response.success && response.data && response.data.jobs) {
            this.updateJobsCache(response.data.jobs);
          }
        }),
        catchError((error) => {
          console.error('Error fetching my jobs:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getJobById(jobId: string): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('Fetching job by ID:', jobId);

    return this.http
      .get<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Get job by ID response:', response)),
        catchError((error) => {
          console.error('Error fetching job by ID:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  updateJob(
    jobId: string,
    updateData: Partial<CreateJobRequest>,
  ): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('Updating job ID:', jobId, 'with data:', updateData);

    return this.http
      .put<ApiResponse<Job>>(`${this.apiUrl}/employer/${jobId}`, updateData, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Update job response:', response)),
        catchError((error) => {
          console.error('Error updating job:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  deleteJob(jobId: string): Observable<ApiResponse<void>> {
    if (!this.authService.isAuthenticated()) {
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('Deleting job ID:', jobId);

    return this.http
      .delete<ApiResponse<void>>(`${this.apiUrl}/employer/${jobId}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Delete job response:', response)),
        catchError((error) => {
          console.error('Error deleting job:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  toggleJobStatus(jobId: string): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      console.error('toggleJobStatus: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    const { userId, userType } = this.getUserInfoFromAuth();

    if (userType !== 'employer') {
      console.error('toggleJobStatus: User is not an employer:', userType);
      return throwError(() => ({
        error: { message: 'Only employers can toggle job status' },
      }));
    }

    console.log('Toggling status for job ID:', jobId, 'User ID:', userId);

    return this.http
      .patch<ApiResponse<Job>>(
        `${this.apiUrl}/employer/${jobId}/toggle-status`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      )
      .pipe(
        tap((response) => console.log('Toggle job status response:', response)),
        catchError((error) => {
          console.error('Error toggling job status for job ID:', jobId, error);
          if (error.status === 403) {
            console.error(
              '403 Forbidden: Check if user is employer and owns the job',
            );
            console.error('Error details:', error.error);
          } else if (error.status === 401) {
            console.error('401 Unauthorized: Token may be expired or invalid');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  markJobAsFilled(jobId: string): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      console.error('markJobAsFilled: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('Marking job as filled ID:', jobId);

    return this.http
      .patch<ApiResponse<Job>>(
        `${this.apiUrl}/employer/${jobId}/mark-filled`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      )
      .pipe(
        tap((response) =>
          console.log('Mark job as filled response:', response),
        ),
        catchError((error) => {
          console.error('Error marking job as filled:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  duplicateJob(jobId: string): Observable<ApiResponse<Job>> {
    if (!this.authService.isAuthenticated()) {
      console.error('duplicateJob: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    const { userId, userType } = this.getUserInfoFromAuth();

    if (userType !== 'employer') {
      console.error('duplicateJob: User is not an employer:', userType);
      return throwError(() => ({
        error: { message: 'Only employers can duplicate jobs' },
      }));
    }

    console.log('Duplicating job ID:', jobId, 'User ID:', userId);

    return this.http
      .post<ApiResponse<Job>>(
        `${this.apiUrl}/employer/${jobId}/duplicate`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      )
      .pipe(
        tap((response) => console.log('Duplicate job response:', response)),
        catchError((error) => {
          console.error('Error duplicating job for job ID:', jobId, error);
          if (error.status === 403) {
            console.error(
              '403 Forbidden: Check if user is employer and owns the job',
            );
            console.error('Error details:', error.error);
          } else if (error.status === 401) {
            console.error('401 Unauthorized: Token may be expired or invalid');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getJobStats(): Observable<ApiResponse<JobStats>> {
    console.log('=== JOB STATS DEBUG ===');
    console.log('Is authenticated:', this.authService.isAuthenticated());
    console.log('Current user:', this.authService.getCurrentUser());
    console.log('User type:', this.authService.getUserType());
    console.log('Is employer:', this.authService.isEmployer());
    console.log('=======================');

    if (!this.authService.isAuthenticated()) {
      console.error('getJobStats: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    if (!this.authService.isEmployer()) {
      console.error('getJobStats: User is not an employer');
      return throwError(() => ({
        error: { message: 'Only employers can access job statistics' },
      }));
    }

    return this.http
      .get<ApiResponse<JobStats>>(`${this.apiUrl}/stats`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Get job stats response:', response)),
        catchError((error) => {
          console.error('Error fetching job stats:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          } else if (error.status === 404) {
            console.error('404 Not Found: Stats endpoint not found');
            console.error('Full URL attempted:', `${this.apiUrl}/stats`);
          }
          return throwError(() => error);
        }),
      );
  }

  getJobApplications(
    jobId: string,
    query?: { page?: number; limit?: number; status?: string },
  ): Observable<ApiResponse<any>> {
    if (!this.authService.isAuthenticated()) {
      console.error('getJobApplications: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log(
      'Fetching applications for job ID:',
      jobId,
      'with params:',
      params.toString(),
    );

    return this.http
      .get<ApiResponse<any>>(`${this.apiUrl}/employer/${jobId}/applications`, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        tap((response) =>
          console.log('Get job applications response:', response),
        ),
        catchError((error) => {
          console.error('Error fetching job applications:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getAllJobs(
    query?: JobQuery,
  ): Observable<ApiResponse<PaginatedResponse<Job>>> {
    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log('Fetching all jobs with params:', params.toString());

    return this.http
      .get<ApiResponse<PaginatedResponse<Job>>>(this.apiUrl, {
        headers: this.getAuthHeaders(),
        params,
      })
      .pipe(
        tap((response) => console.log('Get all jobs response:', response)),
        catchError((error) => {
          console.error('Error fetching all jobs:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getJobDetails(jobId: string): Observable<ApiResponse<Job>> {
    console.log('Fetching job details for ID:', jobId);

    return this.http
      .get<ApiResponse<Job>>(`${this.apiUrl}/details/${jobId}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => console.log('Get job details response:', response)),
        catchError((error) => {
          console.error('Error fetching job details:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getRecommendedJobs(query?: {
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<PaginatedResponse<Job>>> {
    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log('Fetching recommended jobs with params:', params.toString());

    return this.http
      .get<ApiResponse<PaginatedResponse<Job>>>(
        `${this.apiUrl}/jobseeker/recommended`,
        {
          headers: this.getAuthHeaders(),
          params,
        },
      )
      .pipe(
        tap((response) =>
          console.log('Get recommended jobs response:', response),
        ),
        catchError((error) => {
          console.error('Error fetching recommended jobs:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  saveJob(jobId: string): Observable<ApiResponse<any>> {
    if (!this.authService.isAuthenticated()) {
      console.error('saveJob: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('JobService.saveJob - Saving job ID:', jobId);

    return this.http
      .post<ApiResponse<any>>(
        `${this.apiUrl}/jobseeker/bookmark/${jobId}`,
        {},
        {
          headers: this.getAuthHeaders(),
        },
      )
      .pipe(
        tap((response) => {
          console.log('JobService.saveJob - Response:', response);
        }),
        catchError((error) => {
          console.error('JobService.saveJob - Error:', error);
          console.error('JobService.saveJob - Error status:', error.status);
          console.error('JobService.saveJob - Error body:', error.error);

          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  unsaveJob(jobId: string): Observable<ApiResponse<any>> {
    if (!this.authService.isAuthenticated()) {
      console.error('unsaveJob: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    console.log('JobService.unsaveJob - Unsaving job ID:', jobId);

    return this.http
      .delete<ApiResponse<any>>(`${this.apiUrl}/jobseeker/bookmark/${jobId}`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) => {
          console.log('JobService.unsaveJob - Response:', response);
        }),
        catchError((error) => {
          console.error('JobService.unsaveJob - Error:', error);
          console.error('JobService.unsaveJob - Error status:', error.status);
          console.error('JobService.unsaveJob - Error body:', error.error);

          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getSavedJobs(query?: {
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<PaginatedResponse<any>>> {
    if (!this.authService.isAuthenticated()) {
      console.error('getSavedJobs: User is not authenticated');
      return throwError(() => ({
        error: { message: 'Authentication required. Please log in again.' },
      }));
    }

    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log(
      'JobService.getSavedJobs - Fetching with params:',
      params.toString(),
    );

    return this.http
      .get<ApiResponse<PaginatedResponse<any>>>(
        `${this.apiUrl}/jobseeker/bookmarked`,
        {
          headers: this.getAuthHeaders(),
          params,
        },
      )
      .pipe(
        tap((response) => {
          console.log('JobService.getSavedJobs - Response:', response);
        }),
        catchError((error) => {
          console.error('JobService.getSavedJobs - Error:', error);

          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  // 🔥 CRITICAL FIX: Enhanced applyToJob with real-time update notification
  applyToJob(
    jobId: string,
    applicationData: {
      coverLetter?: string;
      resumeId?: string;
      portfolioUrl?: string;
      expectedSalary?: number;
      availabilityDate?: string;
    },
  ): Observable<ApiResponse<any>> {
    console.log('🚀 Applying to job ID:', jobId, 'with data:', applicationData);

    return this.http
      .post<ApiResponse<any>>(
        `${this.apiUrl}/jobseeker/apply/${jobId}`,
        applicationData,
        {
          headers: this.getAuthHeaders(),
        },
      )
      .pipe(
        tap((response) => {
          console.log('✅ Apply to job response:', response);

          if (response.success) {
            // 🔥 IMMEDIATELY INCREMENT LOCAL COUNT
            this.incrementApplicationCount(jobId);

            // 🔥 NOTIFY ALL SUBSCRIBERS (Employer dashboard) of the update
            const currentJob = this.jobsSubject.value.find(
              (j) => j.id === jobId,
            );
            const newCount = currentJob ? currentJob.applications_count : 1;

            this.applicationUpdateSubject.next({ jobId, count: newCount });

            console.log('🔔 Application update broadcast:', {
              jobId,
              count: newCount,
            });
          }
        }),
        catchError((error) => {
          console.error('❌ Error applying to job:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getAppliedJobs(query?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Observable<ApiResponse<PaginatedResponse<any>>> {
    let params = new HttpParams();

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }

    console.log('Fetching applied jobs with params:', params.toString());

    return this.http
      .get<ApiResponse<PaginatedResponse<any>>>(
        `${this.apiUrl}/jobseeker/applications`,
        {
          headers: this.getAuthHeaders(),
          params,
        },
      )
      .pipe(
        tap((response) => console.log('Get applied jobs response:', response)),
        catchError((error) => {
          console.error('Error fetching applied jobs:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  getJobseekerStats(): Observable<ApiResponse<any>> {
    console.log('Fetching jobseeker stats');

    return this.http
      .get<ApiResponse<any>>(`${this.apiUrl}/jobseeker/stats`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) =>
          console.log('Get jobseeker stats response:', response),
        ),
        catchError((error) => {
          console.error('Error fetching jobseeker stats:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  formatSalary(min?: number, max?: number, currency: string = 'KSh'): string {
    // Always use KSh regardless of currency parameter
    const currencySymbol = 'KSh';

    // Format numbers with commas for thousands (Kenyan locale)
    const formatNumber = (num: number): string => {
      return num.toLocaleString('en-KE');
    };

    if (min && max) {
      return `${currencySymbol} ${formatNumber(min)} - ${formatNumber(max)}`;
    } else if (min) {
      return `${currencySymbol} ${formatNumber(min)}+`;
    } else if (max) {
      return `Up to ${currencySymbol} ${formatNumber(max)}`;
    }

    return 'Not specified';
  }

  formatJobType(employment_type: string, work_arrangement: string): string {
    return `${employment_type} • ${work_arrangement}`;
  }

  updateJobsCache(jobs: Job[]): void {
    console.log('Updating jobs cache with:', jobs);
    this.jobsSubject.next(jobs);
  }

  getJobsCache(): Job[] {
    console.log('Retrieving jobs cache:', this.jobsSubject.value);
    return this.jobsSubject.value;
  }

  debugAuthInfo(): void {
    console.log('=== AUTH DEBUG INFO ===');
    console.log('Is authenticated:', this.authService.isAuthenticated());
    console.log('Current user:', this.authService.getCurrentUser());
    console.log('Token exists:', !!this.authService.getToken());
    console.log('User type:', this.authService.getUserType());
    console.log('Is employer:', this.authService.isEmployer());
    console.log('========================');
  }

  verifyToken(): Observable<ApiResponse<any>> {
    console.log('Verifying token with backend');
    return this.http
      .get<ApiResponse<any>>(`${this.apiUrl}/verify-token`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(
        tap((response) =>
          console.log('Token verification response:', response),
        ),
        catchError((error) => {
          console.error('Token verification failed:', error);
          if (error.status === 401) {
            console.error('401 Unauthorized: Clearing auth data');
            this.authService.logout();
          }
          return throwError(() => error);
        }),
      );
  }

  /**
   * 🔥 CRITICAL: Increment application count locally (optimistic update)
   */
  incrementApplicationCount(jobId: string): void {
    const jobs = this.jobsSubject.value;
    const jobIndex = jobs.findIndex((j) => j.id === jobId);

    if (jobIndex !== -1) {
      jobs[jobIndex] = {
        ...jobs[jobIndex],
        applications_count: jobs[jobIndex].applications_count + 1,
      };
      this.jobsSubject.next([...jobs]);
      console.log(
        `✅ Incremented application count for job ${jobId} to ${jobs[jobIndex].applications_count}`,
      );
    } else {
      console.warn(`⚠️ Job ${jobId} not found in cache for increment`);
    }
  }

  /**
   * 🔥 CRITICAL: Refresh a specific job's data from backend
   */
  refreshJobData(jobId: string): Observable<void> {
    return this.getJobById(jobId).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const jobs = this.jobsSubject.value;
          const jobIndex = jobs.findIndex((j) => j.id === jobId);

          if (jobIndex !== -1) {
            jobs[jobIndex] = response.data;
            this.jobsSubject.next([...jobs]);
            console.log(`✅ Refreshed job data for ${jobId}`, response.data);
          }
        }
      }),
      map(() => void 0),
      catchError((error) => {
        console.error('Error refreshing job data:', error);
        return of(void 0);
      }),
    );
  }

  getNotifications(params: {
    read?: boolean;
    page?: number;
    limit?: number;
  }): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    if (params.read !== undefined) {
      httpParams = httpParams.set('read', params.read.toString());
    }
    if (params.page)
      httpParams = httpParams.set('page', params.page.toString());
    if (params.limit)
      httpParams = httpParams.set('limit', params.limit.toString());

    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/notifications`, {
      headers: this.getAuthHeaders(),
      params: httpParams,
    });
  }

  markNotificationRead(notificationId: string): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {},
      { headers: this.getAuthHeaders() },
    );
  }

  markAllNotificationsRead(): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(
      `${this.apiUrl}/notifications/mark-all-read`,
      {},
      { headers: this.getAuthHeaders() },
    );
  }

  deleteNotification(notificationId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/notifications/${notificationId}`,
      { headers: this.getAuthHeaders() },
    );
  }

  /**
   * 🔥 NEW: Force refresh all jobs with latest data from backend
   */
  forceRefreshJobs(): Observable<ApiResponse<PaginatedResponse<Job>>> {
    console.log('🔄 Force refreshing all jobs from backend...');

    const query = {
      page: 1,
      limit: 1000, // Get all jobs
      sort_by: 'created_at' as const,
      sort_order: 'DESC' as const,
    };

    return this.getMyJobs(query).pipe(
      tap((response) => {
        if (response.success && response.data) {
          console.log('✅ Force refresh completed with latest data');
        }
      }),
    );
  }
}
