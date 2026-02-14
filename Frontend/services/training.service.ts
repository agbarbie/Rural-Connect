// training.service.ts - FIXED VERSION
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

// ============================================
// INTERFACES (matching backend types)
// ============================================

export interface TrainingSession {
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url?: string;
  meeting_password?: string;
  order_index: number;
  is_completed?: boolean;
  attendance_count?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface TrainingOutcome {
  id?: string;
  training_id?: string;
  outcome_text: string;
  order_index: number;
  created_at?: Date;
}

export interface TrainingApplication {
  id?: string;
  training_id?: string;
  user_id?: string;
  motivation?: string;
  status: 'pending' | 'shortlisted' | 'rejected' | 'enrolled';  // ✅ Added 'enrolled'
  applied_at?: Date;
  reviewed_at?: Date;
  employer_notes?: string;
  
  // ✅ NEW: Enrollment tracking fields
  enrollment_id?: string;
  enrollment_status?: string;
  
  // ✅ Flattened user fields (from backend)
  user_name?: string;
  user_email?: string;
  phone_number?: string;
  motivation_letter?: string;
  
  // ✅ Nested user object (alternative structure)
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    profile_image?: string;
  };
}

export interface Training {
  meeting_id: any;
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  cost_type: 'Free' | 'Paid';
  price: number;
  mode: 'Online' | 'Offline';
  provider_id: string;
  provider_name: string;
  has_certificate: boolean;
  rating: number;
  total_students: number;
  thumbnail_url?: string;
  location?: string;
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  application_deadline?: Date;
  
  start_date?: Date;
  end_date?: Date;
  
  max_participants?: number;
  current_participants: number;
  status: 'draft' | 'published' | 'applications_closed' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
  
  // Relations
  sessions?: TrainingSession[];
  outcomes?: TrainingOutcome[];
  session_count?: number;
  
  // User-specific flags
  applied?: boolean;
  has_applied?: boolean;
  application_status?: 'pending' | 'shortlisted' | 'rejected';
  enrolled?: boolean;
  is_enrolled?: boolean;
  enrollment_id?: string;
  progress?: number;
  certificate_issued?: boolean;
  certificate_url?: string;
  certificate_code?: string;
  attendance_rate?: number;
  participation_score?: number;
  tasks_completed?: number;
  tasks_total?: number;
}

export interface CreateTrainingRequest {
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  cost_type: 'Free' | 'Paid';
  price?: number;
  mode: 'Online' | 'Offline';
  provider_name: string;
  has_certificate: boolean;
  thumbnail_url?: string;
  location?: string;
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  application_deadline?: string;
  start_date?: string;
  end_date?: string;
  max_participants?: number;
  sessions: TrainingSession[];
  outcomes: TrainingOutcome[];
}

export interface UpdateTrainingRequest extends Partial<CreateTrainingRequest> {
  status?: 'draft' | 'published' | 'applications_closed' | 'in_progress' | 'completed';
}

export interface TrainingStats {
  total_trainings: number;
  published_trainings: number;
  draft_trainings: number;
  total_applications: number;
  pending_applications: number;
  total_enrollments: number;
  total_revenue: number;
  avg_rating: number;
  completion_rate: number;
  certificates_issued: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface TrainingSearchParams {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'title' | 'rating' | 'total_students' | 'application_deadline';
  sort_order?: 'asc' | 'desc';
  category?: string;
  level?: string;
  search?: string;
  status?: string;
  cost_type?: string;
  mode?: string;
  has_certificate?: boolean;
  include_sessions?: boolean;
  include_outcomes?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  private readonly API_BASE = environment.apiUrl;
  private readonly TRAINING_ENDPOINT = `${this.API_BASE}/trainings`;
  private readonly NOTIFICATION_ENDPOINT = `${this.API_BASE}/notifications`;
  
  private trainingsSubject = new BehaviorSubject<Training[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  public trainings$ = this.trainingsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('No token found in localStorage');
      return new HttpHeaders({ 'Content-Type': 'application/json' });
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('❌ Service error:', error);
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.error?.errors) {
      errorMessage = Array.isArray(error.error.errors) 
        ? error.error.errors.join(', ') 
        : JSON.stringify(error.error.errors);
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('📝 Detailed error:', {
      message: errorMessage,
      status: error.status,
      body: error.error,
      headers: error.headers
    });
    
    this.errorSubject.next(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  private buildParams(params: TrainingSearchParams | Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;

      if (Array.isArray(value)) {
        value.forEach(v => {
          if (v === undefined || v === null) return;
          httpParams = httpParams.append(key, v.toString());
        });
        return;
      }

      if (typeof value === 'boolean') {
        httpParams = httpParams.set(key, value ? 'true' : 'false');
        return;
      }

      if (value instanceof Date) {
        httpParams = httpParams.set(key, value.toISOString());
        return;
      }

      if (typeof value === 'object') {
        httpParams = httpParams.set(key, JSON.stringify(value));
        return;
      }

      httpParams = httpParams.set(key, value.toString());
    });

    return httpParams;
  }

  private processTrainingData(training: any): Training {
    console.log('Processing training data:', training.id);
    
    let processedSessions: TrainingSession[] = [];
    if (training.sessions && Array.isArray(training.sessions)) {
      processedSessions = training.sessions.filter((s: any) => s !== null);
    }
    
    let processedOutcomes: TrainingOutcome[] = [];
    if (training.outcomes && Array.isArray(training.outcomes)) {
      processedOutcomes = training.outcomes.filter((o: any) => o !== null);
    }
    
    return {
      ...training,
      sessions: processedSessions.length > 0 ? processedSessions : undefined,
      outcomes: processedOutcomes.length > 0 ? processedOutcomes : undefined,
      session_count: training.session_count || processedSessions.length,
      applied: training.applied || false,
      has_applied: training.has_applied || training.applied || false,
      enrolled: training.enrolled || false,
      is_enrolled: training.is_enrolled || training.enrolled || false,
      progress: training.progress || 0,
      attendance_rate: training.attendance_rate || 0,
      participation_score: training.participation_score || 0,
      tasks_completed: training.tasks_completed || 0,
      tasks_total: training.tasks_total || 0
    };
  }

  // ============================================
  // EMPLOYER: TRAINING CRUD
  // ============================================

  getMyTrainings(params: TrainingSearchParams = {}, employerId: string): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    const enhancedParams = {
      ...params,
      include_sessions: true,
      include_outcomes: true
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    console.log('🔍 Fetching employer trainings:', { employerId, params: enhancedParams });
    
    return this.http.get<any>(
      this.TRAINING_ENDPOINT, 
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(
      map(response => {
        console.log('📥 Raw API response:', response);
        
        let trainings: Training[] = [];
        
        if (response.success && response.data?.trainings) {
          trainings = response.data.trainings;
        } else if (response.trainings) {
          trainings = response.trainings;
        } else if (Array.isArray(response.data)) {
          trainings = response.data;
        } else if (Array.isArray(response)) {
          trainings = response;
        }
        
        console.log('📦 Extracted trainings:', trainings.length);
        
        trainings = trainings.map(t => this.processTrainingData(t));
        
        return {
          success: true,
          data: { trainings },
          pagination: response.pagination || {
            current_page: 1,
            total_pages: 1,
            page_size: trainings.length,
            total_count: trainings.length,
            has_next: false,
            has_previous: false
          }
        };
      }),
      tap(response => {
        if (response.success && response.data?.trainings) {
          console.log('✅ Setting trainings in subject:', response.data.trainings.length);
          this.trainingsSubject.next(response.data.trainings);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  createTraining(trainingData: CreateTrainingRequest): Observable<ApiResponse<Training>> {
  this.loadingSubject.next(true);
  
  return this.http.post<ApiResponse<Training>>(
    this.TRAINING_ENDPOINT,
    trainingData,
    { headers: this.getAuthHeaders() }
  ).pipe(
    map(response => {
      if (response.success && response.data) {
        response.data = this.processTrainingData(response.data);
      }
      return response;
    }),
    // ✅ REMOVED: Manual array push - let component refresh handle it
    tap(() => {
      this.loadingSubject.next(false);
    }),
    catchError(error => {
      this.loadingSubject.next(false);
      return this.handleError(error);
    })
  );
}


  updateTraining(id: string, trainingData: UpdateTrainingRequest): Observable<ApiResponse<Training>> {
  this.loadingSubject.next(true);
  
  return this.http.put<ApiResponse<Training>>(
    `${this.TRAINING_ENDPOINT}/${id}`,
    trainingData,
    { headers: this.getAuthHeaders() }
  ).pipe(
    map(response => {
      if (response.success && response.data) {
        response.data = this.processTrainingData(response.data);
      }
      return response;
    }),
    // ✅ REMOVED: Manual array update - let component refresh handle it
    tap(() => {
      this.loadingSubject.next(false);
    }),
    catchError(error => {
      this.loadingSubject.next(false);
      return this.handleError(error);
    })
  );
}

// ✅ Join session as participant
joinSession(sessionId: string): Observable<ApiResponse<{ joinUrl: string; role: string }>> {
  return this.http.get<ApiResponse<{ joinUrl: string; role: string }>>(
    `${this.TRAINING_ENDPOINT}/sessions/${sessionId}/join`,
    { headers: this.getAuthHeaders() }
  ).pipe(catchError(this.handleError.bind(this)));
}

// ✅ NEW: Get iframe URL for employer to start meeting
getSessionIframeUrl(sessionId: string): Observable<ApiResponse<{ iframeUrl: string }>> {
  return this.http.get<ApiResponse<{ iframeUrl: string }>>(
    `${this.TRAINING_ENDPOINT}/sessions/${sessionId}/iframe`,
    { headers: this.getAuthHeaders() }
  ).pipe(catchError(this.handleError.bind(this)));
}

  deleteTraining(id: string): Observable<ApiResponse<void>> {
  this.loadingSubject.next(true);

  return this.http.delete<ApiResponse<void>>(
    `${this.TRAINING_ENDPOINT}/${id}`,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      if (response.success) {
        // ✅ This is OK - removes from local cache immediately
        const currentTrainings = this.trainingsSubject.value;
        this.trainingsSubject.next(currentTrainings.filter(t => t.id !== id));
      }
      this.loadingSubject.next(false);
    }),
    catchError(error => {
      this.loadingSubject.next(false);
      return this.handleError(error);
    })
  );
}

  getTrainingDetails(trainingId: string): Observable<ApiResponse<Training>> {
    const params = new HttpParams()
      .set('include_sessions', 'true')
      .set('include_outcomes', 'true');
    
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
        }
        return response;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // ============================================
  // NOTIFICATION METHODS
  // ============================================

  getNotifications(params: { page?: number; limit?: number; read?: boolean } = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<any>(
      this.NOTIFICATION_ENDPOINT,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(
      map(response => {
        console.log('📥 Raw notification response:', response);
        
        let notifications: any[] = [];
        
        if (response?.success && response?.data?.notifications) {
          notifications = response.data.notifications;
        } else if (response?.success && Array.isArray(response?.data)) {
          notifications = response.data;
        } else if (response?.notifications) {
          notifications = response.notifications;
        } else if (Array.isArray(response)) {
          notifications = response;
        }
        
        console.log('✅ Parsed notifications:', notifications.length);
        
        return {
          success: true,
          data: {
            notifications: notifications
          }
        };
      }),
      catchError(error => {
        console.error('❌ Notification error:', error);
        return of({
          success: false,
          data: { notifications: [] },
          message: error.message || 'Failed to load notifications'
        });
      })
    );
  }

  // ✅ FIXED: Single markNotificationRead method
  markNotificationRead(notificationId: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.NOTIFICATION_ENDPOINT}/${notificationId}/read`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => console.log('✅ Notification marked as read:', notificationId)),
      catchError(this.handleError.bind(this))
    );
  }

  // ============================================
  // APPLICATION METHODS
  // ============================================

  applyForTraining(trainingId: string, motivationLetter?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/apply`,
      { motivation: motivationLetter },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

 // FIXED: getApplications method in training.service.ts (Angular)
// Location: training.service.ts, replace the existing getApplications method

getApplications(trainingId: string, params: any = {}): Observable<ApiResponse<any>> {
  const httpParams = this.buildParams(params);
  
  return this.http.get<any>(  // ✅ Changed to 'any' to handle actual response
    `${this.TRAINING_ENDPOINT}/${trainingId}/applications`,
    { headers: this.getAuthHeaders(), params: httpParams }
  ).pipe(
    map(response => {
      console.log('📥 Raw applications response:', response);
      
      // ✅ Handle the actual backend response structure
      if (response.applications) {
        // Backend returns: { applications: [...], pagination: {...} }
        return {
          success: true,
          data: response.applications,  // ✅ Extract applications array
          pagination: response.pagination
        };
      }
      
      // Fallback for wrapped response
      if (response.success && response.data?.applications) {
        return {
          success: true,
          data: response.data.applications,
          pagination: response.data.pagination
        };
      }
      
      // Fallback for array response
      if (Array.isArray(response)) {
        return {
          success: true,
          data: response
        };
      }
      
      console.error('❌ Unexpected applications response structure:', response);
      return {
        success: false,
        data: [],
        message: 'Invalid response format'
      };
    }),
    catchError(this.handleError.bind(this))
  );
}

  shortlistApplicant(
    trainingId: string, 
    applicationId: string, 
    decision: 'shortlisted' | 'rejected', 
    employer_notes?: string
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/applications/${applicationId}/shortlist`,
      { decision, employer_notes },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // Add this method after shortlistApplicant (around line 520)

enrollShortlistedApplicant(
  trainingId: string,
  applicationId: string
): Observable<ApiResponse<any>> {
  return this.http.post<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/applications/${applicationId}/enroll`,
    {},
    { headers: this.getAuthHeaders() }
  ).pipe(catchError(this.handleError.bind(this)));
}

  // ============================================
  // ENROLLMENT & COMPLETION METHODS
  // ============================================

  getTrainingEnrollments(trainingId: string, params: any = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);

    return this.http.get<any>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments`,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(
      map(response => {
        // Normalize possible backend shapes:
        // 1) { success: true, enrollments: [...], pagination: {...} }
        // 2) { success: true, data: { enrollments: [...], pagination: {...} } }
        // 3) { enrollments: [...] }
        // 4) Array response [...]

        if (response?.enrollments) {
          return {
            success: true,
            data: { enrollments: response.enrollments },
            pagination: response.pagination || response.data?.pagination
          };
        }

        if (response?.success && response?.data?.enrollments) {
          return {
            success: true,
            data: { enrollments: response.data.enrollments },
            pagination: response.data.pagination
          };
        }

        if (response?.success && Array.isArray(response.data)) {
          return { success: true, data: { enrollments: response.data } };
        }

        if (Array.isArray(response)) {
          return { success: true, data: { enrollments: response } };
        }

        console.error('❌ Unexpected enrollments response structure:', response);
        return { success: false, data: { enrollments: [] }, message: 'Invalid response format' };
      }),
      catchError(this.handleError.bind(this))
    );
  }

  markCompletion(
    trainingId: string, 
    enrollmentId: string, 
    completed: boolean, 
    employer_notes?: string
  ): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments/${enrollmentId}/completion`,
      { completed, employer_notes },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  issueCertificate(trainingId: string, enrollmentId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments/${enrollmentId}/certificate`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // STATS METHODS
  // ============================================

  getTrainingStats(): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/stats/overview`,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // JOBSEEKER METHODS
  // ============================================

  getJobseekerTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    const enhancedParams = {
      ...params,
      include_sessions: true,
      include_outcomes: true,
      status: 'published'
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      this.TRAINING_ENDPOINT,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(
      map(response => {
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings
            .filter(t => t.status === 'published')
            .map(t => this.processTrainingData(t));
        }
        return response;
      }),
      tap(response => {
        if (response.success && response.data?.trainings) {
          this.trainingsSubject.next(response.data.trainings);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  getEnrolledTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      `${this.TRAINING_ENDPOINT}/enrolled/list`,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(
      map(response => {
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings.map(t => this.processTrainingData(t));
        }
        return response;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  downloadCertificate(enrollmentId: string): Observable<Blob> {
  // ✅ CRITICAL FIX: Correct endpoint URL
  const url = `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/certificate`;
  
  console.log('📥 Downloading certificate from:', url);
  console.log('📋 Enrollment ID:', enrollmentId);
  
  return this.http.get(url, {
    responseType: 'blob',
    headers: this.getAuthHeaders()
  }).pipe(
    tap((blob: Blob) => {
      console.log('✅ Certificate blob received:', {
        size: blob.size,
        type: blob.type
      });
    }),
    catchError((error) => {
      console.error('❌ Certificate download error:', {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        message: error.message
      });
      return this.handleError(error);
    })
  );
}


  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  publishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.updateTrainingStatus(id, 'published');
  }

  unpublishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.updateTrainingStatus(id, 'draft');
  }

  closeApplications(id: string): Observable<ApiResponse<Training>> {
    return this.updateTrainingStatus(id, 'applications_closed');
  }

  startTrainingProgram(id: string): Observable<ApiResponse<Training>> {
    return this.updateTrainingStatus(id, 'in_progress');
  }

  completeTrainingProgram(id: string): Observable<ApiResponse<Training>> {
    return this.updateTrainingStatus(id, 'completed');
  }

  private updateTrainingStatus(id: string, status: string): Observable<ApiResponse<Training>> {
    return this.http.patch<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/status`,
      { status },
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
        }
        return response;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getTrainingCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.TRAINING_ENDPOINT}/categories/list`
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getTrainingAnalytics(id: string, timeRange: string = '30days'): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('time_range', timeRange);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/analytics`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  verifyCertificate(code: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.API_BASE}/certificates/verify/${code}`
    ).pipe(catchError(this.handleError.bind(this)));
  }

  clearError(): void {
    this.errorSubject.next(null);
  }

  formatDuration(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  }

  formatPrice(price: number, costType: string): string {
    if (costType === 'Free') return 'Free';
    return `$${price.toFixed(2)}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'published': return 'green';
      case 'draft': return 'orange';
      case 'applications_closed': return 'blue';
      case 'in_progress': return 'purple';
      case 'completed': return 'gray';
      default: return 'gray';
    }
  }
}