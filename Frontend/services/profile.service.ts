// frontend/src/app/services/profile.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../src/environments/environments';

// Portfolio interfaces matching backend structure
export interface PortfolioData {
  cvId: string;
  userId: string;
  cvData: CVData;
  settings: PortfolioSettings;
  testimonials: Testimonial[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CVData {
  user_id: string;
  updated_at: any;
  personal_info: {
    name: string;
    image: string | undefined;
    github: string | undefined;
    website: string | undefined;
    linkedIn: string | undefined;
    full_name: string;
    email: string;
    phone: string;
    address?: string;
    professional_summary?: string;
    linkedin_url?: string;
    github_url?: string;
    website_url?: string;
    profile_image?: string;
  };
  skills: Skill[];
  work_experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  languages?: Language[];
  references?: Reference[];
}

export interface Skill {
  id?: string;
  skill_name: string;
  category?: string;
  proficiency_level?: string;
}

export interface WorkExperience {
  id?: string;
  position: string;
  company: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  responsibilities?: string;
  achievements?: string;
  company_logo?: string;
}

export interface Education {
  id?: string;
  degree: string;
  institution: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  coursework?: string;
  gpa?: string;
}

export interface Certification {
  id?: string;
  certification_name: string;
  issuer: string;
  date_issued: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
}

export interface Project {
  id?: string;
  project_name: string;
  description?: string;
  technologies?: string;
  start_date?: string;
  end_date?: string;
  project_url?: string;
  github_url?: string;
  image_url?: string;
}

export interface Language {
  id?: string;
  language: string;
  proficiency: string;
}

export interface Reference {
  id?: string;
  name: string;
  position: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface Testimonial {
  id: number;
  content: string;
  author: string;
  position?: string;
  company?: string;
  created_at: string;
}

export interface PortfolioSettings {
  user_id?: string;
  theme: 'light' | 'dark' | 'custom';
  is_public: boolean;
  custom_domain?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  analytics_enabled: boolean;
  show_contact_form: boolean;
  show_download_cv: boolean;
  social_links?: SocialLink[];
  custom_sections?: any;
  created_at?: string;
  updated_at?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
}

export interface AnalyticsData {
  totalViews: number;
  viewsByDate: Array<{ date: string; views: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
}

// Interface for profile completion response
export interface CompletedSection {
fields: any;
  name: string;
  completed: boolean;
  weight: number;
}

export interface ProfileCompletionResponse {
  data: ProfileCompletionResponse;
  completion: number;
  missingFields: string[];
  completedSections: CompletedSection[];
  recommendations: string[];
}

// API Response interfaces
export interface PortfolioResponse {
  success: boolean;
  message: string;
  data?: PortfolioData;
}

export interface SettingsResponse {
  success: boolean;
  message: string;
  data?: PortfolioSettings;
}

export interface AnalyticsResponse {
  success: boolean;
  message: string;
  data?: AnalyticsData;
}

export interface TestimonialResponse {
  success: boolean;
  message: string;
  data?: Testimonial;
}

// Image upload response
export interface ImageUploadResponse {
  success: boolean;
  message: string;
  imageUrl?: string;
}

// Profile response
export interface ProfileResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  uploadCV(file: File): Observable<any> {
  const formData = new FormData();
  formData.append('cv', file); // FIXED: Using 'cv' to match backend

  return this.http.post<any>(
    `${environment.apiUrl}/cv/upload`,
    formData,
    { headers: this.getAuthHeaders() }
  );
}

  private portfolioUrl = `${environment.apiUrl}/portfolio`;
  private profileUrl = `${environment.apiUrl}/profile`;
  private cvUrl = `${environment.apiUrl}/cv-builder`;

  constructor(private http: HttpClient) {}

  /**
   * Upload profile image
   */
  

  /**
   * Get current user's portfolio (authenticated)
   */
  getMyPortfolio(): Observable<PortfolioResponse> {
    return this.http.get<PortfolioResponse>(`${this.portfolioUrl}/my-portfolio`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Upload profile image
   * @param file - Image file to upload
   * @returns Observable with upload response
   */
  uploadProfileImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file); // Must match backend field name

    console.log('📤 Uploading profile image:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    return this.http.post<any>(`${this.profileUrl}/upload-image`, formData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('✅ Image upload response:', response);
        return response;
      })
    );
  }
  /**
   * Get public portfolio by user ID or email
   */
  getPublicPortfolio(identifier: string): Observable<PortfolioResponse> {
    return this.http.get<PortfolioResponse>(`${this.portfolioUrl}/public/${identifier}`);
  }

  /**
   * Get portfolio settings
   */
  getPortfolioSettings(): Observable<SettingsResponse> {
    return this.http.get<SettingsResponse>(`${this.portfolioUrl}/settings`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Update portfolio settings
   */
  updatePortfolioSettings(settings: Partial<PortfolioSettings>): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(
      `${this.portfolioUrl}/settings`,
      settings,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Toggle portfolio public/private
   */
  togglePortfolioVisibility(isPublic: boolean): Observable<SettingsResponse> {
    return this.updatePortfolioSettings({ is_public: isPublic });
  }

  /**
   * Get portfolio analytics
   */
  getAnalytics(startDate?: string, endDate?: string): Observable<AnalyticsResponse> {
    let url = `${this.portfolioUrl}/analytics`;
    
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }

    return this.http.get<AnalyticsResponse>(url, {
      headers: this.getHeaders()
    });
  }

  /**
   * Download portfolio as PDF
   */
  downloadPortfolioPDF(): Observable<Blob> {
    return this.http.get(`${this.portfolioUrl}/pdf`, {
      headers: this.getHeaders(),
      responseType: 'blob'
    });
  }

  /**
   * Add testimonial
   */
  addTestimonial(testimonial: {
    name: string;
    position: string;
    company?: string;
    text: string;
    date?: string;
  }): Observable<TestimonialResponse> {
    return this.http.post<TestimonialResponse>(
      `${this.portfolioUrl}/testimonials`,
      testimonial,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Delete testimonial
   */
  deleteTestimonial(testimonialId: number): Observable<any> {
    return this.http.delete(`${this.portfolioUrl}/testimonials/${testimonialId}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Generate shareable portfolio URL
   */
  getShareableUrl(): Observable<{ url: string; isPublic: boolean }> {
    return this.getPortfolioSettings().pipe(
      map(response => {
        if (response.success && response.data) {
          const userId = response.data.user_id;
          const baseUrl = window.location.origin;
          return {
            url: `${baseUrl}/portfolio/public/${userId}`,
            isPublic: response.data.is_public
          };
        }
        throw new Error('Failed to generate shareable URL');
      })
    );
  }

  // Add these methods to your profile.service.ts

/**
 * Track profile view (when employer views jobseeker profile)
 */
trackProfileView(viewedProfileId: string): Observable<any> {
  return this.http.post(
    `${this.profileUrl}/view`,
    { viewed_profile_id: viewedProfileId },
    { headers: this.getHeaders() }
  ).pipe(
    map(response => {
      console.log('✅ Profile view tracked');
      return response;
    })
  );
}

/**
 * Get who viewed my profile
 */
getProfileViewers(params?: { limit?: number; offset?: number }): Observable<any> {
  let url = `${this.profileUrl}/viewers`;
  
  if (params) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    
    const queryString = queryParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  return this.http.get(url, { headers: this.getHeaders() });
}

/**
 * Get profile view count
 */
getProfileViewCount(): Observable<any> {
  return this.http.get(`${this.profileUrl}/view-count`, {
    headers: this.getHeaders()
  });
}

  /**
   * Get current user's profile
   */
  getMyProfile(): Observable<ProfileResponse> {
  return this.http.get<ProfileResponse>(`${this.profileUrl}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Update current user's profile
   */
  updateProfile(updates: any): Observable<ProfileResponse> {
    return this.http.patch<ProfileResponse>(`${this.profileUrl}`, updates, {
      headers: this.getHeaders()
    });
  }

  /**
   * Calculate profile completion percentage
   */
  calculateProfileCompletion(portfolioData: PortfolioData): number {
    const sections = {
      personalInfo: this.hasPersonalInfo(portfolioData.cvData),
      professionalSummary: !!portfolioData.cvData.personal_info?.professional_summary,
      skills: portfolioData.cvData.skills?.length > 0,
      workExperience: portfolioData.cvData.work_experience?.length > 0,
      education: portfolioData.cvData.education?.length > 0,
      certifications: portfolioData.cvData.certifications?.length > 0,
      projects: portfolioData.cvData.projects?.length > 0,
      profileImage: !!portfolioData.cvData.personal_info?.profile_image
    };

    const completedSections = Object.values(sections).filter(Boolean).length;
    const totalSections = Object.keys(sections).length;

    return Math.round((completedSections / totalSections) * 100);
  }

  
  /**
   * Check if personal info is complete
   */
  private hasPersonalInfo(cvData: CVData): boolean {
    const pi = cvData.personal_info;
    return !!(pi?.full_name && pi?.email && pi?.phone);
  }

  /**
   * Update profile picture
   */
  updateProfilePicture(imageUrl: string): Observable<any> {
    // This would typically update through the CV builder API
    // For now, return a method to update via CV update endpoint
    return this.http.put(
      `${environment.apiUrl}/cv-builder/personal-info`,
      { profile_image: imageUrl },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get detailed profile completion
   */
  getDetailedProfileCompletion(): Observable<ProfileCompletionResponse> {
    return this.http.get<ProfileCompletionResponse>(`${this.profileUrl}/completion`, {
      headers: this.getHeaders()
    });
  }

  /**
 * Get profile completion status (simplified)
 */
getProfileCompletion(): Observable<any> {
  return this.http.get<any>(`${this.profileUrl}/completion`, {
    headers: this.getHeaders()
  }).pipe(
    map(response => {
      console.log('✅ Profile completion response:', response);
      return response;
    })
  );
}

  /**
   * Calculate completion percentage (client-side helper)
   */
  calculateCompletionPercentage(sections: CompletedSection[]): number {
    let total = 0;
    sections.forEach(section => {
      if (section.completed) {
        total += section.weight;
      }
    });
    return Math.round(total);
  }

  /**
   * Get completion status color
   */
  getCompletionColor(percentage: number): string {
    if (percentage >= 80) return '#10b981'; // Green
    if (percentage >= 50) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  /**
   * Get completion status message
   */
  getCompletionMessage(percentage: number): string {
    if (percentage >= 90) return 'Excellent! Your profile is complete.';
    if (percentage >= 70) return 'Great progress! Almost there.';
    if (percentage >= 50) return 'Good start! Add more details.';
    return 'Getting started. Complete your profile.';
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Get auth headers for file upload (no Content-Type)
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Helper: Format date for display
   */
  formatDate(date: string | undefined, isCurrent: boolean): string {
    if (isCurrent) return 'Present';
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  /**
   * Helper: Get skills by category
   */
  getSkillsByCategory(skills: Skill[]): Map<string, Skill[]> {
    const categorized = new Map<string, Skill[]>();
    
    skills.forEach(skill => {
      const category = skill.category || 'General';
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      categorized.get(category)!.push(skill);
    });

    return categorized;
  }
}