// training.component.ts (FIXED VERSION - Video Creation Error Resolved)
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, interval } from 'rxjs';
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
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { DatePipe } from '@angular/common';

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
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./training.component.css'],
  providers: [DatePipe]
})
export class TrainingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Component state
  employerName: string = 'TechCorp Solutions';
  employerId: string = 'current-employer-id';
  trainings: Training[] = [];
  showAddForm: boolean = false;
  selectedTraining: Training | null = null;
  showVideoPlayer: boolean = false;
  isLoading: boolean = false;
  error: string | null = null;

  // For details modal
  showDetailsModal: boolean = false;
  detailedTraining: Training | null = null; // ✅ This property exists

  // For editing
  editingTrainingId: string | null = null;

  // Thumbnail handling
  thumbnailPreview: string | null = null;
  thumbnailFile: File | null = null;

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
  editingVideoId: string | null = null;
  newVideo: TrainingVideo = {
    title: '',
    description: '',
    video_url: '',
    duration_minutes: 0,
    duration: 0,
    order_index: 0,
    is_preview: false,
    completed: false,
    url: ''
  };

  // Outcome form
  showOutcomeForm: boolean = false;
  newOutcome: TrainingOutcome = {
    outcome_text: '',
    order_index: 0
  };

  // Notifications
  enrollmentNotifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;

  // Bulk operations
  selectedTrainingIds: Set<string> = new Set();

  constructor(
    private trainingService: TrainingService,
    private http: HttpClient,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    console.log('🚀 Initializing Training Component...');
   
    const userId = localStorage.getItem('userId');
    if (userId) {
      this.employerId = userId;
      console.log('✅ Employer ID loaded:', this.employerId);
    }
   
    this.trainingService.trainings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trainings => {
        console.log('📦 Trainings received from service:', trainings?.length || 0);
        this.trainings = trainings || [];
        this.calculateLocalStats();
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
   
    this.loadTrainings();
    this.loadStats();
    this.loadNotifications();
   
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Computed Properties
  get totalCompletions(): number {
    return this.trainings.reduce((sum, t) => sum + (t.total_students || 0), 0);
  }

  get totalCertificates(): number {
    return this.trainings
      .filter(t => t.has_certificate)
      .reduce((sum, t) => sum + (t.total_students || 0), 0);
  }

  get activeTrainingsCount(): number {
    return this.trainings.filter(t => t.status === 'published').length;
  }

  get draftTrainingsCount(): number {
    return this.trainings.filter(t => t.status === 'draft').length;
  }

  get suspendedTrainingsCount(): number {
    return this.trainings.filter(t => t.status === 'suspended').length;
  }

  get totalTrainingsCount(): number {
    return this.trainings.length;
  }

  get totalVideosCount(): number {
    return this.trainings.reduce((sum, t) => {
      const videoCount = t.videos?.length || t.video_count || 0;
      return sum + videoCount;
    }, 0);
  }

  get averageRating(): number {
    if (this.trainings.length === 0) return 0;
    const totalRating = this.trainings.reduce((sum, t) => sum + (t.rating || 0), 0);
    return Math.round((totalRating / this.trainings.length) * 10) / 10;
  }

  get totalRevenue(): number {
    return this.trainings
      .filter(t => t.cost_type === 'Paid')
      .reduce((sum, t) => sum + ((t.price || 0) * (t.total_students || 0)), 0);
  }

  get freeTrainingsCount(): number {
    return this.trainings.filter(t => t.cost_type === 'Free').length;
  }

  get paidTrainingsCount(): number {
    return this.trainings.filter(t => t.cost_type === 'Paid').length;
  }

  // Data Loading
  loadTrainings(): void {
    this.trainingService.getMyTrainings(this.searchParams, this.employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Raw response:', response);
         
          if (response.success) {
            if (response.data && Array.isArray(response.data.trainings)) {
              this.trainings = response.data.trainings;
            } else if (Array.isArray(response.data)) {
              this.trainings = response.data;
            } else {
              console.warn('Unexpected response structure:', response);
              this.trainings = [];
            }
           
            if (response.pagination) {
              this.totalPages = response.pagination.total_pages;
              this.currentPage = response.pagination.current_page;
            }
          } else {
            this.trainings = [];
          }
        },
        error: (error) => {
          console.error('Error loading trainings:', error);
          this.error = 'Failed to load trainings. Please try again.';
          this.trainings = [];
        }
      });
  }

  loadStats(): void {
    this.calculateLocalStats();
   
    this.trainingService.getTrainingStats(this.employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.stats = {
              ...this.stats,
              ...response.data
            };
            console.log('Stats loaded and merged:', this.stats);
          }
        },
        error: (error) => {
          console.error('Error loading stats from API:', error);
        }
      });
  }

  private calculateLocalStats(): void {
    const computedStats: Partial<TrainingStats> & { categories_breakdown?: any[] } = {
      total_trainings: this.totalTrainingsCount,
      published_trainings: this.activeTrainingsCount,
      draft_trainings: this.draftTrainingsCount,
      suspended_trainings: this.suspendedTrainingsCount,
      total_enrollments: this.totalCompletions,
      total_revenue: this.totalRevenue,
      avg_rating: this.averageRating,
      completion_rate: 0,
      categories_breakdown: this.getCategoriesBreakdown()
    };
   
    this.stats = computedStats as TrainingStats;
   
    console.log('Calculated local stats:', this.stats);
  }

  private getCategoriesBreakdown(): any[] {
    const categoriesMap = new Map<string, number>();
   
    this.trainings.forEach(t => {
      const count = categoriesMap.get(t.category) || 0;
      categoriesMap.set(t.category, count + 1);
    });
   
    return Array.from(categoriesMap.entries()).map(([category, count]) => ({
      category,
      count
    }));
  }

  loadNotifications(): void {
  this.trainingService.getEnrollmentNotifications(this.employerId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        console.log('📢 Raw enrollment notifications:', response.data?.length || 0);  // ✅ Log count
        
        if (response.success && response.data) {
          this.enrollmentNotifications = response.data.map((n: any) => ({
            ...n,
            // ✅ ENHANCED: Ensure display_name is always set (from backend or fallback)
            display_name: n.jobseeker_name || `${n.first_name || ''} ${n.last_name || ''}`.trim() || 
                          (n.email ? n.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Anonymous User')
          }));
          
          // ✅ ENHANCED: Log sample names for debug (remove in prod)
          console.log('✅ Names in notifications:', 
            this.enrollmentNotifications.map(n => ({ 
              name: n.display_name, 
              email: n.email, 
              type: n.notification_type 
            })));
          
          this.unreadNotificationCount = this.enrollmentNotifications.filter(
            (n: any) => n.notification_type === 'new'
          ).length;
        } else {
          this.enrollmentNotifications = [];
          this.unreadNotificationCount = 0;
        }
      },
      error: (error) => {
        console.error('❌ Error loading notifications:', error);
      }
    });
}

getJobseekerDisplayName(notification: any): string {
  let name = notification.display_name || notification.jobseeker_name || '';
  if (!name || name === 'Anonymous User') {
    name = notification.email ? notification.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Anonymous User';
  }
  return name.charAt(0).toUpperCase() + name.slice(1);  // Capitalize first letter
}

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new': return 'fa-user-plus';
      case 'completed': return 'fa-check-circle';
      case 'in_progress': return 'fa-spinner';
      default: return 'fa-info-circle';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'new': return 'blue';
      case 'completed': return 'green';
      case 'in_progress': return 'orange';
      default: return 'gray';
    }
  }

  // ✅ Added missing notification methods
  canIssueCertificate(notification: any): boolean {
    return notification.notification_type === 'completed' && 
           notification.progress_percentage === 100 && 
           !notification.certificate_issued;
  }

  getCertificateStatusBadge(notification: any): string {
    if (notification.certificate_issued) {
      return '✓ Certificate Issued';
    } else if (notification.progress_percentage === 100) {
      return '⚠ Ready for Certificate';
    }
    return `${notification.progress_percentage}% Complete`;
  }

// ✅ NEW: Issue certificate from notification
issueCertificateFromNotification(notification: any): void {
  if (!notification.enrollment_id) {
    alert('No enrollment ID available');
    return;
  }

  if (confirm(`Issue certificate to ${this.getJobseekerDisplayName(notification)} for "${notification.training_title}"?`)) {
    this.trainingService.issueCertificate(notification.enrollment_id, this.employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert('Certificate issued successfully! Jobseeker notified.');
            notification.certificate_issued = true;  // Update UI immediately
            this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
            this.loadNotifications();  // Refresh list
          }
        },
        error: (error) => {
          console.error('Error issuing certificate:', error);
          alert('Failed to issue certificate: ' + (error.message || 'Try again'));
        }
      });
  }
}

// ✅ NEW: Employer certificate download from notification
downloadEmployerCertificate(enrollmentId: string): void {
  if (!enrollmentId) {
    alert('No enrollment ID available');
    return;
  }
  
  console.log('📥 Employer downloading certificate:', enrollmentId);
  
  this.trainingService.downloadCertificate(enrollmentId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (blob) => {
        if (blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `employer-certificate-${enrollmentId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log('✅ Employer certificate downloaded');
        } else {
          alert('Empty file – ask employer to re-issue.');
        }
      },
      error: (error) => {
        console.error('❌ Employer download failed:', error);
        alert(`Download failed: ${error?.message || 'File not found. Re-issue if needed.'}`);
      }
    });
}

  viewStudentProfile(notification: any): void {
    console.log('Viewing student profile:', notification.user_id);
    // Navigate to student profile or show modal
    alert(`View profile for ${notification.first_name} ${notification.last_name}`);
  }

  markAllAsRead(): void {
    console.log('Marking all notifications as read');
    this.enrollmentNotifications.forEach(n => {
      // Call API to mark as read
    });
    this.unreadNotificationCount = 0;
  }

  viewAllNotifications(): void {
    console.log('Viewing all notifications');
    // Navigate to full notifications page or expand list
    alert('View all notifications feature - navigate to notifications page');
  }

  // Search and Filtering
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

  // Form Management
  toggleAddForm(): void {
    if (this.showAddForm && this.editingTrainingId) {
      if (confirm('Discard changes?')) {
        this.cancelEdit();
      }
      return;
    }
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.cancelEdit();
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
    this.editingTrainingId = null;
    this.thumbnailPreview = null;
    this.thumbnailFile = null;
    this.error = null;
  }

  // Thumbnail Handling
  onThumbnailSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.error = 'Please select a valid image file.';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.error = 'Image file must be less than 5MB.';
        return;
      }
      this.thumbnailFile = file;
     
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.thumbnailPreview = e.target.result;
      };
      reader.readAsDataURL(file);
     
      this.error = null;
    }
  }

  removeThumbnail(): void {
    this.thumbnailPreview = null;
    this.thumbnailFile = null;
    this.newTraining.thumbnail_url = '';
   
    const fileInput = document.getElementById('thumbnail') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  private uploadThumbnail(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.thumbnailFile) {
        resolve('');
        return;
      }
      const formData = new FormData();
      formData.append('thumbnail', this.thumbnailFile);
      setTimeout(() => {
        resolve(this.thumbnailPreview || '');
      }, 1000);
    });
  }

  // ============================================
  // ✅ FIXED: Video Management
  // ============================================
  
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
      duration: 0,
      order_index: this.newTraining.videos.length,
      is_preview: false,
      completed: false,
      url: ''
    };
    this.editingVideoId = null;
  }

  // ✅ FIXED: This method adds videos to the form array during training creation
  addVideo(): void {
    console.log('📹 addVideo called', {
      hasSelectedTraining: !!this.selectedTraining,
      editingTrainingId: this.editingTrainingId,
      videoTitle: this.newVideo.title
    });

    // Validate video data
    if (!this.newVideo.title || !this.newVideo.video_url) {
      alert('Please fill in video title and URL');
      return;
    }

    // ✅ CASE 1: Creating a NEW training (no selectedTraining, no editingTrainingId)
    if (!this.selectedTraining && !this.editingTrainingId) {
      console.log('📹 Adding video to NEW training form array');
      
      // Add to form array
      this.newTraining.videos.push({ 
        ...this.newVideo,
        order_index: this.newTraining.videos.length 
      });
      
      console.log('✅ Video added to form array. Total videos:', this.newTraining.videos.length);
      this.toggleVideoForm();
      return;
    }

    // ✅ CASE 2: Editing an EXISTING training
    if (this.selectedTraining) {
      console.log('📹 Adding video to EXISTING training via API');
      this.saveVideo();
      return;
    }

    // ✅ CASE 3: This shouldn't happen, but just in case
    alert('Cannot add video: Please save the training first.');
  }

  removeVideo(index: number): void {
    this.newTraining.videos.splice(index, 1);
    this.newTraining.videos.forEach((video, i) => {
      video.order_index = i;
    });
  }

  openVideoForm(training?: Training, video?: TrainingVideo): void {
    // ✅ If training is provided, we're editing an existing training
    if (training) {
      this.selectedTraining = training;
      
      if (video) {
        this.editingVideoId = video.id || null;
        this.newVideo = { ...video };
      } else {
        this.resetVideoForm();
        this.newVideo.order_index = training.videos?.length || 0;
      }
    } else {
      // ✅ If no training provided, we're in training creation mode
      this.selectedTraining = null;
      this.resetVideoForm();
      this.newVideo.order_index = this.newTraining.videos.length;
    }
   
    this.showVideoForm = true;
  }
  
  // ✅ NEW: Method to open video form during training creation
  openVideoFormForNewTraining(): void {
    this.selectedTraining = null;
    this.editingVideoId = null;
    this.resetVideoForm();
    this.newVideo.order_index = this.newTraining.videos.length;
    this.showVideoForm = true;
  }

  // ✅ FIXED: This method is only called for EXISTING trainings
  saveVideo(): void {
    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }

    // ✅ CRITICAL FIX: Validate training ID
    if (!this.selectedTraining.id || this.selectedTraining.id === 'undefined') {
      console.error('❌ Invalid training ID:', this.selectedTraining.id);
      alert('Cannot add video: Training ID is invalid. Please save the training first.');
      return;
    }

    const videoUrl = (this.newVideo.video_url && this.newVideo.video_url.trim()) || 
                     (this.newVideo.url && this.newVideo.url.trim()) || '';
    const title = this.newVideo.title ? this.newVideo.title.trim() : '';
    
    if (!title || !videoUrl) {
      alert('Please fill in all required fields (title and video URL)');
      return;
    }
    
    this.newVideo.video_url = videoUrl;

    console.log('💾 Saving video to training:', {
      trainingId: this.selectedTraining.id,
      videoTitle: title,
      isEditing: !!this.editingVideoId
    });

    if (this.editingVideoId) {
      // Update existing video
      this.trainingService.updateTrainingVideo(
        this.selectedTraining.id,
        this.editingVideoId,
        this.newVideo,
        this.employerId
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Video updated successfully');
              this.showVideoForm = false;
              this.resetVideoForm();
              this.loadTrainings();
            }
          },
          error: (error) => {
            console.error('❌ Error updating video:', error);
            alert('Failed to update video: ' + (error?.message || 'Unknown error'));
          }
        });
    } else {
      // Add new video
      this.trainingService.addVideoToTraining(
        this.selectedTraining.id,
        this.newVideo,
        this.employerId
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Video added successfully');
              this.showVideoForm = false;
              this.resetVideoForm();
              this.loadTrainings();
            }
          },
          error: (error) => {
            console.error('❌ Error adding video:', error);
            alert('Failed to add video: ' + (error?.message || 'Unknown error'));
          }
        });
    }
  }

  deleteVideo(trainingId: string, videoId: string): void {
    if (confirm('Are you sure you want to delete this video?')) {
      this.trainingService.deleteTrainingVideo(trainingId, videoId, this.employerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Video deleted successfully');
              this.loadTrainings();
            }
          },
          error: (error) => {
            alert('Failed to delete video: ' + error.message);
          }
        });
    }
  }

  // Outcome Management
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
    this.newTraining.outcomes.forEach((outcome, i) => {
      outcome.order_index = i;
    });
  }

  // ============================================
  // ✅ FIXED: Training CRUD - Now sends videos and outcomes in initial payload
  // ============================================
  
  saveTraining(): void {
    console.log('💾 saveTraining called');
    console.log('Form valid:', this.isFormValid());
    console.log('Validation errors:', this.getValidationErrors());

    if (this.isFormValid()) {
      if (this.thumbnailFile) {
        this.uploadThumbnail().then(thumbnailUrl => {
          this.performSave(thumbnailUrl);
        }).catch(error => {
          console.error('Error uploading thumbnail:', error);
          this.error = 'Failed to upload thumbnail. Please try again.';
        });
      } else {
        this.performSave(this.newTraining.thumbnail_url);
      }
    } else {
      const errors = this.getValidationErrors();
      alert('Please fix the following errors:\n' + errors.join('\n'));
    }
  }

  private performSave(thumbnailUrl: string): void {
    console.log('🚀 performSave called with thumbnail:', thumbnailUrl);
    
    // ✅ CRITICAL FIX: Include videos and outcomes in the initial payload
    const baseData: UpdateTrainingRequest = {
      title: this.newTraining.title.trim(),
      description: this.newTraining.description.trim(),
      category: this.newTraining.category,
      level: this.newTraining.level,
      duration_hours: this.newTraining.duration_hours,
      cost_type: this.newTraining.cost_type,
      price: this.newTraining.cost_type === 'Paid' ? this.newTraining.price : undefined,
      mode: this.newTraining.mode,
      provider_name: this.newTraining.provider_name.trim(),
      has_certificate: this.newTraining.has_certificate,
      thumbnail_url: thumbnailUrl || this.newTraining.thumbnail_url,
      location: this.newTraining.location || undefined,
      start_date: this.newTraining.start_date || undefined,
      end_date: this.newTraining.end_date || undefined,
      max_participants: this.newTraining.max_participants || undefined,
      
      // ✅ KEY FIX: Include videos and outcomes in the payload
      videos: this.newTraining.videos.map((v, index) => ({
        ...v,
        order_index: index,
        is_preview: v.is_preview || (index === 0) // First video is preview by default
      })),
      outcomes: this.newTraining.outcomes.map((o, index) => ({
        ...o,
        order_index: index
      }))
    };

    console.log('📦 Training payload:', {
      ...baseData,
      videoCount: baseData.videos?.length || 0,
      outcomeCount: baseData.outcomes?.length || 0
    });

    if (this.editingTrainingId) {
      console.log('🔄 Updating training:', this.editingTrainingId);
      this.trainingService.updateTraining(this.editingTrainingId, baseData, this.employerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              console.log('✅ Training updated successfully');
              this.cancelEdit();
              this.loadTrainings();
              this.loadStats();
              alert('Training updated successfully!');
            }
          },
          error: (error) => {
            console.error('❌ Error updating training:', error);
            this.error = 'Failed to update training. Please check your inputs and try again.';
          }
        });
    } else {
      console.log('➕ Creating new training');
      const trainingData: CreateTrainingRequest = { ...baseData } as CreateTrainingRequest;
      
      this.trainingService.createTraining(trainingData, this.employerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('📥 Create training response:', response);
            if (response.success) {
              console.log('✅ Training created successfully:', response.data?.id);
              this.showAddForm = false;
              this.resetForm();
              this.loadTrainings();
              this.loadStats();
              alert('Training created successfully with videos and outcomes!');
            } else {
              throw new Error(response.message || 'Failed to create training');
            }
          },
          error: (error) => {
            console.error('❌ Error creating training:', error);
            this.error = 'Failed to create training. Please check your inputs and try again.';
            alert('Failed to create training: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingTrainingId = null;
    this.resetForm();
    this.thumbnailPreview = null;
    this.thumbnailFile = null;
  }

  updateTraining(training: Training, updateData: UpdateTrainingRequest): void {
    this.trainingService.updateTraining(training.id, updateData, this.employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
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
      this.trainingService.deleteTraining(trainingId, this.employerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats();
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

  // Status Management
  publishTraining(training: Training): void {
    if (confirm('Are you sure you want to publish this training? It will become visible to jobseekers.')) {
      this.trainingService.publishTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats();
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
              this.loadStats();
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
              this.loadStats();
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

  // Training Details and Analytics
  viewTrainingDetails(training: Training): void {
    console.log('👁️ Viewing details for:', training.id);
    this.selectedTraining = training;
    this.trainingService.getTrainingDetails(training.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.detailedTraining = response.data;
          this.showDetailsModal = true;
          console.log('Detailed training loaded:', this.detailedTraining);
        } else {
          this.error = 'Failed to load training details';
        }
      },
      error: (error) => {
        console.error('Error loading details:', error);
        this.error = 'Failed to load training details';
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.detailedTraining = null;
    this.selectedTraining = null; // ✅ Also clear selectedTraining
  }

  closeVideoPlayer(): void {
    this.showVideoPlayer = false;
    this.selectedTraining = null;
  }

  viewTrainingAnalytics(training: Training): void {
    console.log('Viewing analytics for training:', training.id);
   
    this.trainingService.getTrainingAnalytics(training.id, this.employerId, '30days')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training analytics:', response.data);
          }
        },
        error: (error) => {
          console.error('Error loading analytics:', error);
          this.error = 'Failed to load training analytics.';
        }
      });
  }

  viewEnrollments(training: Training): void {
    console.log('Viewing enrollments for training:', training.id);
   
    this.trainingService.getTrainingEnrollments(training.id, this.employerId, { page: 1, limit: 10 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training enrollments:', response.data);
          }
        },
        error: (error) => {
          console.error('Error loading enrollments:', error);
          this.error = 'Failed to load training enrollments.';
        }
      });
  }

  viewReviews(training: Training): void {
    console.log('Viewing reviews for training:', training.id);
   
    this.trainingService.getTrainingReviews(training.id, { page: 1, limit: 10 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Training reviews:', response.data);
          }
        },
        error: (error) => {
          console.error('Error loading reviews:', error);
          this.error = 'Failed to load training reviews.';
        }
      });
  }

  // Certificate Management
  issueCertificate(enrollmentId: string): void {
    if (confirm('Issue certificate for this enrollment?')) {
      this.trainingService.issueCertificate(enrollmentId, this.employerId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Certificate issued successfully');
              this.loadNotifications();
            }
          },
          error: (error) => {
            alert('Failed to issue certificate: ' + error.message);
          }
        });
    }
  }

  // Form Validation
  isFormValid(): boolean {
    const basicValidation = !!(
      this.newTraining.title &&
      this.newTraining.description &&
      this.newTraining.category &&
      this.newTraining.level &&
      this.newTraining.duration_hours > 0 &&
      this.newTraining.provider_name
    );
   
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      return false;
    }
   
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      return false;
    }
   
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

  // Utility Methods
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

  // Edit Training
  editTraining(training: Training): void {
    console.log('✏️ Editing training:', training.id);
    this.editingTrainingId = training.id;
    this.newTraining = {
      title: training.title,
      description: training.description,
      category: training.category,
      level: training.level,
      duration_hours: training.duration_hours,
      cost_type: training.cost_type,
      price: training.price || 0,
      mode: training.mode,
      provider_name: training.provider_name,
      has_certificate: training.has_certificate,
      thumbnail_url: training.thumbnail_url || '',
      location: training.location || '',
      start_date: training.start_date ? this.datePipe.transform(training.start_date, 'yyyy-MM-dd') || '' : '',
      end_date: training.end_date ? this.datePipe.transform(training.end_date, 'yyyy-MM-dd') || '' : '',
      max_participants: training.max_participants || 0,
      videos: training.videos || [],
      outcomes: training.outcomes || []
    };
    if (training.thumbnail_url) {
      this.thumbnailPreview = training.thumbnail_url;
    }
    this.showAddForm = true;
    this.error = null;
  }

  // Bulk Operations
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

  // Duplication
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
      this.trainingService.createTraining(duplicatedTraining, this.employerId)
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
}