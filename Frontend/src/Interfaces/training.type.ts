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