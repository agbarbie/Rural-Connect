// src/app/employer/components/rating-modal/rating-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatingService, CreateRatingRequest } from '../../../../../services/rating.service';
import { Subject, takeUntil, finalize } from 'rxjs';

interface CandidateToRate {
  user_id: string;
  name: string;
  email: string;
  profile_image: string;
  job_id?: string;
  job_title?: string;
  application_id?: string;
}

@Component({
  selector: 'app-rating-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rating.component.html',
  styleUrls: ['./rating.component.css']
})
export class RatingComponent implements OnInit {
  private destroy$ = new Subject<void>();

  @Input() candidate!: CandidateToRate;
  @Input() showModal: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() ratingSubmitted = new EventEmitter<any>();

  // Rating form data
  overallRating: number = 0;
  hoverRating: number = 0;
  
  // Skills rating (optional)
  enableDetailedRating: boolean = false;
  technicalRating: number = 0;
  communicationRating: number = 0;
  professionalismRating: number = 0;
  qualityRating: number = 0;
  timelinessRating: number = 0;
  
  feedback: string = '';
  taskDescription: string = '';
  wouldHireAgain: boolean = true;
  isPublic: boolean = true;
  
  isSubmitting: boolean = false;
  errorMessage: string = '';
  
  // Hover states for detailed ratings
  technicalHover: number = 0;
  communicationHover: number = 0;
  professionalismHover: number = 0;
  qualityHover: number = 0;
  timelinessHover: number = 0;

  constructor(private ratingService: RatingService) {}

  ngOnInit(): void {
    console.log('Rating Modal initialized for candidate:', this.candidate);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Set overall rating
   */
  setRating(rating: number): void {
    this.overallRating = rating;
    this.errorMessage = '';
  }

  /**
   * Set hover rating for visual feedback
   */
  setHoverRating(rating: number): void {
    this.hoverRating = rating;
  }

  /**
   * Clear hover rating
   */
  clearHoverRating(): void {
    this.hoverRating = 0;
  }

  /**
   * Get star class for display
   */
  getStarClass(position: number, currentRating: number, hoverRating: number): string {
    const rating = hoverRating || currentRating;
    
    if (position <= rating) {
      return 'fas fa-star filled';
    }
    return 'far fa-star';
  }

  /**
   * Set detailed skill rating
   */
  setSkillRating(skill: string, rating: number): void {
    switch (skill) {
      case 'technical':
        this.technicalRating = rating;
        break;
      case 'communication':
        this.communicationRating = rating;
        break;
      case 'professionalism':
        this.professionalismRating = rating;
        break;
      case 'quality':
        this.qualityRating = rating;
        break;
      case 'timeliness':
        this.timelinessRating = rating;
        break;
    }
  }

  /**
   * Set hover for detailed skill rating
   */
  setSkillHover(skill: string, rating: number): void {
    switch (skill) {
      case 'technical':
        this.technicalHover = rating;
        break;
      case 'communication':
        this.communicationHover = rating;
        break;
      case 'professionalism':
        this.professionalismHover = rating;
        break;
      case 'quality':
        this.qualityHover = rating;
        break;
      case 'timeliness':
        this.timelinessHover = rating;
        break;
    }
  }

  /**
   * Clear skill hover
   */
  clearSkillHover(skill: string): void {
    switch (skill) {
      case 'technical':
        this.technicalHover = 0;
        break;
      case 'communication':
        this.communicationHover = 0;
        break;
      case 'professionalism':
        this.professionalismHover = 0;
        break;
      case 'quality':
        this.qualityHover = 0;
        break;
      case 'timeliness':
        this.timelinessHover = 0;
        break;
    }
  }

  /**
   * Get skill rating value
   */
  getSkillRating(skill: string): number {
    switch (skill) {
      case 'technical': return this.technicalRating;
      case 'communication': return this.communicationRating;
      case 'professionalism': return this.professionalismRating;
      case 'quality': return this.qualityRating;
      case 'timeliness': return this.timelinessRating;
      default: return 0;
    }
  }

  /**
   * Get skill hover value
   */
  getSkillHover(skill: string): number {
    switch (skill) {
      case 'technical': return this.technicalHover;
      case 'communication': return this.communicationHover;
      case 'professionalism': return this.professionalismHover;
      case 'quality': return this.qualityHover;
      case 'timeliness': return this.timelinessHover;
      default: return 0;
    }
  }

  /**
   * Toggle detailed rating section
   */
  toggleDetailedRating(): void {
    this.enableDetailedRating = !this.enableDetailedRating;
    
    // If disabling, reset skill ratings
    if (!this.enableDetailedRating) {
      this.technicalRating = 0;
      this.communicationRating = 0;
      this.professionalismRating = 0;
      this.qualityRating = 0;
      this.timelinessRating = 0;
    }
  }

  /**
   * Validate form
   */
  validateForm(): boolean {
    if (this.overallRating === 0) {
      this.errorMessage = 'Please select an overall rating';
      return false;
    }

    if (!this.feedback || this.feedback.trim().length < 10) {
      this.errorMessage = 'Please provide feedback (at least 10 characters)';
      return false;
    }

    if (this.enableDetailedRating) {
      if (this.technicalRating === 0 || this.communicationRating === 0 || 
          this.professionalismRating === 0 || this.qualityRating === 0 || 
          this.timelinessRating === 0) {
        this.errorMessage = 'Please rate all skill categories';
        return false;
      }
    }

    return true;
  }

  /**
   * Submit rating
   */
  submitRating(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const ratingData: CreateRatingRequest = {
      jobseeker_id: this.candidate.user_id,
      job_id: this.candidate.job_id,
      application_id: this.candidate.application_id,
      rating: this.overallRating,
      feedback: this.feedback.trim(),
      task_description: this.taskDescription.trim() || undefined,
      would_hire_again: this.wouldHireAgain,
      is_public: this.isPublic
    };

    // Add detailed skills rating if enabled
    if (this.enableDetailedRating) {
      ratingData.skills_rating = {
        technical: this.technicalRating,
        communication: this.communicationRating,
        professionalism: this.professionalismRating,
        quality: this.qualityRating,
        timeliness: this.timelinessRating
      };
    }

    console.log('Submitting rating:', ratingData);

    this.ratingService.createRating(ratingData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Rating submitted successfully');
            this.ratingSubmitted.emit(response.data);
            this.resetForm();
            this.close();
          } else {
            this.errorMessage = response.message || 'Failed to submit rating';
          }
        },
        error: (error) => {
          console.error('❌ Error submitting rating:', error);
          this.errorMessage = error.message || 'Failed to submit rating. Please try again.';
        }
      });
  }

  /**
   * Reset form
   */
  resetForm(): void {
    this.overallRating = 0;
    this.hoverRating = 0;
    this.technicalRating = 0;
    this.communicationRating = 0;
    this.professionalismRating = 0;
    this.qualityRating = 0;
    this.timelinessRating = 0;
    this.feedback = '';
    this.taskDescription = '';
    this.wouldHireAgain = true;
    this.isPublic = true;
    this.enableDetailedRating = false;
    this.errorMessage = '';
  }

  /**
   * Close modal
   */
  close(): void {
    this.resetForm();
    this.closeModal.emit();
  }

  /**
   * Get avatar URL with fallback
   */
  getAvatarUrl(imagePath: string | null | undefined, name: string): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285f4&color=fff&size=128`;
    }
    
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // Adjust based on your API URL structure
    return imagePath;
  }
}