// training.type.ts - Shared TypeScript types for training system

export interface TrainingVideo {
  id: string;
  training_id: string;
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number;
  order_index: number;
  is_preview: boolean;
  created_at: Date;
  
  // Frontend specific properties (computed)
  completed?: boolean;
  duration?: string; // Formatted duration like "12:30"
}

export interface TrainingOutcome {
  id: string;
  training_id: string;
  outcome_text: string;
  order_index: number;
  created_at: Date;
}

export interface TrainingCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: Date;
}

export interface TrainingCategoryStats {
  name: string;
  training_count: number;
  avg_rating: number;
  free_count: number;
  certificate_count: number;
}

export interface TrainingReview {
  id: string;
  training_id: string;
  user_id: string;
  rating: number;
  review_text?: string;
  created_at: Date;
  updated_at: Date;
  
  // Populated fields
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image?: string;
  };
}

export interface TrainingEnrollment {
  id: string;
  training_id: string;
  user_id: string;
  enrolled_at: Date;
  progress_percentage: number;
  completed_at?: Date;
  certificate_issued: boolean;
  certificate_url?: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  
  // Populated fields
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
  training?: Training;
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
  location?: string; // For offline trainings
  start_date?: Date;
  end_date?: Date;
  max_participants?: number;
  current_participants: number;
  status: 'draft' | 'published' | 'suspended' | 'completed';
  created_at: Date;
  updated_at: Date;
  
  // Populated/computed fields
  videos?: TrainingVideo[];
  outcomes?: TrainingOutcome[];
  reviews?: TrainingReview[];
  enrollments?: TrainingEnrollment[];
  
  // Frontend specific computed properties
  duration?: string; // Formatted like "45 hours"
  cost?: string; // "Free" or "Paid"
  students?: number; // Same as total_students
  certificate?: boolean; // Same as has_certificate
  provider?: string; // Same as provider_name
  thumbnail?: string; // Same as thumbnail_url
  progress?: number; // For enrolled users
  enrolled?: boolean; // For current user
  
  // Analytics fields
  video_count?: number;
  enrollment_count?: number;
  review_count?: number;
  completion_rate?: number;
  completed_count?: number;
  in_progress_count?: number;
  enrolled_count?: number;
  dropped_count?: number;
}

export interface TrainingWithEnrollment extends Training {
  enrolled: boolean;
  progress: number;
  enrollment_status?: EnrollmentStatus;
  enrolled_at?: Date;
  completed_at?: Date;
}

export interface RecommendedTraining extends Training {
  relevance_score: number;
  recommendation_reason: string;
}

export interface TrainingVideoProgress {
  id: string;
  enrollment_id: string;
  video_id: string;
  completed_at?: Date;
  watch_time_minutes: number;
  is_completed: boolean;
}

export interface VideoProgressUpdate {
  video_id: string;
  watch_time_minutes: number;
  is_completed: boolean;
}

export interface TrainingProgressResponse {
  enrollment_id: string;
  training_id: string;
  training_title: string;
  duration_hours: number;
  progress_percentage: number;
  status: EnrollmentStatus;
  enrolled_at: Date;
  completed_at?: Date;
  video_progress: {
    video_id: string;
    video_title: string;
    video_duration: number;
    order_index: number;
    completed: boolean;
    watch_time: number;
    completed_at?: Date;
  }[];
}

export interface TrainingPrerequisite {
  id: string;
  training_id: string;
  prerequisite_training_id: string;
  is_mandatory: boolean;
  created_at: Date;
  
  // Populated fields
  prerequisite_training?: Training;
}

export interface JobseekerTrainingStats {
  total_enrolled: number;
  completed_count: number;
  in_progress_count: number;
  certificates_earned: number;
  avg_progress: number;
  total_spent: number;
  monthly_enrollments: {
    month: Date;
    count: number;
  }[];
}

// Request/Response DTOs

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
  videos: CreateTrainingVideoRequest[];
  outcomes: CreateTrainingOutcomeRequest[];
  prerequisites?: string[]; // Array of training IDs
}

export interface UpdateTrainingRequest {
  title?: string;
  description?: string;
  category?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours?: number;
  cost_type?: 'Free' | 'Paid';
  price?: number;
  mode?: 'Online' | 'Offline';
  provider_name?: string;
  has_certificate?: boolean;
  thumbnail_url?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  max_participants?: number;
  status?: 'draft' | 'published' | 'suspended' | 'completed';
  videos?: UpdateTrainingVideoRequest[];
  outcomes?: UpdateTrainingOutcomeRequest[];
  prerequisites?: string[];
}

export interface CreateTrainingVideoRequest {
  title: string;
  description?: string;
  video_url?: string;
  duration_minutes: number;
  order_index: number;
  is_preview?: boolean;
}

export interface UpdateTrainingVideoRequest {
  id?: string;
  title?: string;
  description?: string;
  video_url?: string;
  duration_minutes?: number;
  order_index?: number;
  is_preview?: boolean;
}

export interface CreateTrainingOutcomeRequest {
  outcome_text: string;
  order_index: number;
}

export interface UpdateTrainingOutcomeRequest {
  id?: string;
  outcome_text?: string;
  order_index?: number;
}

export interface TrainingFilters {
  category?: string;
  level?: string[];
  cost_type?: string[];
  mode?: string[];
  duration?: string[]; // ['short', 'medium', 'long']
  rating?: number;
  has_certificate?: boolean;
  status?: string[];
  provider_id?: string;
  search?: string;
}

export interface JobseekerTrainingFilters extends TrainingFilters {
  enrolled_status?: 'all' | 'enrolled' | 'not_enrolled';
  completion_status?: 'all' | 'completed' | 'in_progress' | 'not_started';
  min_rating?: number;
  max_price?: number;
  has_preview?: boolean;
  recent?: boolean; // Recently added trainings
}

export interface TrainingSearchParams {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'title' | 'rating' | 'total_students' | 'start_date';
  sort_order?: 'asc' | 'desc';
  filters?: JobseekerTrainingFilters;
}

export interface TrainingListResponse {
  trainings: TrainingWithEnrollment[];
  pagination: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
  filters_applied: JobseekerTrainingFilters;
  summary?: {
    total_available: number;
    total_enrolled: number;
    total_completed: number;
    avg_rating: number;
  };
}

export interface JobseekerTrainingListResponse {
  trainings: TrainingWithEnrollment[];
  pagination: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
  filters_applied: JobseekerTrainingFilters;
  summary: {
    total_available: number;
    total_enrolled: number;
    total_completed: number;
    avg_rating: number;
  };
}

export interface TrainingStatsResponse {
  total_trainings: number;
  published_trainings: number;
  draft_trainings: number;
  suspended_trainings: number;
  total_enrollments: number;
  total_revenue: number;
  avg_rating: number;
  completion_rate: number;
  categories_breakdown: {
    category: string;
    count: number;
  }[];
  monthly_enrollments: {
    month: string;
    count: number;
  }[];
}

export interface EnrollmentRequest {
  training_id: string;
}

export interface EnrollmentResponse {
  id: string;
  training_id: string;
  user_id: string;
  status: EnrollmentStatus;
  enrolled_at: Date;
  progress_percentage: number;
  message?: string;
}

export interface TrainingReviewRequest {
  training_id: string;
  rating: number;
  review_text?: string;
}

export interface SubmitReviewRequest {
  rating: number;
  review_text?: string;
}

export interface VideoProgressRequest {
  video_id: string;
  watch_time_minutes: number;
  is_completed: boolean;
}

export interface ProgressUpdateResponse {
  video_progress: TrainingVideoProgress;
  enrollment: TrainingEnrollment;
  overall_progress: number;
  achievements?: {
    type: 'milestone' | 'completion' | 'certificate';
    message: string;
  }[];
}

export interface BulkTrainingOperation {
  training_ids: string[];
  operation: 'publish' | 'suspend' | 'delete' | 'duplicate';
}

export interface BulkEnrollmentRequest {
  training_ids: string[];
}

export interface BulkEnrollmentResponse {
  successful_enrollments: string[];
  failed_enrollments: {
    training_id: string;
    reason: string;
  }[];
}

export interface TrainingSearchFilters {
  query?: string;
  categories?: string[];
  levels?: TrainingLevel[];
  cost_types?: TrainingCostType[];
  modes?: TrainingMode[];
  duration_range?: {
    min_hours?: number;
    max_hours?: number;
  };
  rating_range?: {
    min_rating?: number;
    max_rating?: number;
  };
  price_range?: {
    min_price?: number;
    max_price?: number;
  };
  has_certificate?: boolean;
  has_preview?: boolean;
  availability?: 'available' | 'full' | 'starting_soon';
}

// Error types
export interface TrainingError {
  code: string;
  message: string;
  field?: string;
}

export interface JobseekerTrainingError extends TrainingError {
  error_type: 'enrollment' | 'progress' | 'review' | 'access';
  user_id?: string;
  training_id?: string;
  suggested_action?: string;
}

export interface TrainingValidationError {
  errors: TrainingError[];
}

// Certificate types
export interface CertificateTemplate {
  id: string;
  name: string;
  template_url: string;
  is_default: boolean;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  template_id: string;
  certificate_url: string;
  issued_at: Date;
  verification_code: string;
}

export interface CertificateGenerationRequest {
  enrollment_id: string;
  template_id?: string;
}

// Analytics types
export interface TrainingAnalytics {
  training_id: string;
  total_enrollments: number;
  completed_enrollments: number;
  avg_completion_time_hours: number;
  avg_rating: number;
  revenue: number;
  completion_rate: number;
  drop_rate: number;
  avg_watch_time_per_video: number;
  most_watched_video: TrainingVideo;
  least_watched_video: TrainingVideo;
  enrollment_trend: {
    date: string;
    count: number;
  }[];
  completion_trend: {
    date: string;
    count: number;
  }[];
}

export interface JobseekerAnalytics {
  user_id: string;
  learning_time_weekly: number;
  completion_rate: number;
  preferred_categories: string[];
  preferred_difficulty: TrainingLevel;
  engagement_score: number;
  last_activity: Date;
}

// Learning path (for future enhancement)
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  training_ids: string[];
  estimated_duration_hours: number;
  difficulty_level: TrainingLevel;
  completion_reward?: string;
  created_at: Date;
}

// Watchlist/Favorites
export interface TrainingWishlist {
  id: string;
  user_id: string;
  training_id: string;
  added_at: Date;
  training?: Training;
}

// Discussion/Community features (for future enhancement)
export interface TrainingDiscussion {
  id: string;
  training_id: string;
  user_id: string;
  parent_id?: string; // For replies
  message: string;
  created_at: Date;
  updated_at: Date;
  likes_count: number;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image?: string;
  };
}

// Notification preferences
export interface TrainingNotificationSettings {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  notifications: {
    enrollment_confirmation: boolean;
    progress_milestones: boolean;
    certificate_available: boolean;
    new_recommendations: boolean;
    training_updates: boolean;
    community_activity: boolean;
  };
}

// API Response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: {
    timestamp: Date;
    request_id: string;
  };
}

export interface PaginatedApiResponse<T> extends ApiResponse<T> {
  pagination?: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Validation schemas (for request validation)
export interface EnrollmentValidation {
  training_id: string;
  user_id: string;
  prerequisites_met: boolean;
  capacity_available: boolean;
  payment_required: boolean;
}

// Export utility types
export type TrainingStatus = Training['status'];
export type TrainingLevel = Training['level'];
export type TrainingCostType = Training['cost_type'];
export type TrainingMode = Training['mode'];
export type EnrollmentStatus = TrainingEnrollment['status'];
export type JobseekerTrainingStatus = 'available' | 'enrolled' | 'in_progress' | 'completed' | 'dropped';
export type ProgressMilestone = 25 | 50 | 75 | 100;
export type NotificationType = 'enrollment' | 'progress' | 'completion' | 'certificate' | 'recommendation';