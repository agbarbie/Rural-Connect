// src/app/employer/candidate-profile/candidate-profile.component.ts - FIXED

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CandidatesService } from '../../../../../services/candidates.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { environment } from '../../../../environments/environment.prod';

interface CandidateProfile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  profile_image: string;
  bio: string;
  title: string;
  years_of_experience: number;
  current_position: string;
  availability_status: string;
  skills: string[];
  cv_skills: any[];
  work_experience: any[];
  education: any[];
  certifications: any[];
  projects: any[];
  social_links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  application?: {
    id: string;
    status: string;
    cover_letter: string;
    expected_salary: number;
    availability_date: string;
    applied_at: string;
  };
  preferences: {
    job_types: string[];
    locations: string[];
    salary_min: number;
    salary_max: number;
  };
  cv_info: {
    cv_id: string;
    cv_status: string;
    last_updated: string;
  };
}

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './candidate-profile.component.html',
  styleUrls: ['./candidate-profile.component.css']
})
export class CandidateProfileComponent implements OnInit {
  candidate: CandidateProfile | null = null;
  isLoading = true;
  candidateId: string = '';
  jobId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private candidatesService: CandidatesService
  ) {}

  ngOnInit(): void {
    // 🔥 FIX: Read the correct parameter name from route
    // Route is defined as: 'employer/candidate-profile/:id'
    // So we need to read params['id']
    this.route.params.subscribe(params => {
      this.candidateId = params['id']; // ✅ Correct parameter name from route
      
      console.log('🎯 Route params:', params);
      console.log('📝 Extracted candidateId:', this.candidateId);
      
      if (!this.candidateId || this.candidateId === 'undefined') {
        console.error('❌ Invalid candidate ID from route');
        this.isLoading = false;
        return;
      }
      
      // Load query params
      this.route.queryParams.subscribe(queryParams => {
        this.jobId = queryParams['jobId'] || null;
        console.log('📋 Job ID from query params:', this.jobId);
      });
      
      // Load profile after getting both route and query params
      this.loadCandidateProfile();
    });
  }

  loadCandidateProfile(): void {
    console.log('🔄 Loading candidate profile for:', this.candidateId);
    this.isLoading = true;
    
    this.candidatesService.getCandidateProfile(this.candidateId, this.jobId || undefined)
      .subscribe({
        next: (response) => {
          console.log('✅ Profile loaded successfully:', response);
          if (response.success && response.data) {
            this.candidate = response.data;
          } else {
            console.error('❌ No profile data in response');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading candidate profile:', error);
          this.isLoading = false;
        }
      });
  }

  getFullImageUrl(imagePath: string | null | undefined, candidateName: string): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=256`;
    }
    
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }
    
    return imagePath;
  }

  handleImageError(event: any, candidateName: string): void {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=256`;
  }

  hasSocialLinks(): boolean {
    if (!this.candidate) return false;
    const links = this.candidate.social_links;
    return !!(links.linkedin || links.github || links.portfolio || links.website);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  toggleShortlist(): void {
    if (!this.candidate || !this.jobId) {
      console.warn('⚠️ Cannot toggle shortlist - missing candidate or job ID');
      return;
    }
    
    this.candidatesService.toggleShortlist(this.candidate.user_id, this.jobId)
      .subscribe({
        next: (response) => {
          if (response.success && this.candidate && this.candidate.application) {
            this.candidate.application.status = response.data.is_shortlisted ? 'shortlisted' : 'reviewed';
            console.log('✅ Shortlist status updated');
          }
        },
        error: (error) => {
          console.error('❌ Error toggling shortlist:', error);
          alert('Failed to update shortlist status');
        }
      });
  }

  scheduleInterview(): void {
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: {
        candidateId: this.candidateId,
        jobId: this.jobId
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/employer/candidates']);
  }
}