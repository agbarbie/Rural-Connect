import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, interval, takeUntil } from 'rxjs';
import {
  TrainingService,
  Training,
  TrainingVideo,
  TrainingSearchParams,
  PaginatedResponse
} from '../../../../../services/training.service';
import { AuthService } from '../../../../../services/auth.service';

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
  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLIFrameElement>;
  
  Math = Math;
  
  private destroy$ = new Subject<void>();
  private progressInterval: any;
  private videoStartTime: number = 0;
  private lastNotificationCheck: Date = new Date();
  
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
  
  // Video player state
  showVideoPlayer: boolean = false;
  currentVideo: TrainingVideo | null = null;
  currentVideoIndex: number = -1;
  safeVideoUrl: SafeResourceUrl | null = null;
  
  // Progress tracking
  videoWatchTime: number = 0;
  lastProgressUpdate: number = 0;
  
  // Notifications
  notifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  totalPages: number = 1;
  pageSize: number = 12;
  totalCount: number = 0;
  
  // Wishlist management
  private wishlistSet: Set<string> = new Set();
  
  // User ID
  userId: string = '';
  
  constructor(
    private trainingService: TrainingService,
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get user ID
    this.userId = this.authService.getUserId() || '';
    
    if (!this.userId) {
      console.error('No user ID found');
      alert('Please log in to view trainings');
      return;
    }

    console.log('✅ Jobseeker ID:', this.userId);
    
    this.loadTrainings();
    this.loadCategories();
    this.loadNotifications();
    
    // ✅ NEW: Auto-refresh trainings every 30 seconds to get updates
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auto-refreshing trainings...');
        this.loadTrainings();
      });
    
    // Refresh notifications every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
 
    // Request desktop notification permission on init
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  ngOnDestroy(): void {
    this.stopProgressTracking();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================
  
  /**
   * Get notification icon based on type
   */
  getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'certificate_issued': 'fa-certificate',
      'new_training': 'fa-plus-circle',
      'training_updated': 'fa-edit',
      'training_deleted': 'fa-trash-alt',
      'training_suspended': 'fa-pause-circle',
      'training_published': 'fa-rocket',
      'video_added': 'fa-video',
      'content_updated': 'fa-sync-alt',
      'training_completed': 'fa-check-circle',
      'enrollment_confirmed': 'fa-user-check'
    };
   
    return iconMap[type] || 'fa-bell';
  }
  
  /**
   * Get notification icon CSS class for styling
   */
  getNotificationIconClass(type: string): string {
    const classMap: Record<string, string> = {
      'certificate_issued': 'certificate',
      'new_training': 'new-training',
      'training_updated': 'training-updated',
      'training_deleted': 'training-deleted',
      'training_suspended': 'training-suspended',
      'training_published': 'new-training',
      'video_added': 'video-added',
      'content_updated': 'training-updated',
      'training_completed': 'certificate',
      'enrollment_confirmed': 'new-training'
    };
   
    return classMap[type] || 'default';
  }
  
  /**
   * Get notification title (fallback if title not in database)
   */
  getNotificationTitle(type: string): string {
    const titleMap: Record<string, string> = {
      'certificate_issued': '🎓 Certificate Ready',
      'new_training': '🎓 New Training Available',
      'training_updated': '✏️ Training Updated',
      'training_deleted': '🗑️ Training Removed',
      'training_suspended': '⏸️ Training Suspended',
      'training_published': '📢 Training Published',
      'video_added': '📹 New Video Added',
      'content_updated': '📝 Content Updated',
      'training_completed': '🎉 Training Completed',
      'enrollment_confirmed': '✅ Enrollment Confirmed'
    };
   
    return titleMap[type] || 'Training Update';
  }
  
  /**
   * Handle notification click - perform appropriate action
   */
  handleNotificationClick(notification: any): void {
    console.log('📌 Notification clicked:', notification);
   
    // Mark as read if not already read
    if (!notification.read) {
      this.markNotificationAsRead(notification.id);
    }
   
    // Perform action based on notification type
    switch (notification.type) {
      case 'enrollment_confirmed':
      case 'new_training':
      case 'training_updated':
      case 'video_added':
      case 'content_updated':
        if (notification.metadata?.training_id) {
          this.viewTrainingFromNotification(notification.metadata.training_id);
        }
        break;
       
      case 'certificate_issued':
        if (notification.metadata?.enrollment_id) {
          this.downloadCertificate(
            notification.metadata.enrollment_id,
            notification.metadata?.training_title || 'Training'
          );
        }
        break;
       
      case 'training_deleted':
      case 'training_suspended':
        // Show alert for deleted/suspended trainings
        alert(notification.message);
        this.showNotifications = false;
        break;
       
      default:
        console.log('No specific action for notification type:', notification.type);
    }
  }
  
  /**
   * View training from notification
   */
  viewTrainingFromNotification(trainingId: string): void {
    console.log('👀 Viewing training from notification:', trainingId);
   
    // Find training in current list
    const training = this.trainings.find(t => t.id === trainingId);
   
    if (training) {
      this.viewTrainingDetail(training);
      this.showNotifications = false;
    } else {
      // Training not in current list - fetch it
      this.trainingService.getTrainingWithDetailsForJobseeker(trainingId, this.userId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (response) => {
                  if (response && response.success && response.data) {
                    this.viewTrainingDetail(response.data);
                    this.showNotifications = false;
                  } else {
                    alert('Training not found or no longer available');
                  }
                },
                error: (error) => {
                  console.error('❌ Error loading training:', error);
                  alert('Unable to load training. It may have been removed.');
                }
              });
    }
  }
  
  /**
   * View all notifications (navigate to dedicated notifications page if available)
   */
  viewAllNotifications(): void {
    console.log('📋 Viewing all notifications');
   
    // For now, just load more notifications
    this.trainingService.getNotifications(this.userId, { read: undefined })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.notifications = response.data.notifications || [];
            console.log('✅ All notifications loaded:', this.notifications.length);
          }
        },
        error: (error) => {
          console.error('❌ Error loading all notifications:', error);
        }
      });
  }
  
  /**
   * Enhanced mark notification as read with UI feedback
   */
  markNotificationAsRead(notificationId: string): void {
    console.log('✅ Marking notification as read:', notificationId);
   
    // Optimistic update - mark as read immediately in UI
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
    }
   
    // Send to backend
    this.trainingService.markNotificationRead(notificationId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ Notification marked as read on server');
        },
        error: (error) => {
          console.error('❌ Error marking notification as read:', error);
          // Revert optimistic update on error
          if (notification) {
            notification.read = false;
            this.unreadNotificationCount++;
          }
        }
      });
  }
  
  /**
   * Enhanced load notifications with filtering
   */
loadNotifications(): void {
  console.log('🔔 Loading notifications for jobseeker:', this.userId);
  this.trainingService.getNotifications(this.userId, { read: false }, 'jobseeker')  // FIXED: Boolean false
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        console.log('📦 Raw notification response:', response);
        if (response.success && response.data) {
          this.notifications = response.data.notifications || [];
          // FIXED: Count only unread
          this.unreadNotificationCount = this.notifications.filter(n => !n.read).length;
          console.log('✅ Jobseeker notifications loaded:', {
            total: this.notifications.length,
            unread: this.unreadNotificationCount,
            types: this.notifications.map(n => n.type)
          });
          // FIXED: Check for new ones
          this.checkForNewNotifications();
        } else {
          this.notifications = [];
          this.unreadNotificationCount = 0;
        }
      },
      error: (error) => {
        console.error('❌ Error loading notifications:', error);
        this.notifications = [];
        this.unreadNotificationCount = 0;
      }
    });
}
  
  /**
   * Check for new notifications and show desktop notification if enabled
   */
private checkForNewNotifications(): void {
  const newNotifications = this.notifications.filter(n => {
    const notificationDate = new Date(n.created_at);
    return notificationDate > this.lastNotificationCheck;
  });
  if (newNotifications.length > 0) {
    console.log('🔔 New notifications detected:', newNotifications.length);
    const importantTypes = ['certificate_issued', 'enrollment_confirmed', 'training_deleted', 'training_suspended'];  // FIXED: Add enroll
    const importantNotifications = newNotifications.filter(n => importantTypes.includes(n.type));
    if (importantNotifications.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      importantNotifications.forEach(n => {
        new Notification(n.title || this.getNotificationTitle(n.type), {
          body: n.message,
          icon: '/assets/logo.png'
        });
      });
    }
  }
  this.lastNotificationCheck = new Date();
}
  
  /**
   * Toggle notifications dropdown with animation
   */
  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
   
    // Update last check time when opening notifications
    if (this.showNotifications) {
      this.lastNotificationCheck = new Date();
    }
  }
  
  /**
   * Clear all read notifications
   */
  clearReadNotifications(): void {
    if (confirm('Clear all read notifications?')) {
      // Filter out read notifications
      const readIds = this.notifications
        .filter(n => n.read)
        .map(n => n.id);
     
      if (readIds.length === 0) {
        alert('No read notifications to clear');
        return;
      }
     
      // In a real implementation, you'd call a backend API to bulk delete
      console.log('🗑️ Clearing read notifications:', readIds.length);
     
      // Optimistic update
      this.notifications = this.notifications.filter(n => !n.read);
     
      alert(`Cleared ${readIds.length} read notifications`);
    }
  }

  // ============================================
  // VIDEO PLAYER METHODS
  // ============================================
  
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

    // Save progress of previous video
    if (this.currentVideo) {
      this.saveVideoProgress(false);
    }

    this.currentVideo = video;
    this.currentVideoIndex = index;
    this.videoWatchTime = 0;
    this.videoStartTime = Date.now();
    
    // Get embed URL and sanitize it
    const embedUrl = this.trainingService.getVideoEmbedUrl(video.video_url);
    console.log('📺 Embed URL:', embedUrl);
    
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    this.showVideoPlayer = true;
    
    // Start progress tracking
    this.startProgressTracking();
  }

  closeVideoPlayer(): void {
    // Save progress before closing
    if (this.currentVideo) {
      this.saveVideoProgress(false);
    }
    
    this.stopProgressTracking();
    this.showVideoPlayer = false;
    this.currentVideo = null;
    this.currentVideoIndex = -1;
    this.safeVideoUrl = null;
    this.videoWatchTime = 0;
  }

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

  playPreviousVideo(): void {
    if (!this.selectedTraining?.videos) return;
    
    const prevIndex = this.currentVideoIndex - 1;
    if (prevIndex >= 0) {
      const prevVideo = this.selectedTraining.videos[prevIndex];
      this.playVideo(prevVideo, prevIndex);
    }
  }

  isVideoAccessible(video: TrainingVideo): boolean {
    if (!this.selectedTraining) return false;
    return this.trainingService.isVideoAccessible(video, this.selectedTraining);
  }

  getVideoStatusBadge(video: TrainingVideo): string {
    if (video.completed) return '✓ Completed';
    if (video.is_preview) return '🔓 Preview';
    if (!this.selectedTraining?.enrolled) return '🔒 Locked';
    return '';
  }

  // ============================================
  // ✅ ENHANCED PROGRESS TRACKING
  // ============================================
  
  startProgressTracking(): void {
    // Update progress every 10 seconds
    this.progressInterval = setInterval(() => {
      this.updateWatchTime();
    }, 10000);
  }

  stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateWatchTime(): void {
    if (!this.currentVideo) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - this.videoStartTime) / 1000);
    this.videoWatchTime = elapsed;
    
    // Save progress every 30 seconds
    if (elapsed - this.lastProgressUpdate >= 30) {
      this.saveVideoProgress(false);
      this.lastProgressUpdate = elapsed;
    }
  }

  markVideoComplete(): void {
    if (!this.currentVideo) return;
    
    this.saveVideoProgress(true);
    
    // Show completion message
    alert('Video marked as complete!');
    
    // Move to next video
    if (this.currentVideoIndex < (this.selectedTraining?.videos?.length || 0) - 1) {
      setTimeout(() => {
        this.playNextVideo();
      }, 1000);
    } else {
      // Last video completed
      alert('🎉 Congratulations! You have completed all videos in this training!');
    }
  }

  // In training.component.ts (Jobseeker) - Replace the saveVideoProgress method

  saveVideoProgress(isCompleted: boolean): void {
    if (!this.selectedTraining || !this.currentVideo) {
      console.warn('⚠️ Cannot save progress: missing training or video');
      return;
    }

    // Ensure we have the necessary IDs
    if (!this.currentVideo.id) {
      console.error('❌ Video ID is missing');
      alert('Cannot save progress: Video ID is missing');
      return;
    }

    console.log('💾 Saving video progress:', {
      trainingId: this.selectedTraining.id,
      trainingTitle: this.selectedTraining.title,
      videoId: this.currentVideo.id,
      videoTitle: this.currentVideo.title,
      watchTime: this.videoWatchTime,
      completed: isCompleted,
      userId: this.userId
    });

    this.trainingService.updateVideoProgress(
      this.selectedTraining.id,
      this.currentVideo.id,
      this.videoWatchTime,
      isCompleted,
      this.userId
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Progress saved successfully:', response);

          if (response.success && response.data) {
            // Update training progress in real-time
            if (this.selectedTraining) {
              this.selectedTraining.progress = response.data.overall_progress || 0;

              // Update in trainings list too
              const trainingInList = this.trainings.find(t => t.id === this.selectedTraining!.id);
              if (trainingInList) {
                trainingInList.progress = response.data.overall_progress || 0;
              }

              console.log('📊 Updated progress:', {
                overall: response.data.overall_progress,
                completed: response.data.training_completed
              });
            }

            // Mark video as completed in the list FIRST
            if (isCompleted && this.currentVideo) {
              this.currentVideo.completed = true;
              
              // Update the video in the selected training's videos array
              if (this.selectedTraining?.videos) {
                const videoInList = this.selectedTraining.videos.find(v => v.id === this.currentVideo!.id);
                if (videoInList) {
                  videoInList.completed = true;
                }
              }
              console.log('✓ Video marked as completed in UI');
            }

            // Check if training completed
            if (response.data.training_completed) {
              setTimeout(() => {
                alert('🎉 Congratulations! You completed the training!');

                // Check for certificate
                if (response.data.certificate_issued) {
                  alert('🎓 Your certificate is ready for download!');
                  this.loadNotifications(); // Refresh to show certificate notification

                  // Reload training details to show certificate button
                  if (this.selectedTraining) {
                    this.viewTrainingDetail(this.selectedTraining);
                  }
                }
              }, 500);
            } else if (isCompleted) {
              // Only show subtle feedback for individual video completion
              console.log('✓ Video completion saved');
            }
          }
        },
        error: (error) => {
          console.error('❌ Error saving progress:', error);
          console.error('Error details:', {
            status: error.status,
            message: error.message,
            error: error.error
          });

          // ✅ FIX: Check if it's actually a successful save with notification error
          if (error.status === 500 && error.error?.message?.includes('notifications')) {
            console.warn('⚠️ Progress saved but notification failed (backend DB issue)');
            
            // Still update UI since progress WAS saved
            if (isCompleted && this.currentVideo) {
              this.currentVideo.completed = true;
              
              if (this.selectedTraining?.videos) {
                const videoInList = this.selectedTraining.videos.find(v => v.id === this.currentVideo!.id);
                if (videoInList) {
                  videoInList.completed = true;
                }
              }
            }
            
            // Don't show error alert - progress was actually saved
            console.log('✓ Video progress saved (notification system needs DB fix)');
            return; // Exit without showing error
          }

          // Only show error for actual failures
          let errorMessage = 'Failed to save progress.';
          
          if (error.status === 404) {
            errorMessage += ' Training or video not found.';
          } else if (error.status === 401) {
            errorMessage += ' Please log in again.';
          } else if (error.status === 403) {
            errorMessage += ' You must be enrolled to save progress.';
          } else if (error.error?.message && !error.error.message.includes('notifications')) {
            errorMessage += ` ${error.error.message}`;
          }

          errorMessage += ' It will resume from here next time.';
          alert(errorMessage);
        }
      });
  }

  // ============================================
  // ✅ CERTIFICATE DOWNLOAD
  // ============================================
  
  downloadCertificate(enrollmentId: string, trainingTitle: string): void {
    console.log('📥 Downloading certificate for enrollment:', enrollmentId);
    
    this.trainingService.triggerCertificateDownload(enrollmentId, trainingTitle);
  }

  canDownloadCertificate(training: Training): boolean {
    return !!(training.enrolled && training.progress === 100 && training.certificate_issued);
  }

  // ============================================
  // DATA LOADING
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

  viewTrainingDetail(training: Training): void {
    this.loading = true;
    this.showVideoLoading = true;
    this.error = null;
    
    console.log('🔍 Fetching full details for training:', training.id);
    
    // ✅ Use jobseeker-specific endpoint with user ID
    this.trainingService.getTrainingWithDetailsForJobseeker(training.id, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📦 Training details response:', response);
          if (response.success && response.data) {
            if (this.isValidTraining(response.data)) {
              this.selectedTraining = response.data;
              console.log('✅ Training loaded:', {
                title: this.selectedTraining.title,
                videos: this.selectedTraining.videos?.length || 0,
                progress: this.selectedTraining.progress,
                enrolled: this.selectedTraining.enrolled,
                certificateIssued: this.selectedTraining.certificate_issued
              });
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
    this.closeVideoPlayer();
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
            
            // Reload training details to get full video list
            this.viewTrainingDetail(training);
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
    this.viewTrainingDetail(training);
  }

  // Wishlist management
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

  // Filter methods
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

  // Utility methods
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

  formatDurationMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  formatPrice(training: Training): string {
    return this.trainingService.formatPrice(training.price, training.cost_type);
  }

  // Pagination
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