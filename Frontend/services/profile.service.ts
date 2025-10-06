// frontend/src/app/services/profile.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../src/environments/environments';

export interface ProfileData {
  userId: string;
  cvId: string;
  personalInfo: {
    fullName: string;
    title: string;
    location: string;
    email: string;
    phone: string;
    profileImage?: string;
    about: string;
    linkedIn?: string;
    website?: string;
  };
  profileCompletion: number;
  skills: {
    technical: Skill[];
    soft: Skill[];
  };
  certifications: Certification[];
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  recommendations: Recommendation[];
  socialLinks: SocialLink[];
  workSamples: WorkSample[];
}

export interface Skill {
  name: string;
  type: 'technical' | 'soft';
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  category?: string;
}

export interface Certification {
  title: string;
  organization: string;
  completionDate: string;
  badgeUrl?: string;
  certificateUrl?: string;
}

export interface Experience {
  title: string;
  company: string;
  duration: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
  achievements: string[];
  companyLogo?: string;
}

export interface Education {
  degree: string;
  institution: string;
  graduationDate: string;
  coursework?: string[];
  gpa?: string;
}

export interface Project {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
}

export interface Recommendation {
  name: string;
  position: string;
  company: string;
  text: string;
  date: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

export interface WorkSample {
  name: string;
  type: string;
  size: string;
  url: string;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data?: ProfileData;
}

export interface ProfileCompletionResponse {
  success: boolean;
  data: {
    completion: number;
    sections: {
      personalInfo: boolean;
      about: boolean;
      skills: boolean;
      education: boolean;
      experience: boolean;
      certifications: boolean;
      projects: boolean;
      socialLinks: boolean;
    };
  };
}

export interface ShareResponse {
  success: boolean;
  message: string;
  data: {
    shareUrl: string;
    shareToken: string;
    expiresAt: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private apiUrl = `${environment.apiUrl}/profile`;

  constructor(private http: HttpClient) {}

  /**
   * Get current user's profile
   */
  getMyProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(this.apiUrl, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get profile by specific CV ID
   */
  getProfileByCVId(cvId: string): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/cv/${cvId}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get profile completion status
   */
  getProfileCompletion(): Observable<ProfileCompletionResponse> {
    return this.http.get<ProfileCompletionResponse>(`${this.apiUrl}/completion`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Update profile picture
   */
  updateProfilePicture(imageUrl: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/picture`, 
      { imageUrl },
      { headers: this.getHeaders() }
    );
  }

  /**
   * Generate shareable profile link
   */
  shareProfile(): Observable<ShareResponse> {
    return this.http.post<ShareResponse>(`${this.apiUrl}/share`, {}, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get shared profile (public access)
   */
  getSharedProfile(token: string): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.apiUrl}/shared/${token}`);
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
}