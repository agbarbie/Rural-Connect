import { JobWithCompany } from './job.types';

export interface JobApplication {
  id: string;
  job_id: string;
  jobseeker_id: string;
  cover_letter?: string;
  resume_url?: string;
  status: 'Applied' | 'Under Review' | 'Interview' | 'Offered' | 'Rejected' | 'Withdrawn';
  applied_at: Date;
  updated_at: Date;
}

export interface CreateJobApplicationRequest {
  job_id: string;
  cover_letter?: string;
  resume_url?: string;
}

export interface UpdateJobApplicationRequest {
  status: 'Applied' | 'Under Review' | 'Interview' | 'Offered' | 'Rejected' | 'Withdrawn';
  cover_letter?: string;
  resume_url?: string;
}

export interface JobApplicationWithDetails extends JobApplication {
  job: JobWithCompany;
  jobseeker: {
    id: string;
    user_id: number;
    location?: string;
    contact_number?: string;
    skills: string[];
    experience_level?: string;
    bio?: string;
    resume_url?: string;
    portfolio_url?: string;
    user: {
      id: number;
      name: string;
      email: string;
    };
  };
}

export interface ApplicationStats {
  total_applications: number;
  applications_by_status: {
    Applied: number;
    'Under Review': number;
    Interview: number;
    Offered: number;
    Rejected: number;
    Withdrawn: number;
  };
  applications_by_month: Array<{
    month: string;
    count: number;
  }>;
}

export interface ApplicationQuery {
  page?: number;
  limit?: number;
  status?: 'Applied' | 'Under Review' | 'Interview' | 'Offered' | 'Rejected' | 'Withdrawn';
  job_id?: string;
  jobseeker_id?: string;
  employer_id?: string;
  company_id?: string;
  sort_by?: 'applied_at' | 'updated_at';
  sort_order?: 'ASC' | 'DESC';
}