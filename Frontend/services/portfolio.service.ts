// portfolio.service.ts - Enhanced with profile integration
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../src/environments/environment.prod';

export interface PortfolioSettings {
  theme: string;
  is_public: boolean;
  custom_domain?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  analytics_enabled: boolean;
  show_contact_form: boolean;
  show_download_cv: boolean;
  social_links: any[];
  custom_sections?: any[];
}

export interface EnhancedPortfolioData {
  cvId: string;
  userId: string;
  cvData: any;
  profileData: {
    name: string;
    email: string;
    phone: string;
    location: string;
    bio: string;
    profile_image: string;
    linkedin_url?: string;
    github_url?: string;
    website_url?: string;
    years_of_experience?: number;
    current_position?: string;
    skills?: string[];
  };
  settings: PortfolioSettings;
  testimonials: any[];
  createdAt: string;
  viewCount: number;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private apiUrl = `${environment.apiUrl}/portfolio`;
  private profileApiUrl = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  // Enhanced: Get portfolio WITH profile data merged
  getMyPortfolio(): Observable<EnhancedPortfolioData> {
    // Fetch both portfolio and profile data, then merge them
    return forkJoin({
      portfolio: this.http.get<any>(`${this.apiUrl}/my-portfolio`),
      profile: this.http.get<any>(`${this.profileApiUrl}`)
    }).pipe(
      map(({ portfolio, profile }) => {
        const portfolioData = portfolio.data || portfolio;
        const profileData = profile.data || profile;

        // Merge profile data into portfolio
        return {
          ...portfolioData,
          profileData: {
            name: profileData.name || '',
            email: profileData.email || '',
            phone: profileData.phone || '',
            location: profileData.location || '',
            bio: profileData.bio || '',
            profile_image: profileData.profile_image || profileData.profileImage || '',
            linkedin_url: profileData.linkedin_url || '',
            github_url: profileData.github_url || '',
            website_url: profileData.website_url || '',
            years_of_experience: profileData.years_of_experience || 0,
            current_position: profileData.current_position || '',
            skills: this.parseSkills(profileData.skills)
          }
        };
      })
    );
  }

  // Helper to parse skills from JSON
  private parseSkills(skills: any): string[] {
    if (!skills) return [];
    try {
      if (typeof skills === 'string') {
        return JSON.parse(skills);
      }
      if (Array.isArray(skills)) {
        return skills;
      }
      return [];
    } catch {
      return [];
    }
  }

  // Get public portfolio by email or userId
  getPublicPortfolio(identifier: string): Observable<EnhancedPortfolioData> {
    return this.http.get<EnhancedPortfolioData>(`${this.apiUrl}/public/${identifier}`);
  }

  // Get portfolio settings
  getSettings(): Observable<PortfolioSettings> {
    return this.http.get<PortfolioSettings>(`${this.apiUrl}/settings`);
  }

  // Update settings
  updateSettings(data: Partial<PortfolioSettings>): Observable<PortfolioSettings> {
    return this.http.put<PortfolioSettings>(`${this.apiUrl}/settings`, data);
  }

  // Add testimonial
  addTestimonial(testimonial: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/testimonials`, testimonial);
  }

  // Delete testimonial
  deleteTestimonial(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/testimonials/${id}`);
  }

  // Get analytics
  getAnalytics(startDate?: string, endDate?: string): Observable<any> {
    let url = `${this.apiUrl}/analytics`;
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    return this.http.get(url);
  }

  // Download portfolio PDF
  downloadPortfolioPDF(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-pdf`, { responseType: 'blob' });
  }
}