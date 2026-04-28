// src/app/services/cv.service.ts - COMPLETE FIXED VERSION
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
  profileImage: string;
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
}

export interface ProfileImageUploadResponse {
  success: boolean;
  message: string;
  data?: {
    imageUrl: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CvService {
  private apiUrl = `${environment.apiUrl}/cv`;

  constructor(private http: HttpClient) {}

  // ============================================
  // CREATE CV
  // ============================================
  
  /**
   * Create a new CV with provided data
   */
  createCV(cvData: CVData): Observable<APIResponse<CV>> {
    const payload = this.transformToBackendFormat(cvData);
    
    return this.http.post<APIResponse<CV>>(`${this.apiUrl}/create`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Upload and parse an existing CV file
   * FIXED: Using 'cv' as field name to match backend
   */

  // ✅ CORRECT - Change to this
uploadCV(file: File): Observable<APIResponse<CV>> {
  const formData = new FormData();
  formData.append('cv', file); // ✅ MUST match backend field name

  console.log('📤 Uploading CV:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  return this.http.post<APIResponse<CV>>(
    `${this.apiUrl}/upload`,
    formData
  ).pipe(
    catchError(this.handleError)
  );
}

  /**
   * Upload profile image for CV
   */
  uploadProfileImage(file: File): Observable<ProfileImageUploadResponse> {
    const formData = new FormData();
    formData.append('profileImage', file);

    return this.http.post<ProfileImageUploadResponse>(
      `${this.apiUrl}/upload-profile-image`,
      formData
    ).pipe(
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
        professional_summary: cvData.personalInfo.professionalSummary || null,
        profile_image: cvData.personalInfo.profileImage || null
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
    console.log('Transforming CV from backend:', cv);
    console.log('Raw cv_data:', cv.cv_data);
    
    const cvData = cv.cv_data || {};
    const personalInfo = cvData.personal_info || {};
    
    return {
      id: cv.id,
      userId: cv.user_id,
      status: cv.status,
      parsedFromFile: cv.parsed_from_file || false,
      originalFilename: cv.original_filename || undefined,
      fileUrl: cv.file_url || undefined,
      createdAt: cv.created_at,
      updatedAt: cv.updated_at,
      cvData: {
        personalInfo: {
          fullName: personalInfo.full_name || '',
          email: personalInfo.email || '',
          phone: personalInfo.phone || '',
          address: personalInfo.address || '',
          linkedIn: personalInfo.linkedin_url || personalInfo.linkedIn || '',
          website: personalInfo.website_url || personalInfo.website || '',
          professionalSummary: personalInfo.professional_summary || '',
          profileImage: personalInfo.profile_image || ''
        },
        education: this.transformEducation(cvData.education || []),
        workExperience: this.transformWorkExperience(cvData.work_experience || []),
        skills: this.transformSkills(cvData.skills || []),
        certifications: this.transformCertifications(cvData.certifications || []),
        projects: this.transformProjects(cvData.projects || [])
      }
    };
  }

  private transformEducation(education: any[]): any[] {
    return education.map((edu: any) => ({
      id: edu.id,
      institution: edu.institution || '',
      degree: edu.degree || '',
      fieldOfStudy: edu.field_of_study || edu.fieldOfStudy || '',
      startYear: edu.start_year || edu.startYear || '',
      endYear: edu.end_year || edu.endYear || '',
      gpa: edu.gpa || '',
      achievements: edu.achievements || ''
    }));
  }

  private transformWorkExperience(workExp: any[]): any[] {
    return workExp.map((work: any) => ({
      id: work.id,
      company: work.company || '',
      position: work.position || '',
      startDate: work.start_date || work.startDate || '',
      endDate: work.end_date || work.endDate || '',
      current: work.is_current || work.current || false,
      responsibilities: work.responsibilities || '',
      achievements: work.achievements || ''
    }));
  }

  private transformSkills(skills: any[]): any[] {
    console.log('Transforming skills:', skills);
    
    return skills.map((skill: any) => {
      const skillName = skill.skill_name || skill.name || skill.skillName || '';
      const skillLevel = skill.skill_level || skill.level || skill.skillLevel || 'Intermediate';
      const skillCategory = skill.category || skill.skill_category || skill.skillCategory || 'Technical';
      
      console.log('Mapping skill:', {
        original: skill,
        mapped: { name: skillName, level: skillLevel, category: skillCategory }
      });
      
      return {
        id: skill.id,
        name: skillName,
        level: skillLevel,
        category: skillCategory
      };
    }).filter((skill: any) => skill.name);
  }

  private transformCertifications(certifications: any[]): any[] {
    return certifications.map((cert: any) => ({
      id: cert.id,
      name: cert.certification_name || cert.name || '',
      issuer: cert.issuer || '',
      dateIssued: cert.date_issued || cert.dateIssued || '',
      expiryDate: cert.expiry_date || cert.expiryDate || '',
      credentialId: cert.credential_id || cert.credentialId || ''
    }));
  }

  private transformProjects(projects: any[]): any[] {
    return projects.map((project: any) => ({
      id: project.id,
      name: project.project_name || project.name || '',
      description: project.description || '',
      technologies: project.technologies || '',
      startDate: project.start_date || project.startDate || '',
      endDate: project.end_date || project.endDate || '',
      githubLink: project.github_link || project.githubLink || '',
      demoLink: project.demo_link || project.demoLink || '',
      outcomes: project.outcomes || ''
    }));
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || `Server returned code ${error.status}`;
    }
    
    console.error('CV Service Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}