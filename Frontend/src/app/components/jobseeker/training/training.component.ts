import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { 
  TrainingService, 
  Training, 
  TrainingSearchParams, 
  PaginatedResponse 
} from '../../../../../services/training.service';

interface FilterOptions {
  duration: string[];
  level: string[];
  cost: string[];
  mode: string[];
  category: string[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./training.component.css']
})
export class TrainingComponent implements OnInit, OnDestroy {
  Math = Math;
  
  private destroy$ = new Subject<void>();
  
  trainings: Training[] = [];
  filteredTrainings: Training[] = [];
  selectedCategory: string = 'all';
  searchQuery: string = '';
  
  filters: FilterOptions = {
    duration: [],
    level: [],
    cost: [],
    mode: [],
    category: []
  };

  categories: string[] = [];
  
  showFilters: boolean = false;
  selectedTraining: Training | null = null;
  showTrainingDetail: boolean = false;
  
  // Loading and error states
  loading: boolean = false;
  error: string | null = null;
  showVideoLoading: boolean = false;  // NEW: For modal video section
  
  // Pagination
  currentPage: number = 1;
  totalPages: number = 1;
  pageSize: number = 12;
  totalCount: number = 0;

  // FIXED: Wishlist management (localStorage-based)
  private wishlistKey = 'training-wishlist';
  get wishlist(): string[] {
    return JSON.parse(localStorage.getItem(this.wishlistKey) || '[]');
  }
  addToWishlist(trainingId: string): void {
    let wishlist = this.wishlist;
    if (!wishlist.includes(trainingId)) {
      wishlist.push(trainingId);
      localStorage.setItem(this.wishlistKey, JSON.stringify(wishlist));
      console.log('Added to wishlist:', trainingId);
    }
  }
  removeFromWishlist(trainingId: string): void {
    let wishlist = this.wishlist.filter(id => id !== trainingId);
    localStorage.setItem(this.wishlistKey, JSON.stringify(wishlist));
    console.log('Removed from wishlist:', trainingId);
  }
  isInWishlist(trainingId: string): boolean {
    return this.wishlist.includes(trainingId);
  }

  constructor(private trainingService: TrainingService) {}

  ngOnInit(): void {
    this.loadTrainings();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTrainings(page: number = 1): void {
    this.loading = true;
    this.error = null;
    
    const searchParams: TrainingSearchParams = {
      page: page,
      limit: this.pageSize,
      sort_by: 'created_at',
      sort_order: 'desc',
      category: this.selectedCategory !== 'all' ? this.selectedCategory : undefined,
      search: this.searchQuery.trim() || undefined,
      level: this.filters.level.length > 0 ? this.filters.level[0] : undefined,
      cost_type: this.filters.cost.length > 0 ? this.filters.cost[0] : undefined,
      mode: this.filters.mode.length > 0 ? this.filters.mode[0] : undefined
    };

    console.log('Loading trainings with params:', searchParams);

    this.trainingService.getJobseekerTrainings(searchParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Trainings loaded:', response);
          if (response.success && response.data) {
            this.trainings = response.data.trainings;
            this.filteredTrainings = [...this.trainings];
            
            // Log video counts for debugging
            this.trainings.forEach(training => {
              console.log(`Training "${training.title}" has ${training.videos?.length || training.video_count || 0} videos`);
            });
            
            if (response.pagination) {
              this.currentPage = response.pagination.current_page;
              this.totalPages = response.pagination.total_pages;
              this.totalCount = response.pagination.total_count;
            }
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading trainings:', error);
          this.error = 'Failed to load training programs. Please try again.';
          this.loading = false;
        }
      });
  }

  loadCategories(): void {
    this.trainingService.getTrainingCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.categories = response.data.map((cat: any) => cat.name || cat);
          }
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.categories = ['Data Science', 'Frontend Development', 'Marketing', 'Cloud Computing', 'Design'];
        }
      });
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.loadTrainings(1);
  }

  onSearchChange(): void {
    setTimeout(() => {
      this.currentPage = 1;
      this.loadTrainings(1);
    }, 500);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTrainings(1);
  }

  applyFilters(): void {
    this.loadTrainings(this.currentPage);
  }

  // UPDATED: viewTrainingDetail with extra logging and video fallback
  viewTrainingDetail(training: Training): void {
    this.loading = true;
    this.showVideoLoading = true;  // NEW
    this.error = null;
    
    console.log('Fetching full details for training:', training.id);
    
    // Fetch complete training details including videos and outcomes
    this.trainingService.getTrainingDetails(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Training details response:', response);
          if (response.success && response.data) {
            this.selectedTraining = response.data;
            console.log('Selected training videos in modal:', this.selectedTraining.videos?.length || 0, 
                        'Count:', this.selectedTraining.video_count);
            
            // NEW: If video_count is 0 and videos empty, fetch count separately
            if ((!this.selectedTraining.videos || this.selectedTraining.videos.length === 0) && 
                (this.selectedTraining.video_count || 0) === 0) {
              this.trainingService.getVideoCount(training.id).subscribe(countResponse => {
                if (countResponse.success && countResponse.data) {
                  this.selectedTraining!.video_count = countResponse.data.count;
                  console.log('Fetched video count:', this.selectedTraining!.video_count);
                }
                this.showVideoLoading = false;
              });
            } else {
              this.showVideoLoading = false;
            }
            
            this.showTrainingDetail = true;
          } else {
            this.error = 'Failed to load training details.';
            this.showVideoLoading = false;
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading training details:', error);
          this.error = 'Failed to load training details. Please try again.';
          this.loading = false;
          this.showVideoLoading = false;
        }
      });
  }

  // NEW: Refresh videos for current training
  refreshTrainingVideos(trainingId: string): void {
    if (this.selectedTraining?.id === trainingId) {
      this.viewTrainingDetail(this.selectedTraining);
    }
  }

  closeTrainingDetail(): void {
    this.showTrainingDetail = false;
    this.selectedTraining = null;
    this.showVideoLoading = false;  // NEW
  }

  enrollInTraining(training: Training): void {
    console.log('Enrolling in training:', training.id);
    
    this.trainingService.enrollInTraining(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            training.enrolled = true;
            if (this.selectedTraining && this.selectedTraining.id === training.id) {
              this.selectedTraining.enrolled = true;
            }
            console.log('Successfully enrolled in:', training.title);
            alert('Successfully enrolled in the training!');
          }
        },
        error: (error: any) => {
          console.error('Error enrolling in training:', error);
          this.error = 'Failed to enroll in training. Please try again.';
        }
      });
  }

  startTraining(training: Training): void {
    console.log('Starting training:', training.title);
    // Navigate to training player/viewer
    // You can implement navigation to a detailed training viewer here
    alert('Starting training: ' + training.title);
  }

  // FIXED: Add handlers for wishlist and share
  toggleWishlist(trainingId: string): void {
    if (this.isInWishlist(trainingId)) {
      this.removeFromWishlist(trainingId);
    } else {
      this.addToWishlist(trainingId);
    }
  }

  shareTraining(training: Training): void {
    if (navigator.share) {
      navigator.share({
        title: training.title,
        text: `Check out this training: ${training.description?.substring(0, 100)}...`,
        url: window.location.origin + `/trainings/${training.id}`
      }).catch(err => console.error('Share failed:', err));
    } else {
      // Fallback: Copy link to clipboard or alert
      navigator.clipboard.writeText(window.location.origin + `/trainings/${training.id}`);
      alert(`Link copied to clipboard: ${training.title}`);
    }
  }

  onFilterCheckboxChange(filterType: keyof FilterOptions, value: string, event: any): void {
    if (event.target.checked) {
      this.filters[filterType].push(value);
    } else {
      const index = this.filters[filterType].indexOf(value);
      if (index > -1) {
        this.filters[filterType].splice(index, 1);
      }
    }
    this.onFilterChange();
  }

  clearAllFilters(): void {
    this.filters = {
      duration: [],
      level: [],
      cost: [],
      mode: [],
      category: []
    };
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadTrainings(1);
  }

  getDurationText(duration_hours: number): string {
    if (duration_hours < 10) return 'Short Course';
    if (duration_hours <= 40) return 'Medium Course';
    return 'Comprehensive Course';
  }

  getProgressWidth(progress: number): string {
    return `${progress}%`;
  }

  formatDuration(duration_hours: number): string {
    return this.trainingService.formatDuration(duration_hours);
  }

  formatPrice(training: Training): string {
    return this.trainingService.formatPrice(training.price, training.cost_type);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.loadTrainings(page);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  refreshTrainings(): void {
    this.loadTrainings(this.currentPage);
  }

  isEnrolled(training: Training): boolean {
    return training.enrolled || false;
  }

  getTrainingProgress(training: Training): number {
    return training.progress || 0;
  }

  getPaginationPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Helper method to get video embed URL
  getVideoEmbedUrl(videoUrl: string): string {
    return this.trainingService.getVideoEmbedUrl(videoUrl);
  }

  // Helper method to check if video is accessible
  isVideoAccessible(video: any): boolean {
    if (!this.selectedTraining) return false;
    return this.trainingService.isVideoAccessible(video, this.selectedTraining);
  }
}