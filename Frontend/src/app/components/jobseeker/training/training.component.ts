import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { 
  TrainingService, 
  Training, 
  TrainingVideo,
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
  showVideoLoading: boolean = false;
  
  // ✅ FIXED: Video player state
  showVideoPlayer: boolean = false;
  currentVideo: TrainingVideo | null = null;
  currentVideoIndex: number = -1;
  safeVideoUrl: SafeResourceUrl | null = null;
  
  // Pagination
  currentPage: number = 1;
  totalPages: number = 1;
  pageSize: number = 12;
  totalCount: number = 0;

  // Wishlist management (in-memory only)
  private wishlistSet: Set<string> = new Set();
  
  addToWishlist(trainingId: string): void {
    this.wishlistSet.add(trainingId);
    console.log('Added to wishlist:', trainingId);
  }
  
  removeFromWishlist(trainingId: string): void {
    this.wishlistSet.delete(trainingId);
    console.log('Removed from wishlist:', trainingId);
  }
  
  isInWishlist(trainingId: string): boolean {
    return this.wishlistSet.has(trainingId);
  }

  constructor(
    private trainingService: TrainingService,
    private sanitizer: DomSanitizer  // ✅ Added for safe video URLs
  ) {}

  ngOnInit(): void {
    this.loadTrainings();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // VIDEO PLAYER METHODS
  // ============================================

  /**
   * ✅ NEW: Play video with proper URL handling
   */
  playVideo(video: TrainingVideo, index: number): void {
    console.log('🎥 Playing video:', video);
    
    if (!video.video_url) {
      console.error('❌ No video URL found');
      alert('Video URL is missing');
      return;
    }

    // Check if video is accessible
    if (!this.isVideoAccessible(video)) {
      alert('This video is not available in preview. Please enroll in the training to access all videos.');
      return;
    }

    this.currentVideo = video;
    this.currentVideoIndex = index;
    
    // Get embed URL and sanitize it
    const embedUrl = this.trainingService.getVideoEmbedUrl(video.video_url);
    console.log('📺 Embed URL:', embedUrl);
    
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    this.showVideoPlayer = true;
  }

  /**
   * ✅ NEW: Close video player
   */
  closeVideoPlayer(): void {
    this.showVideoPlayer = false;
    this.currentVideo = null;
    this.currentVideoIndex = -1;
    this.safeVideoUrl = null;
  }

  /**
   * ✅ NEW: Play next video
   */
  playNextVideo(): void {
    if (!this.selectedTraining?.videos) return;
    
    const nextIndex = this.currentVideoIndex + 1;
    if (nextIndex < this.selectedTraining.videos.length) {
      const nextVideo = this.selectedTraining.videos[nextIndex];
      if (this.isVideoAccessible(nextVideo)) {
        this.playVideo(nextVideo, nextIndex);
      } else {
        alert('Next video requires enrollment');
      }
    }
  }

  /**
   * ✅ NEW: Play previous video
   */
  playPreviousVideo(): void {
    if (!this.selectedTraining?.videos) return;
    
    const prevIndex = this.currentVideoIndex - 1;
    if (prevIndex >= 0) {
      const prevVideo = this.selectedTraining.videos[prevIndex];
      this.playVideo(prevVideo, prevIndex);
    }
  }

  /**
   * ✅ NEW: Check if video is accessible
   */
  isVideoAccessible(video: TrainingVideo): boolean {
    if (!this.selectedTraining) return false;
    return this.trainingService.isVideoAccessible(video, this.selectedTraining);
  }

  /**
   * ✅ NEW: Get video status badge
   */
  getVideoStatusBadge(video: TrainingVideo): string {
    if (video.completed) return '✓ Completed';
    if (video.is_preview) return '🔓 Preview';
    if (!this.selectedTraining?.enrolled) return '🔒 Locked';
    return '';
  }

  // ============================================
  // EXISTING METHODS (unchanged)
  // ============================================

  private isValidTraining(training: Training): boolean {
    if (!training.id || !training.title || !training.description || !training.provider_name) {
      console.warn('❌ Missing required fields:', training.id);
      return false;
    }

    if (training.status !== 'published') {
      console.warn('❌ Not published:', training.title, 'Status:', training.status);
      return false;
    }

    if (!training.provider_id || training.provider_id === 'null' || training.provider_id === 'undefined') {
      console.warn('❌ Invalid provider_id:', training.title, 'Provider ID:', training.provider_id);
      return false;
    }

    if (training.duration_hours <= 0) {
      console.warn('❌ Invalid duration:', training.title);
      return false;
    }

    if (training.cost_type === 'Paid' && (!training.price || training.price <= 0)) {
      console.warn('❌ Paid training with invalid price:', training.title);
      return false;
    }

    return true;
  }

  loadTrainings(page: number = 1): void {
    this.loading = true;
    this.error = null;
    
    const searchParams: TrainingSearchParams = {
      page: page,
      limit: this.pageSize,
      sort_by: 'created_at',
      sort_order: 'desc',
      status: 'published',
      category: this.selectedCategory !== 'all' ? this.selectedCategory : undefined,
      search: this.searchQuery.trim() || undefined,
      level: this.filters.level.length > 0 ? this.filters.level[0] : undefined,
      cost_type: this.filters.cost.length > 0 ? this.filters.cost[0] : undefined,
      mode: this.filters.mode.length > 0 ? this.filters.mode[0] : undefined
    };

    console.log('🔍 Loading trainings with params:', searchParams);

    this.trainingService.getJobseekerTrainings(searchParams)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📦 Raw API response:', response);
          
          if (response.success && response.data) {
            const rawTrainings = response.data.trainings || [];
            const validTrainings = rawTrainings.filter((training: Training) => 
              this.isValidTraining(training)
            );
            
            this.trainings = validTrainings;
            this.filteredTrainings = [...this.trainings];
            
            if (response.pagination) {
              this.currentPage = response.pagination.current_page;
              this.totalPages = response.pagination.total_pages;
              this.totalCount = response.pagination.total_count;
            }
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading trainings:', error);
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

  viewTrainingDetail(training: Training): void {
    this.loading = true;
    this.showVideoLoading = true;
    this.error = null;
    
    console.log('🔍 Fetching full details for training:', training.id);
    
    this.trainingService.getTrainingDetails(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📦 Training details response:', response);
          if (response.success && response.data) {
            if (this.isValidTraining(response.data)) {
              this.selectedTraining = response.data;
              console.log('✅ Training loaded with videos:', this.selectedTraining.videos?.length || 0);
            } else {
              console.error('❌ Training failed validation check');
              this.error = 'This training is no longer available.';
            }
            this.showVideoLoading = false;
            this.showTrainingDetail = true;
          } else {
            this.error = 'Failed to load training details.';
            this.showVideoLoading = false;
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading training details:', error);
          this.error = 'Failed to load training details. Please try again.';
          this.loading = false;
          this.showVideoLoading = false;
        }
      });
  }

  closeTrainingDetail(): void {
    this.showTrainingDetail = false;
    this.selectedTraining = null;
    this.showVideoLoading = false;
    this.closeVideoPlayer();  // ✅ Also close video player
  }

  enrollInTraining(training: Training): void {
    console.log('📝 Enrolling in training:', training.id);
    
    this.trainingService.enrollInTraining(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            training.enrolled = true;
            if (this.selectedTraining && this.selectedTraining.id === training.id) {
              this.selectedTraining.enrolled = true;
            }
            console.log('✅ Successfully enrolled in:', training.title);
            alert('Successfully enrolled in the training!');
          }
        },
        error: (error: any) => {
          console.error('❌ Error enrolling in training:', error);
          this.error = 'Failed to enroll in training. Please try again.';
        }
      });
  }

  startTraining(training: Training): void {
    console.log('▶️ Starting training:', training.title);
    alert('Starting training: ' + training.title);
  }

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

  getVideoEmbedUrl(videoUrl: string): string {
    return this.trainingService.getVideoEmbedUrl(videoUrl);
  }
} 