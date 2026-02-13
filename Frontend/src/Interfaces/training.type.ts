// src/app/types/training.type.ts

// Training Session (live meeting)
export interface TrainingSession {
  id?: string;
  training_id?: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url?: string;
  meeting_password?: string;
  meeting_token?: string;          // ✅ ADD THIS
  participant_role?: string;
  meeting_id?: string;
  order_index: number;
  is_completed?: boolean;
  attendance_count?: number;
  created_at?: Date;
  updated_at?: Date;
}

// Learning Outcome
export interface TrainingOutcome {
  id?: string;
  training_id?: string;
  outcome_text: string;
  order_index: number;
  created_at?: Date;
}

// Training Application
export interface TrainingApplication {
  id?: string;
  training_id?: string;
  user_id?: string;
  motivation?: string;
  status: 'pending' | 'shortlisted' | 'rejected';
  applied_at?: Date;
  reviewed_at?: Date;
  employer_notes?: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_image?: string;
  };
}

// Training Enrollment
export interface TrainingEnrollment {
  id: string;
  training_id: string;
  user_id: string;
  application_id?: string;
  status: 'enrolled' | 'completed' | 'not_completed' | 'dropped';
  enrolled_at: Date;
  completed_at?: Date;
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
  mode: 'Online' | 'Offline' | 'Hybrid';
  provider_id: string;
  provider_name: string;
  has_certificate: boolean;
  rating: number;
  total_students: number;
  thumbnail_url?: string;
  location?: string;
  
  // Application & Schedule
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  application_deadline?: Date;
  training_start_date?: Date;
  training_end_date?: Date;
  start_date?: Date;               // ✅ ADD THIS
  end_date?: Date;    
  max_participants?: number;
  current_participants: number;

  meeting_id?: string;
  meeting_title?: string;
  
  // Status
  status: 'draft' | 'published' | 'applications_closed' | 'in_progress' | 'completed';
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  
  // Relations
  sessions?: TrainingSession[];
  outcomes?: TrainingOutcome[];
  session_count?: number;
  
  // User-specific (populated for jobseekers)
  applied?: boolean;
  application_status?: 'pending' | 'shortlisted' | 'rejected';
  enrolled?: boolean;
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

// Create Training Request
export interface CreateTrainingRequest {
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  cost_type: 'Free' | 'Paid';
  price?: number;
  mode: 'Online' | 'Offline' | 'Hybrid';
  provider_name: string;
  has_certificate: boolean;
  thumbnail_url?: string;
  location?: string;
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  
  // ✅ Accept both naming conventions for dates
  application_deadline?: string;
  training_start_date?: string;
  training_end_date?: string;
  start_date?: string;
  end_date?: string;
  
  max_participants?: number;
  sessions: TrainingSession[];
  outcomes: TrainingOutcome[];
}

// Update Training Request
export interface UpdateTrainingRequest {
  title?: string;
  description?: string;
  category?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours?: number;
  cost_type?: 'Free' | 'Paid';
  price?: number;
  mode?: 'Online' | 'Offline' | 'Hybrid';
  provider_name?: string;
  has_certificate?: boolean;
  thumbnail_url?: string;
  location?: string;
  application_url?: string;
  training_objectives?: string;
  skills_to_acquire?: string[];
  eligibility_requirements?: string;
  
  // ✅ Accept both naming conventions for dates
  application_deadline?: string;
  training_start_date?: string;
  training_end_date?: string;
  start_date?: string;
  end_date?: string;
  
  max_participants?: number;
  status?: 'draft' | 'published' | 'applications_closed' | 'in_progress' | 'completed';
  sessions?: TrainingSession[];
  outcomes?: TrainingOutcome[];
}

// Search Parameters
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
  filters?: {
    category?: string;
    level?: string[];
    cost_type?: string[];
    mode?: string[];
    rating?: number;
    has_certificate?: boolean;
    status?: string[];
    provider_id?: string;
    search?: string;
  };
}

// Training List Response
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
  filters_applied?: any;
}

// Training Stats
export interface TrainingStatsResponse {
  total_trainings: number;
  published_trainings: number;
  draft_trainings: number;
  suspended_trainings?: number;
  total_applications: number;
  pending_applications?: number;
  total_enrollments: number;
  total_completions: number;
  total_revenue: number;
  avg_rating: number;
  completion_rate: number;
  certificates_issued: number;
  categories_breakdown?: { category: string; count: number }[];
  monthly_enrollments?: { month: string; count: number }[];
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: { 
    timestamp: Date; 
    request_id: string 
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

// Session Attendance
export interface SessionAttendance {
  enrollment_id: string;
  user_id: string;
  user_name: string;
  email: string;
  attended: boolean;
  notes?: string;
  marked_at?: Date;
}

// Notification Types
export type NotificationType =
  | 'new_training'
  | 'training_updated'
  | 'training_deleted'
  | 'training_suspended'
  | 'training_published'
  | 'application_submitted'
  | 'application_shortlisted'
  | 'application_rejected'
  | 'training_completed_mark'
  | 'certificate_issued'
  | 'new_enrollment';

// Certificate
export interface Certificate {
  id: string;
  enrollment_id: string;
  certificate_url: string;
  verification_code: string;
  issued_at: Date;
}