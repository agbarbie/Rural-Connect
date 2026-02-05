// training.service.ts - BOOTCAMP MODEL (Updated with Attendance & Evaluation)
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

// ============================================
// UPDATED INTERFACES
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

export interface SessionAttendance {
  enrollment_id: string;
  user_id: string;
  user_name: string;
  email: string;
  attended: boolean;
  notes?: string;
  marked_at?: Date;
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
  motivation_letter?: string;
  status: 'pending' | 'shortlisted' | 'rejected';
  applied_at?: Date;
  reviewed_at?: Date;
  user_name?: string;
  user_email?: string;
}

export interface Training {
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
  
  // NEW FIELDS
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  
  // Bootcamp-specific fields
  application_deadline?: Date;
  training_start_date?: Date;
  training_end_date?: Date;
  max_participants?: number;
  current_participants: number;
  
  status: 'draft' | 'published' | 'applications_closed' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
  
  // Frontend properties
  applied?: boolean;
  application_status?: 'pending' | 'shortlisted' | 'rejected';
  enrolled?: boolean;
  enrollment_id?: string;
  progress?: number;
  certificate_issued?: boolean;
  certificate_url?: string;
  certificate_code?: string;
  
  // NEW EVALUATION FIELDS
  attendance_rate?: number;
  participation_score?: number;
  tasks_completed?: number;
  tasks_total?: number;
  
  // Relations
  sessions?: TrainingSession[];
  outcomes?: TrainingOutcome[];
  session_count?: number;
}

export interface TrainingEnrollment {
  id: string;
  training_id: string;
  user_id: string;
  application_id?: string;
  status: 'enrolled' | 'completed' | 'not_completed' | 'dropped';
  enrolled_at: Date;
  completed_at?: Date;
  
  // NEW EVALUATION CRITERIA
  attendance_rate: number;
  participation_score: number;
  tasks_completed: number;
  tasks_total: number;
  
  completion_marked: boolean;
  certificate_issued: boolean;
  certificate_url?: string;
  certificate_issued_at?: Date;
  
  created_at: Date;
  updated_at: Date;
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
  training_start_date?: string;
  training_end_date?: string;
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
    } else if (error.message) {
      errorMessage = error.message;
    }
    
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
      enrolled: training.enrolled || false,
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
  
  return this.http.get<any>(  // Change to 'any' temporarily
    this.TRAINING_ENDPOINT, 
    { headers: this.getAuthHeaders(), params: httpParams }
  ).pipe(
    map(response => {
      console.log('📥 Raw API response:', response);
      
      // Handle both response formats
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
      tap(response => {
        if (response.success && response.data) {
          const currentTrainings = this.trainingsSubject.value;
          this.trainingsSubject.next([response.data, ...currentTrainings]);
        }
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
      tap(response => {
        if (response.success && response.data) {
          const currentTrainings = this.trainingsSubject.value;
          const updatedTrainings = currentTrainings.map(training => 
            training.id === id ? response.data! : training
          );
          this.trainingsSubject.next(updatedTrainings);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  deleteTraining(id: string): Observable<ApiResponse<void>> {
    this.loadingSubject.next(true);

    return this.http.delete<ApiResponse<void>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
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

  // Status management
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
  // EMPLOYER: APPLICATION MANAGEMENT
  // ============================================

  getApplications(trainingId: string, params: any = {}): Observable<ApiResponse<TrainingApplication[]>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<TrainingApplication[]>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/applications`,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  shortlistApplicant(trainingId: string, applicationId: string, decision: 'shortlisted' | 'rejected', employer_notes?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/applications/${applicationId}/shortlist`,
      { decision, employer_notes },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // EMPLOYER: ENROLLMENT & COMPLETION
  // ============================================

  getTrainingEnrollments(id: string, params: any = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/enrollments`,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  markCompletion(trainingId: string, enrollmentId: string, completed: boolean, employer_notes?: string): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments/${enrollmentId}/completion`,
      { completed, employer_notes },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // NEW: ATTENDANCE TRACKING
  // ============================================

  /**
   * Mark attendance for a session
   */
  markSessionAttendance(
    trainingId: string,
    sessionId: string,
    attendance: { enrollment_id: string; attended: boolean; notes?: string }[]
  ): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/sessions/${sessionId}/attendance`,
      { attendance },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Get attendance for a session
   */
  getSessionAttendance(trainingId: string, sessionId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/sessions/${sessionId}/attendance`,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Update enrollment evaluation criteria
   */
  updateEnrollmentEvaluation(
    trainingId: string,
    enrollmentId: string,
    data: {
      attendance_rate?: number;
      participation_score?: number;
      tasks_completed?: number;
      tasks_total?: number;
    }
  ): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments/${enrollmentId}/evaluation`,
      data,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // EMPLOYER: CERTIFICATE ISSUANCE
  // ============================================

  issueCertificate(trainingId: string, enrollmentId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/enrollments/${enrollmentId}/certificate`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // JOBSEEKER: BROWSE & APPLY
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

  applyForTraining(trainingId: string, motivationLetter?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/apply`,
      { motivation: motivationLetter },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
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

  // ============================================
  // CERTIFICATES
  // ============================================

  downloadCertificate(enrollmentId: string): Observable<Blob> {
    return this.http.get(
      `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/certificate`,
      { responseType: 'blob', headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  verifyCertificate(code: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(
      `${this.API_BASE}/certificates/verify/${code}`
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  getNotifications(params: { page?: number; limit?: number; read?: boolean } = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<any>>(
      this.NOTIFICATION_ENDPOINT,
      { headers: this.getAuthHeaders(), params: httpParams }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  markNotificationRead(notificationId: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.NOTIFICATION_ENDPOINT}/${notificationId}/read`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getEnrollmentNotifications(params: any = {}): Observable<ApiResponse<any>> {
    return this.getNotifications(params);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  getTrainingStats(): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/stats/overview`,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  getTrainingAnalytics(id: string, timeRange: string = '30days'): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('time_range', timeRange);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/analytics`,
      { headers: this.getAuthHeaders(), params }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getTrainingCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.TRAINING_ENDPOINT}/categories/list`
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