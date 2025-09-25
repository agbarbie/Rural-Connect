import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// Types matching your backend
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
  start_date?: Date;
  end_date?: Date;
  max_participants?: number;
  current_participants: number;
  status: 'draft' | 'published' | 'suspended' | 'completed';
  created_at: Date;
  updated_at: Date;
  
  // Computed properties for frontend
  enrolled?: boolean;
  progress?: number;
  enrollment_status?: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  videos?: TrainingVideo[];
  outcomes?: TrainingOutcome[];
}

export interface TrainingVideo {
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number;
  order_index: number;
  is_preview?: boolean;
  created_at?: Date;
}

export interface TrainingOutcome {
  id?: string;
  training_id?: string;
  outcome_text: string;
  order_index: number;
  created_at?: Date;
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
  start_date?: string;
  end_date?: string;
  max_participants?: number;
  videos: TrainingVideo[];
  outcomes: TrainingOutcome[];
}

export interface UpdateTrainingRequest extends Partial<CreateTrainingRequest> {
  status?: 'draft' | 'published' | 'suspended' | 'completed';
}

export interface TrainingStats {
  total_trainings: number;
  published_trainings: number;
  draft_trainings: number;
  suspended_trainings: number;
  total_enrollments: number;
  total_revenue: number;
  avg_rating: number;
  completion_rate: number;
}

export interface TrainingEnrollment {
  id: string;
  training_id: string;
  user_id: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  progress_percentage: number;
  enrolled_at: Date;
  completed_at?: Date;
  certificate_issued: boolean;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
}

export interface TrainingAnalytics {
  training_info: {
    id: string;
    title: string;
    status: string;
    created_at: Date;
  };
  enrollment_metrics: {
    total_enrollments: number;
    completed_enrollments: number;
    in_progress_enrollments: number;
    dropped_enrollments: number;
    completion_rate: number;
    drop_rate: number;
    avg_progress: number;
    certificates_issued: number;
  };
  review_metrics: {
    avg_rating: number;
    total_reviews: number;
    rating_distribution: {
      five_star: number;
      four_star: number;
      three_star: number;
      two_star: number;
      one_star: number;
    };
  };
  trends: {
    daily_enrollments: Array<{
      date: string;
      enrollments: number;
      completions: number;
    }>;
  };
  time_range: string;
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
  sort_by?: 'created_at' | 'title' | 'rating' | 'total_students' | 'start_date';
  sort_order?: 'asc' | 'desc';
  category?: string;
  level?: string;
  search?: string;
  status?: string;
  cost_type?: string;
  mode?: string;
  has_certificate?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  private readonly API_BASE = 'http://localhost:5000/api';
  private readonly TRAINING_ENDPOINT = `${this.API_BASE}/trainings`;
  
  // State management
  private trainingsSubject = new BehaviorSubject<Training[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  public trainings$ = this.trainingsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  // FIXED: Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    
    // Debug token
    console.log('Getting auth headers:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
    });

    if (!token) {
      console.warn('No token found in localStorage');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Helper method to handle errors
  private handleError(error: any): Observable<never> {
    console.error('Training service error:', error);
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    this.errorSubject.next(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Helper method to build query params
  private buildParams(params: TrainingSearchParams): HttpParams {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });
    
    return httpParams;
  }

  // ================ EMPLOYER METHODS ================

  // Get all trainings for employer (my trainings)
  getMyTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    const httpParams = this.buildParams(params);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      this.TRAINING_ENDPOINT, 
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      tap(response => {
        if (response.success && response.data?.trainings) {
          this.trainingsSubject.next(response.data.trainings);
        }
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // FIXED: Create new training - the main method causing the error
  createTraining(trainingData: CreateTrainingRequest): Observable<ApiResponse<Training>> {
    console.log('=== CREATING TRAINING ===');
    console.log('Training data:', trainingData);
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return throwError(() => new Error('Authentication required'));
    }

    // Debug token payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', {
        id: payload.id,
        email: payload.email,
        user_type: payload.user_type,
        exp: new Date(payload.exp * 1000)
      });
      
      if (payload.user_type !== 'employer') {
        console.error('User is not an employer:', payload.user_type);
        return throwError(() => new Error('Only employers can create trainings'));
      }
    } catch (error) {
      console.error('Error parsing token:', error);
      return throwError(() => new Error('Invalid authentication token'));
    }

    this.loadingSubject.next(true);
    
    const headers = this.getAuthHeaders();
    console.log('Request headers:', {
      'Content-Type': headers.get('Content-Type'),
      'Authorization': headers.get('Authorization') ? 'Present' : 'Missing'
    });
    
    return this.http.post<ApiResponse<Training>>(
      this.TRAINING_ENDPOINT,
      trainingData,
      { headers }
    ).pipe(
      tap(response => {
        console.log('Training creation response:', response);
        if (response.success && response.data) {
          // Add new training to the beginning of the list
          const currentTrainings = this.trainingsSubject.value;
          this.trainingsSubject.next([response.data, ...currentTrainings]);
        }
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        console.error('Training creation error:', error);
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // Update training
  updateTraining(id: string, trainingData: UpdateTrainingRequest): Observable<ApiResponse<Training>> {
    this.loadingSubject.next(true);
    
    return this.http.put<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      trainingData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Update training in the list
          const currentTrainings = this.trainingsSubject.value;
          const updatedTrainings = currentTrainings.map(training => 
            training.id === id ? response.data! : training
          );
          this.trainingsSubject.next(updatedTrainings);
        }
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // Delete training
  deleteTraining(id: string): Observable<ApiResponse<void>> {
    this.loadingSubject.next(true);
    
    return this.http.delete<ApiResponse<void>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
          // Remove training from the list
          const currentTrainings = this.trainingsSubject.value;
          const filteredTrainings = currentTrainings.filter(training => training.id !== id);
          this.trainingsSubject.next(filteredTrainings);
        }
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // Publish training
  publishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/publish`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Update training status in the list
          const currentTrainings = this.trainingsSubject.value;
          const updatedTrainings = currentTrainings.map(training => 
            training.id === id ? { ...training, status: 'published' as const } : training
          );
          this.trainingsSubject.next(updatedTrainings);
        }
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // Unpublish training
  unpublishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/unpublish`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Update training status in the list
          const currentTrainings = this.trainingsSubject.value;
          const updatedTrainings = currentTrainings.map(training => 
            training.id === id ? { ...training, status: 'draft' as const } : training
          );
          this.trainingsSubject.next(updatedTrainings);
        }
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // Suspend training
  suspendTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/suspend`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Update training status in the list
          const currentTrainings = this.trainingsSubject.value;
          const updatedTrainings = currentTrainings.map(training => 
            training.id === id ? { ...training, status: 'suspended' as const } : training
          );
          this.trainingsSubject.next(updatedTrainings);
        }
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // Get training statistics
  getTrainingStats(): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/employer/stats`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Get training by ID
  getTrainingById(id: string): Observable<ApiResponse<Training>> {
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Get training enrollments
  getTrainingEnrollments(id: string, params: any = {}): Observable<ApiResponse<{
    enrollments: TrainingEnrollment[];
    pagination: any;
  }>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<{
      enrollments: TrainingEnrollment[];
      pagination: any;
    }>>(
      `${this.TRAINING_ENDPOINT}/${id}/enrollments`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Get training analytics
  getTrainingAnalytics(id: string, timeRange: string = '30days'): Observable<ApiResponse<TrainingAnalytics>> {
    const params = new HttpParams().set('range', timeRange);
    
    return this.http.get<ApiResponse<TrainingAnalytics>>(
      `${this.TRAINING_ENDPOINT}/${id}/analytics`,
      { 
        headers: this.getAuthHeaders(),
        params
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Get training reviews
  getTrainingReviews(id: string, params: any = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/reviews`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Get training categories
  getTrainingCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.TRAINING_ENDPOINT}/categories`
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // ================ UTILITY METHODS ================

  // Clear errors
  clearError(): void {
    this.errorSubject.next(null);
  }

  // Reset state
  resetState(): void {
    this.trainingsSubject.next([]);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
  }

  // Get current trainings snapshot
  getCurrentTrainings(): Training[] {
    return this.trainingsSubject.value;
  }

  // Check if user is logged in
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  // Get user type from token
  getUserType(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_type || null;
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }

  // Format duration for display
  formatDuration(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    if (hours === 1) {
      return '1 hour';
    }
    return `${hours} hours`;
  }

  // Format price for display
  formatPrice(price: number, costType: string): string {
    if (costType === 'Free') {
      return 'Free';
    }
    return `$${price.toFixed(2)}`;
  }

  // Get status color for UI
  getStatusColor(status: string): string {
    switch (status) {
      case 'published': return 'green';
      case 'draft': return 'orange';
      case 'suspended': return 'red';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  }
}