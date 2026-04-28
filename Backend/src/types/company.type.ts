export interface Company {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  company_size?: string;
  founded_year?: number;
  headquarters?: string;
  website_url?: string;
  logo_url?: string;
  company_password?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCompanyRequest {
  name: string;
  description?: string;
  industry?: string;
  company_size?: string;
  founded_year?: number;
  headquarters?: string;
  website_url?: string;
  logo_url?: string;
  company_password: string;
}

export interface UpdateCompanyRequest extends Partial<CreateCompanyRequest> {
  is_verified?: boolean;
}

export interface CompanyStats {
  total_companies: number;
  verified_companies: number;
  companies_with_jobs: number;
  average_jobs_per_company: number;
}

export interface CompanyWithJobs extends Company {
  jobs_count: number;
  active_jobs_count: number;
}