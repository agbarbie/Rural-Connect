// src/types/jobseeker-job.types.ts

export interface JobFilters {
  page?: number;
  limit?: number;
  search?: string;
  location?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  category?: string;
  level?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
}

export interface JobWithDetails {
  id: string;
  employer_id: string;
  company_id: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  employment_type: string;
  work_arrangement: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  skills_required?: string[];
  experience_level?: string;
  education_level?: string;
  benefits?: string[];
  department?: string;
  application_deadline?: Date;
  is_featured: boolean;
  status: string;
  applications_count: number;
  views_count: number;
  created_at: Date;
  updated_at: Date;
  // Company details
  company_name?: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
  // Job seeker specific fields
  is_saved?: boolean;
  has_applied?: boolean;
  application_status?: string;
}

export interface JobApplication {
  id: string;
  user_id: string;
  job_id: string;
  cover_letter?: string;
  resume_id?: string;
  portfolio_url?: string;
  expected_salary?: number;
  availability_date?: Date;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'withdrawn';
  applied_at: Date;
  updated_at: Date;
  employer_notes?: string;
}

export interface JobApplicationWithDetails extends JobApplication {
  job_title: string;
  company_name: string;
  company_logo?: string;
  job_location: string;
  job_employment_type: string;
}

export interface JobBookmark {
  id: string;
  user_id: string;
  job_id: string;
  saved_at: Date;
}

export interface JobBookmarkWithDetails extends JobBookmark {
  job_title: string;
  company_name: string;
  company_logo?: string;
  job_location: string;
  job_employment_type: string;
  job_salary_min?: number;
  job_salary_max?: number;
}

export interface ApplicationData {
  coverLetter?: string;
  resumeId?: string;
  portfolioUrl?: string;
  expectedSalary?: number;
  availabilityDate?: string;
}

export interface JobseekerStats {
  total_applications: number;
  pending_applications: number;
  reviewed_applications: number;
  shortlisted_applications: number;
  rejected_applications: number;
  accepted_applications?: number;
  withdrawn_applications?: number; // ✅ NEW: Track withdrawn separately
  total_saved_jobs: number;
  profile_views: number;
  applications_this_month: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RecommendationFilters {
  page: number;
  limit: number;
}

export interface JobView {
  id: string;
  job_id: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  viewed_at: Date;
}