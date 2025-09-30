import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// Unified Training interface that works with both employer and jobseeker components
export interface Training {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  duration?: string;
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
  
  // Frontend properties
  enrolled?: boolean;
  progress?: number;
  enrollment_status?: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  videos?: TrainingVideo[];
  outcomes?: TrainingOutcome[];

  // Legacy compatibility
  videoType?: 'youtube' | 'vimeo' | 'local';
  videoUrl?: string;
  completionCriteria?: string;
  issueCertificate?: boolean;
  completedBy?: string[];
  certificatesIssued?: number;
}

export interface TrainingVideo {
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number;
  duration?: number;
  order_index: number;
  is_preview?: boolean;
  completed?: boolean;
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
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

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

  private buildParams(params: TrainingSearchParams): HttpParams {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });
    
    return httpParams;
  }

  // EMPLOYER METHODS
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

  createTraining(trainingData: CreateTrainingRequest): Observable<ApiResponse<Training>> {
    console.log('Creating training:', trainingData);
    
    const token = localStorage.getItem('token');
    if (!token) {
      return throwError(() => new Error('Authentication required'));
    }

    this.loadingSubject.next(true);
    
    return this.http.post<ApiResponse<Training>>(
      this.TRAINING_ENDPOINT,
      trainingData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('Training creation response:', response);
        if (response.success && response.data) {
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

  updateTraining(id: string, trainingData: UpdateTrainingRequest): Observable<ApiResponse<Training>> {
    this.loadingSubject.next(true);
    
    return this.http.put<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      trainingData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
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

  deleteTraining(id: string): Observable<ApiResponse<void>> {
    this.loadingSubject.next(true);
    
    return this.http.delete<ApiResponse<void>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success) {
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

  publishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/publish`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
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

  unpublishTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/unpublish`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
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

  suspendTraining(id: string): Observable<ApiResponse<Training>> {
    return this.http.post<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}/suspend`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
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

  // JOBSEEKER METHODS
  getJobseekerTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    console.log('Fetching jobseeker trainings with params:', params);
    
    const httpParams = this.buildParams(params);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      `${this.TRAINING_ENDPOINT}/jobseeker/available`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      tap(response => {
        console.log('Jobseeker trainings response:', response);
        if (response.success && response.data?.trainings) {
          console.log('Found trainings:', response.data.trainings.length);
          this.trainingsSubject.next(response.data.trainings);
        }
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        console.error('Error fetching jobseeker trainings:', error);
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

enrollInTraining(trainingId: string): Observable<ApiResponse<any>> {
  console.log('Enrolling in training:', trainingId);
  
  return this.http.post<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/enroll`,
    {},
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('Enrollment response:', response);
      if (response.success) {
        // Update the training in the current list to reflect enrollment
        const currentTrainings = this.trainingsSubject.value;
        const updatedTrainings = currentTrainings.map(training => 
          training.id === trainingId 
            ? { ...training, enrolled: true, progress: 0, enrollment_status: 'enrolled' as 'enrolled' }
            : training
        );
        this.trainingsSubject.next(updatedTrainings);
      }
      this.errorSubject.next(null);
    }),
    catchError(this.handleError.bind(this))
  );
}

  getTrainingWithVideos(trainingId: string): Observable<ApiResponse<Training>> {
  return this.http.get<ApiResponse<Training>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}`,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('Training details with videos loaded:', response);
      this.errorSubject.next(null);
    }),
    catchError(this.handleError.bind(this))
  );
}

getEnrolledTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
  this.loadingSubject.next(true);
  
  const httpParams = this.buildParams(params);
  
  return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
    `${this.TRAINING_ENDPOINT}/jobseeker/enrolled`,
    { 
      headers: this.getAuthHeaders(),
      params: httpParams
    }
  ).pipe(
    tap(response => {
      console.log('Enrolled trainings response:', response);
      if (response.success && response.data?.trainings) {
        // Don't update main trainings list, this is for enrolled trainings only
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

getEnrolledTrainingDetails(trainingId: string): Observable<ApiResponse<Training>> {
  return this.http.get<ApiResponse<Training>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/enrolled-details`,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('Enrolled training details loaded:', response);
      this.errorSubject.next(null);
    }),
    catchError(this.handleError.bind(this))
  );
}

  // NEW METHOD: Get full training details with videos and outcomes
  getTrainingDetails(trainingId: string): Observable<ApiResponse<Training>> {
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/details`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('Training details loaded:', response);
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getVideoProgress(trainingId: string): Observable<ApiResponse<any>> {
  return this.http.get<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/progress`,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('Video progress loaded:', response);
      this.errorSubject.next(null);
    }),
    catchError(this.handleError.bind(this))
  );
}

extractVideoId(url: string, videoType?: string): string | null {
  if (!url) return null;
  
  // YouTube URL patterns
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
  }
  
  // Vimeo URL patterns
  if (url.includes('vimeo.com')) {
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const match = url.match(vimeoRegex);
    return match ? match[1] : null;
  }
  
  return url; // For direct file URLs
}

getVideoEmbedUrl(videoUrl: string): string {
  if (!videoUrl) return '';
  
  // YouTube
  const youtubeId = this.extractVideoId(videoUrl);
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    return `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&rel=0`;
  }
  
  // Vimeo
  if (videoUrl.includes('vimeo.com')) {
    const vimeoId = this.extractVideoId(videoUrl);
    return `https://player.vimeo.com/video/${vimeoId}?enablejsapi=1`;
  }
  
  return videoUrl; // For direct file URLs
}

// 10. UTILITY: Check if video is accessible
isVideoAccessible(video: any, training: Training): boolean {
  if (training.enrolled) return true;
  return video.is_preview || false;
}


  updateVideoProgress(trainingId: string, videoId: string, progressData: any): Observable<ApiResponse<any>> {
  return this.http.put<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/video/${videoId}/progress`,
    progressData,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('Video progress updated:', response);
      this.errorSubject.next(null);
    }),
    catchError(this.handleError.bind(this))
  );
}
completeVideo(trainingId: string, videoId: string, watchTime: number): Observable<ApiResponse<any>> {
  return this.updateVideoProgress(trainingId, videoId, {
    is_completed: true,
    watch_time_minutes: watchTime
  });
}

  // NEW METHOD: Update training progress (including video completion)
  updateTrainingProgress(trainingId: string, progressData: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/progress`,
      progressData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('Progress updated:', response);
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }
  
  // UTILITY METHODS
  getTrainingStats(): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/stats/overview`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  getTrainingById(id: string): Observable<ApiResponse<Training>> {
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  getTrainingEnrollments(id: string, params: any = {}): Observable<ApiResponse<any>> {
    const httpParams = this.buildParams(params);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/enrollments`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  getTrainingAnalytics(id: string, timeRange: string = '30days'): Observable<ApiResponse<any>> {
    const params = new HttpParams().set('range', timeRange);
    
    return this.http.get<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/analytics`,
      { 
        headers: this.getAuthHeaders(),
        params
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

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

  getTrainingCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.TRAINING_ENDPOINT}/categories`
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  clearError(): void {
    this.errorSubject.next(null);
  }

  resetState(): void {
    this.trainingsSubject.next([]);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
  }

  getCurrentTrainings(): Training[] {
    return this.trainingsSubject.value;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

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

  formatDuration(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    if (hours === 1) {
      return '1 hour';
    }
    return `${hours} hours`;
  }

  formatPrice(price: number, costType: string): string {
    if (costType === 'Free') {
      return 'Free';
    }
    return `${price.toFixed(2)}`;
  }

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