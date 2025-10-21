import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

// Training Video Interface - Normalized structure
export interface TrainingVideo {
duration: number;
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number;
  order_index: number;
  is_preview?: boolean;
  completed?: boolean;
  created_at?: Date;
}

// Training Outcome Interface
export interface TrainingOutcome {
  id?: string;
  training_id?: string;
  outcome_text: string;
  order_index: number;
  created_at?: Date;
}

// Main Training Interface
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
  
  // Frontend properties
  enrolled?: boolean;
  progress?: number;
  enrollment_status?: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  videos?: TrainingVideo[];
  outcomes?: TrainingOutcome[];
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
  include_videos?: boolean; // Add this flag
  include_outcomes?: boolean; // Add this flag
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

  // FIXED: Normalize video data structure
  private normalizeVideoData(video: any): TrainingVideo {
    return {
  id: video.id,
  training_id: video.training_id,
  title: video.title || '',
  description: video.description || '',
  video_url: video.video_url || '',
  duration_minutes: video.duration_minutes || video.duration || 0,
  order_index: video.order_index || 0,
  is_preview: video.is_preview || false,
  completed: video.completed || false,
  created_at: video.created_at,
  duration: video.duration || 0
};
  }

  // FIXED: Process training data to ensure videos and outcomes are properly formatted
  private processTrainingData(training: any): Training {
    console.log('Processing training data:', training.title, 'Raw videos:', training.videos);
    
    const processedTraining: Training = {
      ...training,
      videos: Array.isArray(training.videos) 
        ? training.videos.map((v: any) => this.normalizeVideoData(v))
        : [],
      outcomes: Array.isArray(training.outcomes) 
        ? training.outcomes 
        : [],
      enrolled: training.enrolled || false,
      progress: training.progress || 0
    };

    // Ensure videos is always an array
    if (!processedTraining.videos) {
      processedTraining.videos = [];
    }
    
    console.log('Processed training:', processedTraining.title, 'Videos count:', processedTraining.videos.length);
    
    return processedTraining;
  }

  // EMPLOYER METHODS
  getMyTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    // FIXED: Always include videos and outcomes for employer view
    const enhancedParams = {
      ...params,
      include_videos: true,
      include_outcomes: true
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      this.TRAINING_ENDPOINT, 
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      map(response => {
        console.log('Raw API response for employer trainings:', response);
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings.map(t => this.processTrainingData(t));
          console.log('Processed employer trainings:', response.data.trainings.map(t => ({
            title: t.title,
            videoCount: t.videos?.length || 0
          })));
        }
        return response;
      }),
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
    console.log('Creating training with data:', trainingData);
    console.log('Videos being sent:', trainingData.videos);
    
    const token = localStorage.getItem('token');
    if (!token) {
      return throwError(() => new Error('Authentication required'));
    }

    this.loadingSubject.next(true);
    
    // FIXED: Normalize video data before sending
    const normalizedData = {
      ...trainingData,
      videos: trainingData.videos.map(v => this.normalizeVideoData(v))
    };
    
    console.log('Normalized training data:', normalizedData);
    
    return this.http.post<ApiResponse<Training>>(
      this.TRAINING_ENDPOINT,
      normalizedData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        console.log('Raw training creation response:', response);
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
          console.log('Processed created training:', {
            title: response.data.title,
            videoCount: response.data.videos?.length || 0,
            videos: response.data.videos
          });
        }
        return response;
      }),
      tap(response => {
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
    
    // FIXED: Normalize video data if present
    const normalizedData = trainingData.videos 
      ? {
          ...trainingData,
          videos: trainingData.videos.map(v => this.normalizeVideoData(v))
        }
      : trainingData;
    
    return this.http.put<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      normalizedData,
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
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // JOBSEEKER METHODS - FIXED TO ALWAYS FETCH VIDEOS
  getJobseekerTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    console.log('Fetching jobseeker trainings with params:', params);
    
    // FIXED: Always include videos and outcomes
    const enhancedParams = {
      ...params,
      include_videos: true,
      include_outcomes: true
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      `${this.TRAINING_ENDPOINT}/jobseeker/available`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      map(response => {
        console.log('Raw API response for jobseeker trainings:', response);
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings.map(t => this.processTrainingData(t));
          console.log('Processed jobseeker trainings:', response.data.trainings.map(t => ({
            title: t.title,
            videoCount: t.videos?.length || 0,
            videos: t.videos
          })));
        }
        return response;
      }),
      tap(response => {
        if (response.success && response.data?.trainings) {
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

  // FIXED: Get full training details with proper video processing
  getTrainingDetails(trainingId: string): Observable<ApiResponse<Training>> {
    console.log('Fetching training details for:', trainingId);
    
    const params = new HttpParams()
      .set('include_videos', 'true')
      .set('include_outcomes', 'true');
    
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}`,
      { 
        headers: this.getAuthHeaders(),
        params: params
      }
    ).pipe(
      map(response => {
        console.log('Raw training details response:', response);
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
          console.log('Processed training details:', {
            title: response.data.title,
            videoCount: response.data.videos?.length || 0,
            videos: response.data.videos
          });
        }
        return response;
      }),
      tap(response => {
        this.errorSubject.next(null);
      }),
      catchError(this.handleError.bind(this))
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

  getEnrolledTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    const enhancedParams = {
      ...params,
      include_videos: true,
      include_outcomes: true
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      `${this.TRAINING_ENDPOINT}/jobseeker/enrolled`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      map(response => {
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings.map(t => this.processTrainingData(t));
        }
        return response;
      }),
      tap(response => {
        this.loadingSubject.next(false);
        this.errorSubject.next(null);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  // VIDEO UTILITY METHODS
  extractVideoId(url: string): string | null {
    if (!url) return null;
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
      const match = url.match(youtubeRegex);
      return match ? match[1] : null;
    }
    
    if (url.includes('vimeo.com')) {
      const vimeoRegex = /vimeo\.com\/(\d+)/;
      const match = url.match(vimeoRegex);
      return match ? match[1] : null;
    }
    
    return url;
  }

  getVideoEmbedUrl(videoUrl: string): string {
    if (!videoUrl) return '';
    
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const youtubeId = this.extractVideoId(videoUrl);
      return `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&rel=0`;
    }
    
    if (videoUrl.includes('vimeo.com')) {
      const vimeoId = this.extractVideoId(videoUrl);
      return `https://player.vimeo.com/video/${vimeoId}?enablejsapi=1`;
    }
    
    return videoUrl;
  }

  isVideoAccessible(video: TrainingVideo, training: Training): boolean {
    if (training.enrolled) return true;
    return video.is_preview || false;
  }

  getTrainingStats(): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/stats/overview`,
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
    return `$${price.toFixed(2)}`;
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