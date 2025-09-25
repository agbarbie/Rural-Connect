import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { 
  TrainingService, 
  Training, 
  CreateTrainingRequest, 
  UpdateTrainingRequest,
  TrainingStats,
  TrainingVideo,
  TrainingOutcome,
  TrainingSearchParams 
} from '../../../../../services/training.service';

interface NewTraining {
  title: string;
  description: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration_hours: number;
  cost_type: 'Free' | 'Paid';
  price: number;
  mode: 'Online' | 'Offline';
  provider_name: string;
  has_certificate: boolean;
  thumbnail_url: string;
  location: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  videos: TrainingVideo[];
  outcomes: TrainingOutcome[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./training.component.css']
})
export class TrainingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Component state
  employerName: string = 'TechCorp Solutions';
  trainings: Training[] = [];
  showAddForm: boolean = false;
  selectedTraining: Training | null = null;
  showVideoPlayer: boolean = false;
  isLoading: boolean = false;
  error: string | null = null;
  
  // Training stats
  stats: TrainingStats | null = null;
  
  // Search and pagination
  searchParams: TrainingSearchParams = {
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  };
  totalPages: number = 0;
  currentPage: number = 1;
  
  // Form data
  newTraining: NewTraining = {
    title: '',
    description: '',
    category: 'Technology',
    level: 'Beginner',
    duration_hours: 1,
    cost_type: 'Free',
    price: 0,
    mode: 'Online',
    provider_name: this.employerName,
    has_certificate: false,
    thumbnail_url: '',
    location: '',
    start_date: '',
    end_date: '',
    max_participants: 0,
    videos: [],
    outcomes: []
  };
  
  // Form helpers
  categories: string[] = [
    'Technology', 'Business', 'Design', 'Marketing', 
    'Personal Development', 'Health & Safety', 'Finance',
    'Communication', 'Leadership', 'Project Management'
  ];
  
  levels: ('Beginner' | 'Intermediate' | 'Advanced')[] = ['Beginner', 'Intermediate', 'Advanced'];
  
  // Video form
  showVideoForm: boolean = false;
  newVideo: TrainingVideo = {
    title: '',
    description: '',
    video_url: '',
    duration_minutes: 0,
    order_index: 0,
    is_preview: false
  };
  
  // Outcome form
  showOutcomeForm: boolean = false;
  newOutcome: TrainingOutcome = {
    outcome_text: '',
    order_index: 0
  };

  constructor(private trainingService: TrainingService) {}

  ngOnInit(): void {
    this.loadTrainings();
    this.loadStats();
    
    // Subscribe to service state
    this.trainingService.trainings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trainings => {
        this.trainings = trainings;
      });
    
    this.trainingService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
    
    this.trainingService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ================ COMPUTED PROPERTIES ================
  
  get totalCompletions(): number {
    return this.stats?.total_enrollments || 0;
  }

  get totalCertificates(): number {
    return this.trainings.reduce((sum, t) => sum + t.total_students, 0);
  }

  get activeTrainingsCount(): number {
    return this.stats?.published_trainings || 0;
  }
  
  get draftTrainingsCount(): number {
    return this.stats?.draft_trainings || 0;
  }
  
  get suspendedTrainingsCount(): number {
    return this.stats?.suspended_trainings || 0;
  }

  // ================ DATA LOADING ================

  loadTrainings(): void {
    this.trainingService.getMyTrainings(this.searchParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.trainings = response.data.trainings;
            if (response.pagination) {
              this.totalPages = response.pagination.total_pages;
              this.currentPage = response.pagination.current_page;
            }
          }
        },
        error: (error) => {
          console.error('Error loading trainings:', error);
          this.error = 'Failed to load trainings. Please try again.';
        }
      });
  }

  loadStats(): void {
    this.trainingService.getTrainingStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.stats = response.data;
          }
        },
        error: (error) => {
          console.error('Error loading stats:', error);
        }
      });
  }

  // ================ SEARCH AND FILTERING ================

  onSearch(searchTerm: string): void {
    this.searchParams.search = searchTerm;
    this.searchParams.page = 1;
    this.loadTrainings();
  }

  onFilterChange(filterType: string, value: string): void {
    switch (filterType) {
      case 'category':
        this.searchParams.category = value;
        break;
      case 'level':
        this.searchParams.level = value;
        break;
      case 'status':
        this.searchParams.status = value;
        break;
      case 'sort_by':
        this.searchParams.sort_by = value as any;
        break;
      case 'sort_order':
        this.searchParams.sort_order = value as 'asc' | 'desc';
        break;
    }
    this.searchParams.page = 1;
    this.loadTrainings();
  }

  onPageChange(page: number): void {
    this.searchParams.page = page;
    this.loadTrainings();
  }

  // ================ FORM MANAGEMENT ================

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.newTraining = {
      title: '',
      description: '',
      category: 'Technology',
      level: 'Beginner',
      duration_hours: 1,
      cost_type: 'Free',
      price: 0,
      mode: 'Online',
      provider_name: this.employerName,
      has_certificate: false,
      thumbnail_url: '',
      location: '',
      start_date: '',
      end_date: '',
      max_participants: 0,
      videos: [],
      outcomes: []
    };
    this.error = null;
  }

  // ================ VIDEO MANAGEMENT ================

  toggleVideoForm(): void {
    this.showVideoForm = !this.showVideoForm;
    if (!this.showVideoForm) {
      this.resetVideoForm();
    }
  }

  resetVideoForm(): void {
    this.newVideo = {
      title: '',
      description: '',
      video_url: '',
      duration_minutes: 0,
      order_index: this.newTraining.videos.length,
      is_preview: false
    };
  }

  addVideo(): void {
    if (this.newVideo.title && this.newVideo.duration_minutes > 0) {
      this.newTraining.videos.push({ ...this.newVideo });
      this.toggleVideoForm();
    }
  }

  removeVideo(index: number): void {
    this.newTraining.videos.splice(index, 1);
    // Update order indices
    this.newTraining.videos.forEach((video, i) => {
      video.order_index = i;
    });
  }

  // ================ OUTCOME MANAGEMENT ================

  toggleOutcomeForm(): void {
    this.showOutcomeForm = !this.showOutcomeForm;
    if (!this.showOutcomeForm) {
      this.resetOutcomeForm();
    }
  }

  resetOutcomeForm(): void {
    this.newOutcome = {
      outcome_text: '',
      order_index: this.newTraining.outcomes.length
    };
  }

  addOutcome(): void {
    if (this.newOutcome.outcome_text.trim()) {
      this.newTraining.outcomes.push({ ...this.newOutcome });
      this.toggleOutcomeForm();
    }
  }

  removeOutcome(index: number): void {
    this.newTraining.outcomes.splice(index, 1);
    // Update order indices
    this.newTraining.outcomes.forEach((outcome, i) => {
      outcome.order_index = i;
    });
  }

  // ================ TRAINING CRUD OPERATIONS ================

  addTraining(): void {
    if (this.isFormValid()) {
      const trainingData: CreateTrainingRequest = {
        title: this.newTraining.title,
        description: this.newTraining.description,
        category: this.newTraining.category,
        level: this.newTraining.level,
        duration_hours: this.newTraining.duration_hours,
        cost_type: this.newTraining.cost_type,
        price: this.newTraining.cost_type === 'Paid' ? this.newTraining.price : 0,
        mode: this.newTraining.mode,
        provider_name: this.newTraining.provider_name,
        has_certificate: this.newTraining.has_certificate,
        thumbnail_url: this.newTraining.thumbnail_url || undefined,
        location: this.newTraining.location || undefined,
        start_date: this.newTraining.start_date || undefined,
        end_date: this.newTraining.end_date || undefined,
        max_participants: this.newTraining.max_participants || undefined,
        videos: this.newTraining.videos,
        outcomes: this.newTraining.outcomes
      };

      this.trainingService.createTraining(trainingData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.toggleAddForm();
              this.loadStats(); // Refresh stats
              // Show success message
              alert('Training created successfully!');
            }
          },
          error: (error) => {
            console.error('Error creating training:', error);
            this.error = 'Failed to create training. Please check your inputs and try again.';
          }
        });
    }
  }

  updateTraining(training: Training, updateData: UpdateTrainingRequest): void {
    this.trainingService.updateTraining(training.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // Training list will be updated automatically via the service
            alert('Training updated successfully!');
          }
        },
        error: (error) => {
          console.error('Error updating training:', error);
          this.error = 'Failed to update training. Please try again.';
        }
      });
  }

  deleteTraining(trainingId: string): void {
    if (confirm('Are you sure you want to delete this training? This action cannot be undone.')) {
      this.trainingService.deleteTraining(trainingId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              // Training will be removed from list automatically via the service
              this.loadStats(); // Refresh stats
              alert('Training deleted successfully!');
            }
          },
          error: (error) => {
            console.error('Error deleting training:', error);
            this.error = 'Failed to delete training. Please try again.';
          }
        });
    }
  }

  // ================ TRAINING STATUS MANAGEMENT ================

  publishTraining(training: Training): void {
    if (confirm('Are you sure you want to publish this training? It will become visible to jobseekers.')) {
      this.trainingService.publishTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats(); // Refresh stats
              alert('Training published successfully!');
            }
          },
          error: (error) => {
            console.error('Error publishing training:', error);
            this.error = 'Failed to publish training. Please try again.';
          }
        });
    }
  }

  unpublishTraining(training: Training): void {
    if (confirm('Are you sure you want to unpublish this training? It will no longer be visible to jobseekers.')) {
      this.trainingService.unpublishTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats(); // Refresh stats
              alert('Training unpublished successfully!');
            }
          },
          error: (error) => {
            console.error('Error unpublishing training:', error);
            this.error = 'Failed to unpublish training. Please try again.';
          }
        });
    }
  }

  suspendTraining(training: Training): void {
    if (confirm('Are you sure you want to suspend this training? Current enrollments will be affected.')) {
      this.trainingService.suspendTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats(); // Refresh stats
              alert('Training suspended successfully!');
            }
          },
          error: (error) => {
            console.error('Error suspending training:', error);
            this.error = 'Failed to suspend training. Please try again.';
          }
        });
    }
  }

  toggleTrainingStatus(training: Training): void {
    switch (training.status) {
      case 'draft':
        this.publishTraining(training);
        break;
      case 'published':
        this.unpublishTraining(training);
        break;
      case 'suspended':
        this.publishTraining(training);
        break;
    }
  }

  // ================ TRAINING DETAILS AND ANALYTICS ================

  viewTrainingDetails(training: Training): void {
    this.selectedTraining = training;
    this.showVideoPlayer = true;
  }

  closeVideoPlayer(): void {
    this.showVideoPlayer = false;
    this.selectedTraining = null;
  }

  viewTrainingAnalytics(training: Training): void {
    // Navigate to analytics view or open modal
    // This would typically navigate to a detailed analytics page
    console.log('Viewing analytics for training:', training.id);
    
    this.trainingService.getTrainingAnalytics(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training analytics:', response.data);
            // Display analytics in modal or navigate to analytics page
          }
        },
        error: (error) => {
          console.error('Error loading analytics:', error);
          this.error = 'Failed to load training analytics.';
        }
      });
  }

  viewEnrollments(training: Training): void {
    // Navigate to enrollments view or open modal
    console.log('Viewing enrollments for training:', training.id);
    
    this.trainingService.getTrainingEnrollments(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training enrollments:', response.data);
            // Display enrollments in modal or navigate to enrollments page
          }
        },
        error: (error) => {
          console.error('Error loading enrollments:', error);
          this.error = 'Failed to load training enrollments.';
        }
      });
  }

  viewReviews(training: Training): void {
    // Navigate to reviews view or open modal
    console.log('Viewing reviews for training:', training.id);
    
    this.trainingService.getTrainingReviews(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training reviews:', response.data);
            // Display reviews in modal or navigate to reviews page
          }
        },
        error: (error) => {
          console.error('Error loading reviews:', error);
          this.error = 'Failed to load training reviews.';
        }
      });
  }

  // ================ FORM VALIDATION ================

  isFormValid(): boolean {
    const basicValidation = !!(
      this.newTraining.title && 
      this.newTraining.description && 
      this.newTraining.category &&
      this.newTraining.level &&
      this.newTraining.duration_hours > 0 &&
      this.newTraining.provider_name
    );
    
    // Additional validation for paid trainings
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      return false;
    }
    
    // Additional validation for offline trainings
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      return false;
    }
    
    // Validate dates if provided
    if (this.newTraining.start_date && this.newTraining.end_date) {
      const startDate = new Date(this.newTraining.start_date);
      const endDate = new Date(this.newTraining.end_date);
      if (startDate >= endDate) {
        return false;
      }
    }
    
    return basicValidation;
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    if (!this.newTraining.title) errors.push('Title is required');
    if (!this.newTraining.description) errors.push('Description is required');
    if (!this.newTraining.category) errors.push('Category is required');
    if (!this.newTraining.provider_name) errors.push('Provider name is required');
    if (this.newTraining.duration_hours <= 0) errors.push('Duration must be greater than 0');
    
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      errors.push('Price must be greater than 0 for paid trainings');
    }
    
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      errors.push('Location is required for offline trainings');
    }
    
    if (this.newTraining.start_date && this.newTraining.end_date) {
      const startDate = new Date(this.newTraining.start_date);
      const endDate = new Date(this.newTraining.end_date);
      if (startDate >= endDate) {
        errors.push('End date must be after start date');
      }
    }
    
    return errors;
  }

  // ================ UTILITY METHODS ================

  clearError(): void {
    this.error = null;
    this.trainingService.clearError();
  }

  formatDuration(hours: number): string {
    return this.trainingService.formatDuration(hours);
  }

  formatPrice(price: number, costType: string): string {
    return this.trainingService.formatPrice(price, costType);
  }

  getStatusColor(status: string): string {
    return this.trainingService.getStatusColor(status);
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'published': return 'Published';
      case 'draft': return 'Draft';
      case 'suspended': return 'Suspended';
      case 'completed': return 'Completed';
      default: return status;
    }
  }

  onCostTypeChange(): void {
    if (this.newTraining.cost_type === 'Free') {
      this.newTraining.price = 0;
    }
  }

  onModeChange(): void {
    if (this.newTraining.mode === 'Online') {
      this.newTraining.location = '';
    }
  }

  // ================ FILE HANDLING ================

  onThumbnailSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // In a real application, you would upload this file to a server
      // For now, we'll create a local URL for preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newTraining.thumbnail_url = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // ================ TRAINING DUPLICATION ================

  duplicateTraining(training: Training): void {
    if (confirm('Create a copy of this training?')) {
      const duplicatedTraining: CreateTrainingRequest = {
        title: `${training.title} (Copy)`,
        description: training.description,
        category: training.category,
        level: training.level,
        duration_hours: training.duration_hours,
        cost_type: training.cost_type,
        price: training.price,
        mode: training.mode,
        provider_name: training.provider_name,
        has_certificate: training.has_certificate,
        thumbnail_url: training.thumbnail_url,
        location: training.location,
        max_participants: training.max_participants,
        videos: training.videos || [],
        outcomes: training.outcomes || []
      };

      this.trainingService.createTraining(duplicatedTraining)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Training duplicated successfully!');
            }
          },
          error: (error) => {
            console.error('Error duplicating training:', error);
            this.error = 'Failed to duplicate training. Please try again.';
          }
        });
    }
  }

  // ================ BULK OPERATIONS ================

  selectedTrainingIds: Set<string> = new Set();

  toggleTrainingSelection(trainingId: string): void {
    if (this.selectedTrainingIds.has(trainingId)) {
      this.selectedTrainingIds.delete(trainingId);
    } else {
      this.selectedTrainingIds.add(trainingId);
    }
  }

  isTrainingSelected(trainingId: string): boolean {
    return this.selectedTrainingIds.has(trainingId);
  }

  selectAllTrainings(): void {
    this.trainings.forEach(training => {
      this.selectedTrainingIds.add(training.id);
    });
  }

  deselectAllTrainings(): void {
    this.selectedTrainingIds.clear();
  }

  bulkPublishTrainings(): void {
    const selectedIds = Array.from(this.selectedTrainingIds);
    if (selectedIds.length === 0) {
      alert('Please select trainings to publish.');
      return;
    }

    if (confirm(`Publish ${selectedIds.length} selected training(s)?`)) {
      selectedIds.forEach(id => {
        const training = this.trainings.find(t => t.id === id);
        if (training && training.status === 'draft') {
          this.trainingService.publishTraining(id).pipe(takeUntil(this.destroy$)).subscribe();
        }
      });
      this.selectedTrainingIds.clear();
    }
  }

  bulkSuspendTrainings(): void {
    const selectedIds = Array.from(this.selectedTrainingIds);
    if (selectedIds.length === 0) {
      alert('Please select trainings to suspend.');
      return;
    }

    if (confirm(`Suspend ${selectedIds.length} selected training(s)?`)) {
      selectedIds.forEach(id => {
        const training = this.trainings.find(t => t.id === id);
        if (training && training.status === 'published') {
          this.trainingService.suspendTraining(id).pipe(takeUntil(this.destroy$)).subscribe();
        }
      });
      this.selectedTrainingIds.clear();
    }
  }
}