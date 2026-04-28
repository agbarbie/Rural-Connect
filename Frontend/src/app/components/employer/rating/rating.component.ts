// rating.component.ts - COMPLETE WORKING VERSION

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RatingService,
  CreateRatingRequest,
} from '../../../../../services/rating.service';
import { Subject, takeUntil, finalize } from 'rxjs';
import { environment } from '../../../../environments/environment.prod';

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
  selector: 'app-rating',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rating.component.html',
  styleUrls: ['./rating.component.css'],
})
export class RatingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() candidate!: CandidateToRate;
  @Input() showModal: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() ratingSubmitted = new EventEmitter<any>();

  @Input() existingRating: any = null; // NEW: Pass existing rating when editing
  private isEditMode: boolean = false;
  private ratingId: string | null = null;

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
  console.log('Existing rating input:', this.existingRating);

  // Reset edit mode
  this.isEditMode = false;
  this.ratingId = null;

  // If existingRating is provided → switch to edit mode
  if (this.existingRating && this.existingRating.id) {
    this.isEditMode = true;
    this.ratingId = this.existingRating.id;

    // Pre-fill all fields
    this.overallRating = this.existingRating.rating || 0;
    this.feedback = this.existingRating.feedback || '';
    this.taskDescription = this.existingRating.task_description || '';
    this.wouldHireAgain = this.existingRating.would_hire_again !== false; // default true
    this.isPublic = this.existingRating.is_public !== false;

    // Detailed skills
    const skills = this.existingRating.skills_rating;
    if (skills && typeof skills === 'object' && Object.keys(skills).length > 0) {
      this.enableDetailedRating = true;
      this.technicalRating = skills.technical || 0;
      this.communicationRating = skills.communication || 0;
      this.professionalismRating = skills.professionalism || 0;
      this.qualityRating = skills.quality || 0;
      this.timelinessRating = skills.timeliness || 0;
    }
  }

  console.log('Edit mode:', this.isEditMode);
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
  getStarClass(
    position: number,
    currentRating: number,
    hoverRating: number,
  ): string {
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
      case 'technical':
        return this.technicalRating;
      case 'communication':
        return this.communicationRating;
      case 'professionalism':
        return this.professionalismRating;
      case 'quality':
        return this.qualityRating;
      case 'timeliness':
        return this.timelinessRating;
      default:
        return 0;
    }
  }

  /**
   * Get skill hover value
   */
  getSkillHover(skill: string): number {
    switch (skill) {
      case 'technical':
        return this.technicalHover;
      case 'communication':
        return this.communicationHover;
      case 'professionalism':
        return this.professionalismHover;
      case 'quality':
        return this.qualityHover;
      case 'timeliness':
        return this.timelinessHover;
      default:
        return 0;
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
      if (
        this.technicalRating === 0 ||
        this.communicationRating === 0 ||
        this.professionalismRating === 0 ||
        this.qualityRating === 0 ||
        this.timelinessRating === 0
      ) {
        this.errorMessage = 'Please rate all skill categories';
        return false;
      }
    }

    return true;
  }

  private prevExistingRatingId: string | null = null;

  /**
   * Detect runtime updates to @Input() existingRating (e.g. set directly after modal opens)
   * and apply them to the form. Using ngDoCheck avoids having to change the @Input
   * declaration to a setter and works when the property is assigned on the component instance.
   */
  ngDoCheck(): void {
    const incomingId = this.existingRating && this.existingRating.id ? this.existingRating.id : null;

    // New existing rating arrived
    if (incomingId && incomingId !== this.prevExistingRatingId) {
      this.prevExistingRatingId = incomingId;
      this.applyExistingRating();
    }

    // existingRating was cleared externally
    if (!incomingId && this.prevExistingRatingId !== null) {
      this.prevExistingRatingId = null;
      this.isEditMode = false;
      this.ratingId = null;
      this.resetForm();
    }
  }

  /**
   * Populate component fields from the provided existingRating
   */
  private applyExistingRating(): void {
    if (!this.existingRating) {
      return;
    }

    this.isEditMode = true;
    this.ratingId = this.existingRating.id || null;

    this.overallRating = this.existingRating.rating || 0;
    this.feedback = this.existingRating.feedback || '';
    this.taskDescription = this.existingRating.task_description || '';
    this.wouldHireAgain = this.existingRating.would_hire_again !== false;
    this.isPublic = this.existingRating.is_public !== false;

    const skills = this.existingRating.skills_rating;
    if (skills && typeof skills === 'object' && Object.keys(skills).length > 0) {
      this.enableDetailedRating = true;
      this.technicalRating = skills.technical || 0;
      this.communicationRating = skills.communication || 0;
      this.professionalismRating = skills.professionalism || 0;
      this.qualityRating = skills.quality || 0;
      this.timelinessRating = skills.timeliness || 0;
    } else {
      this.enableDetailedRating = false;
      this.technicalRating = 0;
      this.communicationRating = 0;
      this.professionalismRating = 0;
      this.qualityRating = 0;
      this.timelinessRating = 0;
    }
  }

  /**
   * Submit rating - ENHANCED WITH LOGGING
   */
  submitRating(): void {
  console.log('Submit clicked - Edit mode:', this.isEditMode);

  if (!this.validateForm()) {
    console.log('Validation failed:', this.errorMessage);
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
    is_public: this.isPublic,
  };

  if (this.enableDetailedRating) {
    ratingData.skills_rating = {
      technical: this.technicalRating,
      communication: this.communicationRating,
      professionalism: this.professionalismRating,
      quality: this.qualityRating,
      timeliness: this.timelinessRating,
    };
  }

  console.log('Sending rating data:', ratingData);

  let apiCall$;
  if (this.isEditMode && this.ratingId) {
    // EDIT: Use PUT
    apiCall$ = this.ratingService.updateRating(this.ratingId, ratingData);
  } else {
    // CREATE: Use POST
    apiCall$ = this.ratingService.createRating(ratingData);
  }

  apiCall$
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isSubmitting = false)
    )
    .subscribe({
      next: (response) => {
        console.log('Rating saved successfully:', response);
        if (response.success) {
          this.ratingSubmitted.emit(response.data);
          this.resetForm();
          this.close();
        } else {
          this.errorMessage = response.message || 'Failed to save rating';
        }
      },
      error: (error) => {
        console.error('Rating submission error:', error);
        this.errorMessage =
          error.error?.message ||
          error.message ||
          'Failed to save rating. Please try again.';
      },
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

    // If it's already a full URL (http, https, or data:)
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }

    // Otherwise, it's a relative path from the backend (e.g. profiles/filename.jpg or uploads/profiles/...)
    const baseUrl = environment.apiUrl.replace('/api', '');
    // Handle both "/uploads/profiles/..." and "profiles/..."
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseUrl}${cleanPath}`;
  }
}
