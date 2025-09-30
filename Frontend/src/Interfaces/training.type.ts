// src/app/types/training.type.ts
export interface Training {
  id: string;
  title: string;
  description: string;
  duration: string; // e.g., "2 hours"
  videoType: 'youtube' | 'vimeo' | 'local';
  videoUrl?: string;
  completionCriteria?: string;
  issueCertificate: boolean;
  status: 'Active' | 'Closed' | 'Draft';
  provider_id: string;
  provider_name: string;
  completedBy: string[]; // Array of user IDs who completed the training
  certificatesIssued: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTrainingRequest {
  title: string;
  description: string;
  duration: string;
  videoType: 'youtube' | 'vimeo' | 'local';
  videoUrl?: string;
  completionCriteria?: string;
  issueCertificate: boolean;
  provider_name: string;
}

export interface UpdateTrainingRequest {
  title?: string;
  description?: string;
  duration?: string;
  videoType?: 'youtube' | 'vimeo' | 'local';
  videoUrl?: string;
  completionCriteria?: string;
  issueCertificate?: boolean;
  provider_name?: string;
  status?: 'Active' | 'Closed' | 'Draft';
}
export interface TrainingSearchParams {
  search?: string;
  mode?: string;
  cost_type?: string;
  level?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'title' | 'rating' | 'total_students' | 'start_date';
  sort_order?: 'asc' | 'desc';
  filters?: {
    category?: string;
    level?: string[];        // Array for multiple levels
    search?: string;
    cost_type?: string[];    // Array for multiple cost types
    mode?: string[];         // Array for multiple modes
    has_certificate?: boolean;
  };
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
}

export interface TrainingStatsResponse {
  total_trainings: number;
  active_trainings: number;
  draft_trainings: number;
  closed_trainings: number;
  total_completions: number;
  total_certificates: number;
  monthly_completions?: { month: string; count: number }[];
}