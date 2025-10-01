import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interfaces matching your cv-builder.component.ts
export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedIn: string;
  website: string;
  professionalSummary: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  gpa?: string;
  achievements: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string;
  achievements: string;
}

export interface Skill {
  name: string;
  level: string;
  category: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  dateIssued: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string;
  startDate: string;
  endDate: string;
  githubLink?: string;
  demoLink?: string;
  outcomes: string;
}

export interface CVData {
  personalInfo: PersonalInfo;
  education: Education[];
  workExperience: WorkExperience[];
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
}

@Injectable({
  providedIn: 'root'
})
export class CvService {
  private apiUrl = '/api/cvs';  // Changed to relative path for in-memory API

  constructor(private http: HttpClient) {}

  // Create CV
  createCV(cvData: CVData): Observable<any> {
    return this.http.post(`${this.apiUrl}`, cvData);
  }

  // Get all CVs of current user
  getMyCVs(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  // Get a CV by id
  getCVById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  // Update a CV
  updateCV(id: string, cvData: CVData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, cvData);
  }

  // Delete a CV
  deleteCV(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}