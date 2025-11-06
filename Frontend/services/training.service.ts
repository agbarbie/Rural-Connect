import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../src/environments/environment.prod';

// Training Video Interface - Normalized structure
export interface TrainingVideo {
  url: string;
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number; // Primary field
  duration?: number; // Fallback field
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

// Main Training Interface (FIXED: Added video_count, video_urls, and videos for legacy backend compatibility)
export interface Training {
  certificate_issued: any;
  enrollment_id: string;
  completed: any;
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
  video_count?: number;  // For list view counts

  // FIXED: Legacy backend fields (aggregated URLs from SQL json_agg)
  video_urls?: string[];  // e.g., from older queries like COALESCE(json_agg(v.video_url) AS video_urls)
  // videos?: string[];      // e.g., from updated SQL like AS videos (string array fallback)
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
  training_completed: any;
  overall_progress: number | undefined;
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
  include_videos?: boolean;
  include_outcomes?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {
  // ============================================
  // VIDEO MANAGEMENT (EMPLOYER)
  // ============================================

  addVideoToTraining(trainingId: string, videoData: TrainingVideo, employerId?: string): Observable<ApiResponse<TrainingVideo>> {
    return this.http.post<ApiResponse<TrainingVideo>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/videos`,
      { ...videoData, employer_id: employerId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('✅ Video added:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  updateTrainingVideo(trainingId: string, videoId: string, videoData: TrainingVideo, employerId?: string): Observable<ApiResponse<TrainingVideo>> {
    return this.http.put<ApiResponse<TrainingVideo>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/videos/${videoId}`,
      { ...videoData, employer_id: employerId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('✅ Video updated:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  // In training.service.ts - Add to deleteTrainingVideo method
  deleteTrainingVideo(trainingId: string, videoId: string, employerId?: string): Observable<ApiResponse<void>> {
    console.log('🗑️ Deleting video:', {
      trainingId,
      videoId,
      employerId,
      hasAuth: !!this.getAuthHeaders().get('Authorization')
    });
    
    return this.http.delete<ApiResponse<void>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/videos/${videoId}`,
      { 
        headers: this.getAuthHeaders(),
        params: employerId ? new HttpParams().set('employer_id', employerId) : {}
      }
    ).pipe(
      tap(response => console.log('✅ Video deleted:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  // ============================================
  // VIDEO PROGRESS (JOBSEEKER)
  // ============================================

// In training.service.ts (Frontend) - Replace the updateVideoProgress method

updateVideoProgress(
  trainingId: string, 
  videoId: string, 
  watchTimeSeconds: number, 
  isCompleted: boolean,
  userId?: string
): Observable<ApiResponse<any>> {
  console.log('🎥 Service: Updating video progress:', {
    trainingId,
    videoId,
    watchTimeSeconds,
    isCompleted,
    userId,
    endpoint: `${this.TRAINING_ENDPOINT}/${trainingId}/videos/${videoId}/progress`
  });

  // Validate inputs
  if (!trainingId || !videoId) {
    console.error('❌ Missing required parameters:', { trainingId, videoId });
    return throwError(() => new Error('Missing required parameters: trainingId and videoId'));
  }

  const requestBody = { 
    watch_time_seconds: watchTimeSeconds, 
    is_completed: isCompleted,
    user_id: userId
  };

  console.log('📤 Request body:', requestBody);

  return this.http.put<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/${trainingId}/videos/${videoId}/progress`,
    requestBody,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('✅ Video progress response received:', {
        success: response.success,
        hasData: !!response.data,
        overall_progress: response.data?.overall_progress,
        training_completed: response.data?.training_completed,
        certificate_issued: response.data?.certificate_issued
      });
    }),
    catchError((error) => {
      console.error('❌ Video progress update failed:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url,
        errorBody: error.error
      });
      return this.handleError(error);
    })
  );
}

  markVideoComplete(videoId: string): Observable<ApiResponse<any>> {
    return this.updateVideoProgress('', videoId, 0, true); // Simplified; adjust trainingId if needed
  }

  // ============================================
  // NOTIFICATIONS (EMPLOYER)
  // ============================================

  getEnrollmentNotifications(employerId: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.TRAINING_ENDPOINT}/employer/enrollment-notifications?employer_id=${employerId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('🔔 Enrollment notifications:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  // ============================================
  // NOTIFICATIONS (JOBSEEKER/EMPLOYER)
  // ============================================

getNotifications(
  userId: string,
  params: { read?: boolean },  // Expect boolean
  userType: 'jobseeker' | 'employer' = 'jobseeker'
): Observable<ApiResponse<any>> {
  let httpParams = new HttpParams();
  if (userType === 'jobseeker') {
    httpParams = httpParams.set('user_id', userId);
  } else {
    httpParams = httpParams.set('employer_id', userId);
  }
  // FIXED: Pass boolean directly (backend parses string if needed)
  if (params.read !== undefined) {
    httpParams = httpParams.set('read', params.read.toString());  // Still string for URL, but backend parses
  }
  console.log('🔔 Fetching notifications:', { userId, userType, read: params.read });
  return this.http.get<ApiResponse<any>>(
    `${this.TRAINING_ENDPOINT}/notifications`,
    { headers: this.getAuthHeaders(), params: httpParams }
  ).pipe(
    tap(response => console.log('🔔 Notifications loaded:', response.data?.notifications?.length || 0)),
    catchError(this.handleError.bind(this))
  );
}

markNotificationRead(
  notificationId: string, 
  userId: string,
  userType: 'jobseeker' | 'employer' = 'jobseeker'
): Observable<ApiResponse<void>> {
  let httpParams = new HttpParams();
  
  if (userType === 'jobseeker') {
    httpParams = httpParams.set('user_id', userId);
  } else {
    httpParams = httpParams.set('employer_id', userId);
  }

  return this.http.put<ApiResponse<void>>(
    `${this.TRAINING_ENDPOINT}/notifications/${notificationId}/read`,
    {},
    { 
      headers: this.getAuthHeaders(),
      params: httpParams
    }
  ).pipe(
    tap(() => console.log('✅ Notification marked as read:', notificationId)),
    catchError(this.handleError.bind(this))
  );
}

  // ============================================
  // CERTIFICATES
  // ============================================

  issueCertificate(enrollmentId: string, employerId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/issue-certificate`,
      { employer_id: employerId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('🎓 Certificate issued:', response)),
      catchError(this.handleError.bind(this))
    );
  }

triggerCertificateDownload(enrollmentId: string, trainingTitle: string): void {
  console.log('📥 Triggering certificate download:', {
    enrollmentId,
    trainingTitle
  });
  
  // Validate inputs
  if (!enrollmentId) {
    console.error('❌ No enrollment ID provided');
    alert('Cannot download certificate: Enrollment ID is missing');
    return;
  }
  
  // Provide default title if missing and sanitize it
  const sanitizedTitle = (trainingTitle || 'Training')
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')            // Replace spaces with hyphens
    .substring(0, 50);                // Limit length
  
  console.log('📝 Sanitized title:', sanitizedTitle);
  
  this.downloadCertificate(enrollmentId).subscribe({
    next: (blob) => {
      console.log('✅ Certificate blob received, creating download link');
      
      try {
        // Create blob URL
        const url = window.URL.createObjectURL(blob);
        
        // Create temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificate-${sanitizedTitle}.pdf`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after a short delay
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          console.log('✅ Certificate download completed and cleaned up');
        }, 100);
        
        // Show success message
        console.log('✅ Certificate download triggered successfully');
        
      } catch (error) {
        console.error('❌ Error creating download link:', error);
        alert('Failed to download certificate. Please try again.');
      }
    },
    error: (error) => {
      console.error('❌ Certificate download failed:', error);
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to download certificate. Please try again.';
      alert(errorMessage);
    }
  });
}

openCertificateInNewTab(enrollmentId: string): void {
  console.log('📥 Opening certificate in new tab:', enrollmentId);
  
  if (!enrollmentId) {
    console.error('❌ No enrollment ID provided');
    alert('Cannot open certificate: Enrollment ID is missing');
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Authentication required. Please log in again.');
    return;
  }
  
  // Create URL with token as query parameter (for direct browser access)
  const url = `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/certificate?token=${encodeURIComponent(token)}`;
  
  // Open in new tab
  window.open(url, '_blank');
  
  console.log('✅ Certificate opened in new tab');
}


checkCertificateAvailability(enrollmentId: string): Observable<ApiResponse<{ available: boolean, reason?: string }>> {
  console.log('🔍 Checking certificate availability:', enrollmentId);
  
  return this.http.get<ApiResponse<{ available: boolean, reason?: string }>>(
    `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/certificate/status`,
    { headers: this.getAuthHeaders() }
  ).pipe(
    tap(response => {
      console.log('✅ Certificate availability:', response);
    }),
    catchError(error => {
      console.error('❌ Error checking certificate availability:', error);
      return of({
        success: false,
        data: { available: false, reason: 'Unable to check certificate status' }
      } as ApiResponse<{ available: boolean, reason?: string }>);
    })
  );
}

  // ============================================
  // OTHER STUBS (SIMPLE IMPLEMENTATIONS)
  // ============================================

  getTrainingWithDetailsForJobseeker(id: string, userId: string): Observable<ApiResponse<Training>> {
    const params = new HttpParams()
      .set('include_videos', 'true')
      .set('include_outcomes', 'true')
      .set('user_id', userId);
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${id}`,
      { 
        headers: this.getAuthHeaders(),
        params 
      }
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

  enrollUserInTraining(id: string, userId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${id}/enroll`,
      { user_id: userId },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('Enrollment response:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  private readonly API_BASE = environment.apiUrl;
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

  private buildParams(params: TrainingSearchParams): HttpParams {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });
    
    return httpParams;
  }

  /**
   * CRITICAL FIX: Normalize video data to handle both duration and duration_minutes fields
   */
  private normalizeVideoData(video: any): TrainingVideo {
    // Handle both possible field names and ensure duration_minutes is set
    const durationMinutes = video.duration_minutes || video.duration || 0;
    
    const normalizedVideo: TrainingVideo = {
      id: video.id,
      training_id: video.training_id,
      title: video.title || '',
      description: video.description || '',
      video_url: video.video_url || '',
      duration_minutes: durationMinutes,
      duration: durationMinutes, // Keep both for backward compatibility
      order_index: video.order_index !== undefined ? video.order_index : 0,
      is_preview: video.is_preview || false,
      completed: video.completed || false,
      created_at: video.created_at,
      url: ''
    };
    
    console.log('Normalized video:', {
      title: normalizedVideo.title,
      duration_minutes: normalizedVideo.duration_minutes,
      original_duration: video.duration,
      original_duration_minutes: video.duration_minutes
    });
    
    return normalizedVideo;
  }

  /**
   * CRITICAL FIX: Process training data to ensure videos array is always properly initialized
   * ENHANCED: Preserve video_count and handle legacy video_urls OR videos (string arrays)
   */
  private processTrainingData(training: any): Training {
    console.log('=== Processing Training Data ===');
    console.log('Training ID:', training.id);
    console.log('Training Title:', training.title);
    console.log('Raw videos data:', training.videos);
    console.log('Raw video_count:', training.video_count);
    console.log('Legacy video_urls:', training.video_urls);

    // ENHANCED: Compute video_count from multiple sources (prioritize explicit, then length)
    let videoCount = training.video_count || training.total_videos || 0;
    if (Array.isArray(training.videos)) {
      videoCount = Math.max(videoCount, training.videos.length);
    } else if (Array.isArray(training.video_urls)) {
      videoCount = Math.max(videoCount, training.video_urls.length);
    }
    console.log('Computed video_count:', videoCount);

    // Initialize videos array
    let processedVideos: TrainingVideo[] = [];
    
    if (training.videos) {
      if (Array.isArray(training.videos) && typeof training.videos[0] === 'object') {
        // Full video objects (new format)
        processedVideos = training.videos
          .filter((v: any) => v !== null && v !== undefined)
          .map((v: any) => this.normalizeVideoData(v));
        console.log('Processed object videos:', processedVideos.length);
      } else if (Array.isArray(training.videos)) {
        // FIXED: Legacy string array (e.g., from updated SQL AS videos)
        processedVideos = (training.videos || []).map((url: string, i: number) => ({
          id: `legacy-${i}`,
          title: `Video ${i + 1}`,
          video_url: url,
          duration_minutes: 0,
          order_index: i
        } as TrainingVideo));
        console.log('Processed string videos:', processedVideos.length);
      }
    } else if (training.video_urls && Array.isArray(training.video_urls)) {
      // FIXED: Legacy from older queries (e.g., AS video_urls)
      processedVideos = (training.video_urls || []).map((url: string, i: number) => ({
        id: `legacy-${i}`,
        title: `Video ${i + 1}`,
        video_url: url,
        duration_minutes: 0,
        order_index: i
      } as TrainingVideo));
      console.log('Processed legacy video_urls:', processedVideos.length);
    }
    
    // NEW: If no videos but count >0, log warning (possible backend issue)
    if (processedVideos.length === 0 && videoCount > 0) {
      console.warn(`Mismatch: ${videoCount} videos expected but 0 processed for ${training.title}`);
    }

    // Don't set empty videos in list view; let template use video_count
    const videosToSet = processedVideos.length > 0 ? processedVideos : undefined;

    // Initialize outcomes array
    let processedOutcomes: TrainingOutcome[] = [];
    
    if (training.outcomes) {
      if (Array.isArray(training.outcomes)) {
        processedOutcomes = training.outcomes.filter((o: any) => o !== null && o !== undefined);
      } else if (typeof training.outcomes === 'object') {
        processedOutcomes = [training.outcomes];
      }
    }
    const outcomesToSet = processedOutcomes.length > 0 ? processedOutcomes : undefined;
    
    const processedTraining: Training = {
      ...training,
      videos: videosToSet,
      outcomes: outcomesToSet,
      video_count: videoCount,  // ENHANCED: Always set computed count
      enrolled: training.enrolled || false,
      progress: training.progress || 0
    };

    // FIXED: Clean up legacy fields to avoid type pollution
    delete (processedTraining as any).video_urls;
    if (Array.isArray(processedTraining.videos) && processedVideos.length === 0) {
      delete (processedTraining as any).videos;  // Avoid empty array pollution
    }

    console.log('=== Processed Training Result ===');
    console.log('Videos count:', processedVideos.length);
    console.log('Video titles:', processedVideos.map(v => v.title));
    console.log('Outcomes count:', processedOutcomes.length);
    console.log('Final video_count:', processedTraining.video_count);
    console.log('=====================================');
    
    return processedTraining;
  }

  /**
   * EMPLOYER: Get trainings created by the employer
   */
   getMyTrainings(params: TrainingSearchParams = {}, employerId?: string): Observable<PaginatedResponse<{ trainings: Training[] }>> { // FIXED: Accept employerId
    this.loadingSubject.next(true);
    
    // CRITICAL: Always include videos, outcomes, AND enrollment stats
    const enhancedParams = {
      ...params,
      include_videos: true,
      include_outcomes: true,
      include_enrollment_stats: true,  // NEW: Request enrollment statistics
      employer_id: employerId // FIXED: Pass employerId as param
    };
    
    const httpParams = this.buildParams(enhancedParams);
    
    console.log('Fetching employer trainings with params:', enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      this.TRAINING_ENDPOINT, 
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      map(response => {
        console.log('=== Employer Trainings API Response ===');
        console.log('Success:', response.success);
        console.log('Training count:', response.data?.trainings?.length || 0);
        
        if (response.success && response.data?.trainings) {
          response.data.trainings = response.data.trainings.map(t => {
            const processed = this.processTrainingData(t);
            
            // FIXED: Ensure enrollment count is preserved from backend
            console.log(`Training "${processed.title}" enrollments:`, {
              total_students: processed.total_students,
              current_participants: processed.current_participants
            });
            
            return processed;
          });
          
          console.log('Processed trainings summary:');
          response.data.trainings.forEach(t => {
            console.log(`- ${t.title}: ${t.videos?.length || t.video_count || 0} videos, ${t.total_students || 0} enrollments`);
          });
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

  private fetchTrainingVideos(trainingId: string): Observable<TrainingVideo[]> {
    console.log('Fetching videos separately for training:', trainingId);
    
    return this.http.get<ApiResponse<{ videos: any[] }>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/videos`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        if (response.success && response.data?.videos) {
          return response.data.videos.map(v => this.normalizeVideoData(v));
        }
        return [];
      }),
      catchError(err => {
        console.error('Error fetching videos:', err);
        return of([]);
      })
    );
  }

  /**
   * EMPLOYER: Create new training
   */
  createTraining(trainingData: CreateTrainingRequest, employerId: string): Observable<ApiResponse<Training>> {
    console.log('=== Creating Training ===');
    console.log('Title:', trainingData.title);
    console.log('Videos being sent:', trainingData.videos);
    console.log('Videos count:', trainingData.videos.length);
    
    const token = localStorage.getItem('token');
    if (!token) {
      return throwError(() => new Error('Authentication required'));
    }

    this.loadingSubject.next(true);
    
    // Normalize video data before sending
    const normalizedData = {
      ...trainingData,
      videos: trainingData.videos.map(v => this.normalizeVideoData(v))
    };
    
    console.log('Normalized videos:', normalizedData.videos);
    
    return this.http.post<ApiResponse<Training>>(
      this.TRAINING_ENDPOINT,
      normalizedData,
      { headers: this.getAuthHeaders() }
    ).pipe(
      map(response => {
        console.log('=== Training Creation Response ===');
        console.log('Success:', response.success);
        console.log('Response data:', response.data);
        
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
          console.log('Created training has', response.data.videos?.length || response.data.video_count || 0, 'videos');
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

  /**
   * EMPLOYER: Update existing training
   */
  updateTraining(id: string, trainingData: UpdateTrainingRequest, employerId: string): Observable<ApiResponse<Training>> {
    this.loadingSubject.next(true);
    
    // Normalize video data if present
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

  /**
   * EMPLOYER: Delete training
   */
  deleteTraining(id: string, employerId: string): Observable<ApiResponse<void>> {
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

  /**
   * EMPLOYER: Publish training
   */
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

  /**
   * EMPLOYER: Unpublish training
   */
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

  /**
   * EMPLOYER: Suspend training
   */
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

  /**
   * JOBSEEKER: Get available trainings - CRITICAL FIX
   */

  /**
   * JOBSEEKER: Get available trainings - CRITICAL FIX
   */

  getJobseekerTrainings(params: TrainingSearchParams = {}): Observable<PaginatedResponse<{ trainings: Training[] }>> {
    this.loadingSubject.next(true);
    
    console.log('=== Fetching Jobseeker Trainings ===');
    console.log('Initial params:', params);
    
    // CRITICAL: Always include videos, outcomes, AND filter for published status only
    const enhancedParams = {
      ...params,
      include_videos: true,
      include_outcomes: true,
      status: 'published'  // CRITICAL: Only fetch published trainings
    };
    
    console.log('Enhanced params with video flag and published status:', enhancedParams);
    
    const httpParams = this.buildParams(enhancedParams);
    
    return this.http.get<PaginatedResponse<{ trainings: Training[] }>>(
      `${this.TRAINING_ENDPOINT}/jobseeker/available`,
      { 
        headers: this.getAuthHeaders(),
        params: httpParams
      }
    ).pipe(
      map(response => {
        console.log('=== Jobseeker Trainings API Response ===');
        console.log('Success:', response.success);
        console.log('Training count:', response.data?.trainings?.length || 0);
        console.log('Raw response data:', response.data);
        
        if (response.success && response.data?.trainings) {
          // Log ALL trainings before filtering
          console.log('\n=== RAW TRAININGS FROM API ===');
          response.data.trainings.forEach((t, i) => {
            console.log(`[${i}] ${t.title} | Status: ${t.status} | Provider: ${t.provider_name} (ID: ${t.provider_id})`);
          });
          
          // ADDITIONAL SECURITY: Filter out any non-published trainings on client side
          const publishedTrainings = response.data.trainings.filter(
            training => {
              const isPublished = training.status === 'published';
              if (!isPublished) {
                console.warn(`⚠️ Filtering out NON-PUBLISHED training: "${training.title}" (Status: ${training.status})`);
              }
              return isPublished;
            }
          );
          
          console.log(`\n📊 Filtered ${response.data.trainings.length} to ${publishedTrainings.length} published trainings`);
          
          // Additional validation
          const validTrainings = publishedTrainings.filter(training => {
            const isValid = training.id && training.title && training.provider_name;
            if (!isValid) {
              console.warn(`⚠️ Filtering out INVALID training:`, training);
            }
            return isValid;
          });
          
          console.log(`✅ Final valid trainings: ${validTrainings.length}`);
          
          // Process each training
          response.data.trainings = validTrainings.map(t => this.processTrainingData(t));
          
          console.log('\n=== PROCESSED TRAININGS SUMMARY ===');
          response.data.trainings.forEach(t => {
            console.log(`✓ ${t.title} (Status: ${t.status}, Provider: ${t.provider_name}): ${t.videos?.length || t.video_count || 0} videos`);
          });
        } else {
          console.warn('⚠️ No training data in response');
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

  /**
   * NEW: Fetch video count only (lightweight, for fallback)
   */
  getVideoCount(trainingId: string): Observable<ApiResponse<{ count: number }>> {
    console.log('Fetching video count for:', trainingId);
    return this.http.get<ApiResponse<{ count: number }>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/video-count`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('Video count response:', response)),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Get full training details with videos and outcomes - CRITICAL FIX
   */
  getTrainingDetails(trainingId: string): Observable<ApiResponse<Training>> {
    console.log('=== Fetching Training Details ===');
    console.log('Training ID:', trainingId);
    
    const params = new HttpParams()
      .set('include_videos', 'true')
      .set('include_outcomes', 'true')
      .set('include_video_count', 'true');  // NEW: Explicit count flag
    
    return this.http.get<ApiResponse<Training>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}`,
      { 
        headers: this.getAuthHeaders(),
        params: params
      }
    ).pipe(
      map(response => {
        console.log('=== Training Details API Response ===');
        console.log('Success:', response.success);
        console.log('Raw data:', response.data);
        console.log('Raw video_count:', response.data?.video_count);
        
        if (response.success && response.data) {
          response.data = this.processTrainingData(response.data);
          console.log('Processed training details:');
          console.log('- Title:', response.data.title);
          console.log('- Videos:', response.data.videos?.length || response.data.video_count || 0);
          console.log('- Outcomes:', response.data.outcomes?.length || 0);
        }
        return response;
      }),
      tap(response => {
        this.errorSubject.next(null);
      }),
      catchError(error => {
        console.error('Error fetching training details:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * JOBSEEKER: Enroll in training
   */
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

  /**
   * JOBSEEKER: Get enrolled trainings
   */
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

  /**
   * VIDEO UTILITY METHODS
   */
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

  /**
   * ANALYTICS AND STATS
   */
  getTrainingStats(employerId: string): Observable<ApiResponse<TrainingStats>> {
    return this.http.get<ApiResponse<TrainingStats>>(
      `${this.TRAINING_ENDPOINT}/stats/overview`,
      { 
        headers: this.getAuthHeaders(),
        params: new HttpParams().set('employer_id', employerId) // FIXED: Pass employerId
      }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  getTrainingEnrollments(id: string, employerId: string, params: any = {}): Observable<ApiResponse<any>> { // FIXED: Accept employerId
    const httpParams = this.buildParams({ ...params, employer_id: employerId }); // FIXED: Pass employerId
    
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

  getTrainingAnalytics(id: string, employerId: string, timeRange: string = '30days'): Observable<ApiResponse<any>> { // FIXED: Proper signature and pass employerId
    const params = new HttpParams()
      .set('range', timeRange)
      .set('employer_id', employerId); // FIXED: Pass employerId
    
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

  /**
   * UTILITY METHODS
   */
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

  // In TrainingService class...

  saveVideoProgress(trainingId: string, videoId: string, watchTime: number, isCompleted: boolean): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/progress`,
      { video_id: videoId, watch_time_minutes: watchTime / 60, is_completed: isCompleted },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  updateTrainingProgress(trainingId: string, progress: number): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(
      `${this.TRAINING_ENDPOINT}/${trainingId}/progress`,
      { progress_percentage: progress },
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

downloadCertificate(enrollmentId: string): Observable<Blob> {
  console.log('📥 Frontend: Downloading certificate for enrollment:', enrollmentId);
  
  if (!enrollmentId) {
    console.error('❌ No enrollment ID provided');
    return throwError(() => new Error('Enrollment ID is required'));
  }
  
  return this.http.get(
    `${this.TRAINING_ENDPOINT}/enrollments/${enrollmentId}/certificate`, 
    {
      responseType: 'blob',
      headers: this.getAuthHeaders(),
      observe: 'response'
    }
  ).pipe(
    map(response => {
      console.log('✅ Certificate response received:', {
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        size: response.body?.size
      });
      
      if (!response.body) {
        throw new Error('Certificate data is empty');
      }
      
      return response.body;
    }),
    catchError((error) => {
      console.error('❌ Certificate download error:', {
        status: error.status,
        message: error.message,
        error: error.error,
        url: error.url
      });
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to download certificate';
      
      if (error.status === 404) {
        errorMessage = 'Certificate not found. Please ensure you have completed the training.';
      } else if (error.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to download this certificate.';
      } else if (error.status === 500) {
        errorMessage = 'Server error while generating certificate. Please try again later.';
      }
      
      return throwError(() => new Error(errorMessage));
    })
  );
}
}