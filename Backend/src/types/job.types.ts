// src/types/job.types.ts - Consolidated types for both employers and jobseekers

// Core Job Interface
export interface Job {
  id: string;
  employer_id: string;
  company_id: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  work_arrangement: 'Remote' | 'Hybrid' | 'On-site';
  salary_min?: number;
  salary_max?: number;
  currency: string;
  skills_required: string[];
  experience_level?: string;
  education_level?: string;
  benefits?: string[];
  department?: string;
  status: 'Open' | 'Closed' | 'Paused' | 'Filled';
  application_deadline?: Date;
  is_featured: boolean;
  views_count: number;
  applications_count: number;
  created_at: Date;
  updated_at: Date;
}

// Extended Job with Company Details
export interface JobWithCompany extends Job {
  company_name: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
}

// Job with Jobseeker-specific Details
export interface JobWithDetails extends JobWithCompany {
  category_name?: string;
  // Jobseeker-specific fields
  is_saved?: boolean;
  has_applied?: boolean;
  application_status?: string;
}

// Job Creation Request
export interface CreateJobRequest {
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  location: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  work_arrangement: 'Remote' | 'Hybrid' | 'On-site';
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  skills_required: string[];
  experience_level?: string;
  education_level?: string;
  benefits?: string[];
  department?: string;
  application_deadline?: string;
  is_featured?: boolean;
}

// Job Update Request
export interface UpdateJobRequest extends Partial<CreateJobRequest> {
  status?: 'Open' | 'Closed' | 'Paused' | 'Filled';
}

// Job Query Parameters (for employers)
export interface JobQuery {
  page?: number;
  limit?: number;
  status?: 'Open' | 'Closed' | 'Paused' | 'Filled';
  employment_type?: string;
  work_arrangement?: string;
  location?: string;
  skills?: string[];
  salary_min?: number;
  salary_max?: number;
  search?: string;
  sort_by?: 'created_at' | 'salary_max' | 'applications_count' | 'views_count';
  sort_order?: 'ASC' | 'DESC';
  company_id?: string;
  employer_id?: string;
}

// Job Filters (for jobseekers)
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

// Job Statistics
export interface JobStats {
  total_jobs: number;
  active_jobs: number;
  paused_jobs: number;
  closed_jobs: number;
  total_applications: number;
  average_applications_per_job: number;
  featured_jobs_count: number;
  remote_jobs_count: number;
  hybrid_jobs_count: number;
}

// Job Application
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

// Job Application with Details
export interface JobApplicationWithDetails extends JobApplication {
  job_title: string;
  company_name: string;
  company_logo?: string;
  job_location: string;
  job_employment_type: string;
  // Applicant details (for employers)
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  experience_level?: string;
  linkedin_url?: string;
  profile_portfolio_url?: string;
}

// Job Bookmark
export interface JobBookmark {
  id: string;
  user_id: string;
  job_id: string;
  saved_at: Date;
}

// Job Bookmark with Details
export interface JobBookmarkWithDetails extends JobBookmark {
  job_title: string;
  company_name: string;
  company_logo?: string;
  job_location: string;
  job_employment_type: string;
  job_salary_min?: number;
  job_salary_max?: number;
}

// Job View
export interface JobView {
  id: string;
  job_id: string;
  user_id?: string;
  jobseeker_id?: string;
  ip_address?: string;
  user_agent?: string;
  viewed_at: Date;
}

// Application Data for Job Applications
export interface ApplicationData {
  coverLetter?: string;
  resumeId?: string;
  portfolioUrl?: string;
  expectedSalary?: number;
  availabilityDate?: string;
}

// Jobseeker Statistics
export interface JobseekerStats {
  total_applications: number;
  pending_applications: number;
  reviewed_applications: number;
  shortlisted_applications: number;
  rejected_applications: number;
  total_saved_jobs: number;
  profile_views: number;
  applications_this_month: number;
}

// Service Response
export interface ServiceResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

// Paginated Result
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

// Recommendation Filters
export interface RecommendationFilters {
  page: number;
  limit: number;
}