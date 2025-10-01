// src/types/cv.type.ts
export interface PersonalInfo {
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  linkedin_url?: string;
  website_url?: string;
  professional_summary: string;
}

export interface Education {
  id?: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year: string;
  gpa?: string;
  achievements?: string;
  display_order?: number;
}

export interface WorkExperience {
  id?: string;
  company: string;
  position: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  responsibilities: string;
  achievements?: string;
  display_order?: number;
}

export interface Skill {
  id?: string;
  skill_name: string;
  skill_level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  category: string;
  display_order?: number;
}

export interface Certification {
  id?: string;
  certification_name: string;
  issuer: string;
  date_issued: string;
  expiry_date?: string;
  credential_id?: string;
  display_order?: number;
}

export interface Project {
  id?: string;
  project_name: string;
  description: string;
  technologies: string;
  start_date: string;
  end_date: string;
  github_link?: string;
  demo_link?: string;
  outcomes?: string;
  display_order?: number;
}

export interface CVData {
  personal_info: PersonalInfo;
  education: Education[];
  work_experience: WorkExperience[];
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
}

export interface CV {
  id: string;
  user_id: string;
  status: 'draft' | 'final';
  parsed_from_file: boolean;
  original_filename?: string;
  file_url?: string;
  created_at: Date;
  updated_at: Date;
  cv_data?: CVData; // Populated when fetching with data
}

export interface CVParseResult {
  success: boolean;
  data?: CVData;
  error?: string;
  message?: string;
}

export interface CVExportOptions {
  format: 'pdf' | 'docx';
  template?: string;
  include_photo?: boolean;
}

export interface CreateCVRequest {
  cv_data: CVData;
}

export interface UpdateCVRequest {
  cv_data: CVData;
}