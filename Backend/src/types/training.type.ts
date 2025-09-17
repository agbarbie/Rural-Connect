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

export interface TrainingVideoProgress {
  id: string;
  enrollment_id: string;
  video_id: string;
  completed_at?: Date;
  watch_time_minutes: number;
  is_completed: boolean;
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

export interface TrainingSearchParams {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'title' | 'rating' | 'total_students' | 'start_date';
  sort_order?: 'asc' | 'desc';
  filters?: TrainingFilters;
}

export interface TrainingListResponse {
  trainings: Training[];
  pagination: {
    current_page: number;
    total_pages: number;
    page_size: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
  filters_applied: TrainingFilters;
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

export interface TrainingReviewRequest {
  training_id: string;
  rating: number;
  review_text?: string;
}

export interface VideoProgressRequest {
  video_id: string;
  watch_time_minutes: number;
  is_completed: boolean;
}

export interface BulkTrainingOperation {
  training_ids: string[];
  operation: 'publish' | 'suspend' | 'delete' | 'duplicate';
}

// Error types
export interface TrainingError {
  code: string;
  message: string;
  field?: string;
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

// Export utility types
export type TrainingStatus = Training['status'];
export type TrainingLevel = Training['level'];
export type TrainingCostType = Training['cost_type'];
export type TrainingMode = Training['mode'];
export type EnrollmentStatus = TrainingEnrollment['status'];