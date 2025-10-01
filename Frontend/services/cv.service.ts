// src/app/services/cv.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../src/environments/environments';

// ============================================
// Type Definitions
// ============================================

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  linkedIn?: string;
  website?: string;
  professionalSummary?: string;
}

export interface Education {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear?: string;
  gpa?: string;
  achievements?: string;
}

export interface WorkExperience {
  id?: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  responsibilities?: string;
  achievements?: string;
}

export interface Skill {
  id?: string;
  name: string;
  level: string;
  category: string;
}

export interface Certification {
  id?: string;
  name: string;
  issuer: string;
  dateIssued: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Project {
  id?: string;
  name: string;
  description?: string;
  technologies?: string;
  startDate?: string;
  endDate?: string;
  githubLink?: string;
  demoLink?: string;
  outcomes?: string;
}

export interface CVData {
  personalInfo: PersonalInfo;
  education: Education[];
  workExperience: WorkExperience[];
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
}

export interface CV {
  id: string;
  userId: string;
  status: 'draft' | 'final';
  parsedFromFile?: boolean;
  originalFilename?: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
  cvData: CVData;
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface ExportOptions {
  format: 'pdf' | 'docx';
  template?: string;
}

// ============================================
// CV Service
// ============================================

@Injectable({
  providedIn: 'root'
})
export class CvService {
  private apiUrl = `${environment.apiUrl}/cv`; // e.g., http://localhost:3000/api/cv

  constructor(private http: HttpClient) {}

  // ============================================
  // CREATE CV
  // ============================================
  
  /**
   * Create a new CV with provided data
   */
  createCV(cvData: CVData): Observable<APIResponse<CV>> {
    const payload = this.transformToBackendFormat(cvData);
    
    return this.http.post<APIResponse<CV>>(`${this.apiUrl}`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Upload and parse an existing CV file
   */
  uploadCV(file: File): Observable<APIResponse<CV>> {
    const formData = new FormData();
    formData.append('cv', file);

    return this.http.post<APIResponse<CV>>(`${this.apiUrl}/upload`, formData)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ============================================
  // READ CVs
  // ============================================

  /**
   * Get all CVs for the current user
   */
  getMyCVs(): Observable<APIResponse<CV[]>> {
    return this.http.get<APIResponse<CV[]>>(`${this.apiUrl}/my-cvs`)
      .pipe(
        map(response => ({
          ...response,
          data: response.data?.map(cv => this.transformFromBackendFormat(cv)) || []
        })),
        catchError(this.handleError)
      );
  }

  /**
   * Get a specific CV by ID
   */
  getCVById(cvId: string): Observable<APIResponse<CV>> {
    return this.http.get<APIResponse<CV>>(`${this.apiUrl}/${cvId}`)
      .pipe(
        map(response => ({
          ...response,
          data: response.data ? this.transformFromBackendFormat(response.data) : undefined
        })),
        catchError(this.handleError)
      );
  }

  // ============================================
  // UPDATE CV
  // ============================================

  /**
   * Update an existing CV
   */
  updateCV(cvId: string, cvData: CVData): Observable<APIResponse<CV>> {
    const payload = this.transformToBackendFormat(cvData);
    
    return this.http.put<APIResponse<CV>>(`${this.apiUrl}/${cvId}`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Update CV status (draft/final)
   */
updateCVStatus(cvId: string, status: 'draft' | 'final'): Observable<APIResponse<CV>> {
  const endpoint = status === 'draft' ? 'draft' : 'final';
  return this.http.post<APIResponse<CV>>(`${this.apiUrl}/${cvId}/${endpoint}`, {})
    .pipe(
      catchError(this.handleError)
    );
}

  /**
   * Set a CV as the active/primary CV
   */
  setActiveCV(cvId: string): Observable<APIResponse<any>> {
    return this.http.patch<APIResponse<any>>(`${this.apiUrl}/${cvId}/set-active`, {})
      .pipe(
        catchError(this.handleError)
      );
  }

  // ============================================
  // DELETE CV
  // ============================================

  /**
   * Delete a CV
   */
  deleteCV(cvId: string): Observable<APIResponse<any>> {
    return this.http.delete<APIResponse<any>>(`${this.apiUrl}/${cvId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // ============================================
  // EXPORT CV
  // ============================================

  /**
   * Export CV as PDF
   */
  exportToPDF(cvId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${cvId}/export/pdf`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Export CV as Word document
   */
  exportToWord(cvId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${cvId}/export/docx`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Download exported CV file
   */
  downloadCV(cvId: string, format: 'pdf' | 'docx', filename?: string): void {
    const exportMethod = format === 'pdf' ? this.exportToPDF(cvId) : this.exportToWord(cvId);
    
    exportMethod.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `CV_${Date.now()}.${format}`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Download error:', error);
      }
    });
  }

  // ============================================
  // DATA TRANSFORMATION
  // ============================================

  /**
   * Transform frontend CVData format to backend format
   */
  private transformToBackendFormat(cvData: CVData): any {
    return {
      personal_info: {
        full_name: cvData.personalInfo.fullName,
        email: cvData.personalInfo.email,
        phone: cvData.personalInfo.phone,
        address: cvData.personalInfo.address || null,
        linkedin_url: cvData.personalInfo.linkedIn || null,
        website_url: cvData.personalInfo.website || null,
        professional_summary: cvData.personalInfo.professionalSummary || null
      },
      education: cvData.education.map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        field_of_study: edu.fieldOfStudy,
        start_year: edu.startYear,
        end_year: edu.endYear || null,
        gpa: edu.gpa || null,
        achievements: edu.achievements || null
      })),
      work_experience: cvData.workExperience.map(work => ({
        company: work.company,
        position: work.position,
        start_date: work.startDate,
        end_date: work.endDate || null,
        is_current: work.current || false,
        responsibilities: work.responsibilities || null,
        achievements: work.achievements || null
      })),
      skills: cvData.skills.map(skill => ({
        skill_name: skill.name,
        skill_level: skill.level,
        category: skill.category
      })),
      certifications: cvData.certifications.map(cert => ({
        certification_name: cert.name,
        issuer: cert.issuer,
        date_issued: cert.dateIssued,
        expiry_date: cert.expiryDate || null,
        credential_id: cert.credentialId || null
      })),
      projects: cvData.projects.map(project => ({
        project_name: project.name,
        description: project.description || null,
        technologies: project.technologies || null,
        start_date: project.startDate || null,
        end_date: project.endDate || null,
        github_link: project.githubLink || null,
        demo_link: project.demoLink || null,
        outcomes: project.outcomes || null
      }))
    };
  }

  /**
   * Transform backend format to frontend CVData format
   */
  private transformFromBackendFormat(cv: any): CV {
    return {
      id: cv.id,
      userId: cv.user_id,
      status: cv.status,
      parsedFromFile: cv.parsed_from_file,
      originalFilename: cv.original_filename,
      fileUrl: cv.file_url,
      createdAt: cv.created_at,
      updatedAt: cv.updated_at,
      cvData: {
        personalInfo: {
          fullName: cv.cv_data?.personal_info?.full_name || '',
          email: cv.cv_data?.personal_info?.email || '',
          phone: cv.cv_data?.personal_info?.phone || '',
          address: cv.cv_data?.personal_info?.address || '',
          linkedIn: cv.cv_data?.personal_info?.linkedin_url || '',
          website: cv.cv_data?.personal_info?.website_url || '',
          professionalSummary: cv.cv_data?.personal_info?.professional_summary || ''
        },
        education: (cv.cv_data?.education || []).map((edu: any) => ({
          id: edu.id,
          institution: edu.institution,
          degree: edu.degree,
          fieldOfStudy: edu.field_of_study,
          startYear: edu.start_year,
          endYear: edu.end_year,
          gpa: edu.gpa,
          achievements: edu.achievements
        })),
        workExperience: (cv.cv_data?.work_experience || []).map((work: any) => ({
          id: work.id,
          company: work.company,
          position: work.position,
          startDate: work.start_date,
          endDate: work.end_date,
          current: work.is_current,
          responsibilities: work.responsibilities,
          achievements: work.achievements
        })),
        skills: (cv.cv_data?.skills || []).map((skill: any) => ({
          id: skill.id,
          name: skill.skill_name,
          level: skill.skill_level,
          category: skill.category
        })),
        certifications: (cv.cv_data?.certifications || []).map((cert: any) => ({
          id: cert.id,
          name: cert.certification_name,
          issuer: cert.issuer,
          dateIssued: cert.date_issued,
          expiryDate: cert.expiry_date,
          credentialId: cert.credential_id
        })),
        projects: (cv.cv_data?.projects || []).map((project: any) => ({
          id: project.id,
          name: project.project_name,
          description: project.description,
          technologies: project.technologies,
          startDate: project.start_date,
          endDate: project.end_date,
          githubLink: project.github_link,
          demoLink: project.demo_link,
          outcomes: project.outcomes
        }))
      }
    };
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Server returned code ${error.status}`;
    }
    
    console.error('CV Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}