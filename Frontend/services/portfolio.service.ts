import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

export interface PortfolioData {
  cvId: string;              // Add this
  userId: string;   
  cvData: any;
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
  private apiUrl = 'http://localhost:5000/api/portfolio'; // adjust to your backend route

  constructor(private http: HttpClient) {}

getMyPortfolio(): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/my-portfolio`);
}

  // Get public portfolio by email or userId
  getPublicPortfolio(identifier: string): Observable<PortfolioData> {
    return this.http.get<PortfolioData>(`${this.apiUrl}/public/${identifier}`);
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
