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

export interface UpdateJobRequest extends Partial<CreateJobRequest> {
  status?: 'Open' | 'Closed' | 'Paused' | 'Filled';
}

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

export interface JobWithCompany extends Job {
  company_name: string;
  company_logo?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
}

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

export interface JobBookmark {
  id: string;
  job_id: string;
  jobseeker_id: string;
  created_at: Date;
}

export interface JobView {
  id: string;
  job_id: string;
  jobseeker_id?: string;
  ip_address?: string;
  user_agent?: string;
  viewed_at: Date;
}