import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
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
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

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
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./training.component.css']
})
export class TrainingComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLIFrameElement>;
  
  // Make Math accessible in template
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
    
    // Auto-refresh trainings every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auto-refreshing trainings...');
        this.loadTrainings();
      });
    
    // Auto-refresh notifications every 15 seconds
    interval(15000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔔 Auto-refreshing notifications...');
        this.loadNotifications();
      });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
  }

  ngOnDestroy(): void {
    this.stopProgressTracking();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // SIDEBAR TOGGLE METHODS (Fixed)
  // ============================================
  
  toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');
    
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
    hamburger?.classList.toggle('active');
  }

  closeSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');
    
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    hamburger?.classList.remove('active');
  }

  // ============================================
  // UTILITY METHODS FOR TEMPLATE
  // ============================================
  
  formatDate(date: any): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  }

  formatNumber(num: any): string {
    if (num == null) return '0';
    return num.toLocaleString();
  }

  getMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  getFloor(num: number): number {
    return Math.floor(num);
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================
  
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
      'enrollment_confirmed': 'fa-user-check',
      'new_enrollment': 'fa-user-plus'
    };
    
    return iconMap[type] || 'fa-bell';
  }
  
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
      'enrollment_confirmed': '✅ Enrollment Confirmed',
      'new_enrollment': '👤 New Enrollment'
    };
    
    return titleMap[type] || 'Training Update';
  }
  
  handleNotificationClick(notification: any): void {
    console.log('🔔 Notification clicked:', notification);
    
    // Mark as read
    if (!notification.read) {
      this.markNotificationAsRead(notification.id);
    }
    
    switch (notification.type) {
      case 'certificate_issued':
        console.log('📜 Certificate notification metadata:', notification.metadata);
        
        let enrollmentId = null;
        
        if (notification.related_id) {
          enrollmentId = notification.related_id;
          console.log('✅ Using related_id:', enrollmentId);
        }
        else if (notification.metadata?.enrollment_id) {
          enrollmentId = notification.metadata.enrollment_id;
          console.log('✅ Using metadata.enrollment_id:', enrollmentId);
        }
        else if (notification.metadata?.certificate_id) {
          enrollmentId = notification.metadata.certificate_id;
          console.log('✅ Using metadata.certificate_id:', enrollmentId);
        }

        if (enrollmentId) {
          const trainingTitle = notification.metadata?.training_title || 'Training';
          
          if (confirm(`Download certificate for "${trainingTitle}"?`)) {
            this.downloadCertificate(enrollmentId, trainingTitle);
          }
          
          this.showNotifications = false;
        } else {
          console.error('❌ No enrollment_id found in notification:', notification);
          alert(
            'Certificate download information is missing. ' +
            'Please refresh the page or contact support.'
          );
        }
        break;
      
      case 'enrollment_confirmed':
      case 'new_training':
      case 'training_updated':
      case 'video_added':
      case 'content_updated':
        if (notification.metadata?.training_id) {
          this.viewTrainingFromNotification(notification.metadata.training_id);
        }
        break;
      
      case 'training_deleted':
      case 'training_suspended':
        alert(notification.message);
        this.showNotifications = false;
        this.loadTrainings();
        break;
      
      default:
        console.log('ℹ️ No specific action for notification type:', notification.type);
        this.showNotifications = false;
        break;
    }
  }
  
  viewTrainingFromNotification(trainingId: string): void {
    console.log('👀 Viewing training from notification:', trainingId);
    
    const training = this.trainings.find(t => t.id === trainingId);
    
    if (training) {
      this.viewTrainingDetail(training);
      this.showNotifications = false;
    } else {
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
  
  viewAllNotifications(): void {
    console.log('📋 Viewing all notifications');
   
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
  
  markNotificationAsRead(notificationId: string): void {
    console.log('✅ Marking notification as read:', notificationId);
    
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
    }
    
    this.trainingService.markNotificationRead(notificationId, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ Notification marked as read on server');
        },
        error: (error) => {
          console.error('❌ Error marking notification as read:', error);
          if (notification) {
            notification.read = false;
            this.unreadNotificationCount++;
          }
        }
      });
  }
  
  loadNotifications(): void {
    console.log('🔔 Loading notifications for jobseeker:', this.userId);
    
    this.trainingService.getNotifications(this.userId, { read: false }, 'jobseeker')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.notifications = response.data.notifications || [];
            this.unreadNotificationCount = this.notifications.filter(n => !n.read).length;
            
            console.log('✅ Jobseeker notifications loaded:', {
              total: this.notifications.length,
              unread: this.unreadNotificationCount,
              types: [...new Set(this.notifications.map(n => n.type))]
            });
            
            this.checkForNewNotifications();
          } else {
            console.warn('⚠️ No notifications in response');
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
  
  private checkForNewNotifications(): void {
    const newNotifications = this.notifications.filter(n => {
      const notificationDate = new Date(n.created_at);
      return notificationDate > this.lastNotificationCheck && !n.read;
    });

    if (newNotifications.length > 0) {
      console.log('🔔 New notifications detected:', newNotifications.length);

      const importantTypes = [
        'certificate_issued',
        'enrollment_confirmed',
        'training_deleted',
        'training_suspended',
        'video_added'
      ];

      const importantNotifications = newNotifications.filter(n =>
        importantTypes.includes(n.type)
      );

      if (importantNotifications.length > 0 &&
          'Notification' in window &&
          Notification.permission === 'granted') {
        importantNotifications.forEach(n => {
          new Notification(n.title || this.getNotificationTitle(n.type), {
            body: n.message,
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            tag: n.id
          });
        });
      }
    }

    this.lastNotificationCheck = new Date();
  }
  
  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    
    if (this.showNotifications) {
      this.lastNotificationCheck = new Date();
      console.log('👀 Notifications panel opened');
    }
  }
  
  clearReadNotifications(): void {
    const readNotifications = this.notifications.filter(n => n.read);
    
    if (readNotifications.length === 0) {
      alert('No read notifications to clear');
      return;
    }
    
    if (confirm(`Clear ${readNotifications.length} read notifications?`)) {
      console.log('🗑️ Clearing read notifications:', readNotifications.length);
      this.notifications = this.notifications.filter(n => !n.read);
      alert(`Cleared ${readNotifications.length} read notifications`);
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

    if (!this.isVideoAccessible(video)) {
      alert('This video is not available in preview. Please enroll in the training to access all videos.');
      return;
    }

    if (this.currentVideo) {
      this.saveVideoProgress(false);
    }

    this.currentVideo = video;
    this.currentVideoIndex = index;
    this.videoWatchTime = 0;
    this.videoStartTime = Date.now();
    
    const embedUrl = this.trainingService.getVideoEmbedUrl(video.video_url);
    console.log('📺 Embed URL:', embedUrl);
    
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    this.showVideoPlayer = true;
    
    this.startProgressTracking();
  }

  closeVideoPlayer(): void {
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
  // PROGRESS TRACKING
  // ============================================
  
  startProgressTracking(): void {
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
    
    if (elapsed - this.lastProgressUpdate >= 30) {
      this.saveVideoProgress(false);
      this.lastProgressUpdate = elapsed;
    }
  }

  markVideoComplete(): void {
    if (!this.currentVideo) return;
    
    this.saveVideoProgress(true);
    alert('Video marked as complete!');
    
    if (this.currentVideoIndex < (this.selectedTraining?.videos?.length || 0) - 1) {
      setTimeout(() => {
        this.playNextVideo();
      }, 1000);
    } else {
      alert('🎉 Congratulations! You have completed all videos in this training!');
    }
  }

  saveVideoProgress(isCompleted: boolean): void {
    if (!this.selectedTraining || !this.currentVideo) {
      console.warn('⚠️ Cannot save progress: missing training or video');
      return;
    }

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
            if (this.selectedTraining) {
              this.selectedTraining.progress = response.data.overall_progress || 0;

              const trainingInList = this.trainings.find(t => t.id === this.selectedTraining!.id);
              if (trainingInList) {
                trainingInList.progress = response.data.overall_progress || 0;
              }

              console.log('📊 Updated progress:', {
                overall: response.data.overall_progress,
                completed: response.data.training_completed
              });
            }

            if (isCompleted && this.currentVideo) {
              this.currentVideo.completed = true;
              
              if (this.selectedTraining?.videos) {
                const videoInList = this.selectedTraining.videos.find(v => v.id === this.currentVideo!.id);
                if (videoInList) {
                  videoInList.completed = true;
                }
              }
              console.log('✓ Video marked as completed in UI');
            }

            if (response.data.training_completed) {
              setTimeout(() => {
                alert('🎉 Congratulations! You completed the training!');

                if (response.data.certificate_issued) {
                  alert('🎓 Your certificate is ready for download!');
                  this.loadNotifications();

                  if (this.selectedTraining) {
                    this.viewTrainingDetail(this.selectedTraining);
                  }
                }
              }, 500);
            } else if (isCompleted) {
              console.log('✓ Video completion saved');
            }
          }
        },
        error: (error) => {
          console.error('❌ Error saving progress:', error);
          
          let errorMessage = 'Failed to save progress.';
          
          if (error.status === 404) {
            errorMessage += ' Training or video not found.';
          } else if (error.status === 401) {
            errorMessage += ' Please log in again.';
          } else if (error.status === 403) {
            errorMessage += ' You must be enrolled to save progress.';
          } else if (error.error?.message) {
            errorMessage += ` ${error.error.message}`;
          }

          errorMessage += ' Progress will resume from here next time.';
          alert(errorMessage);
        }
      });
  }

  // ============================================
  // CERTIFICATE DOWNLOAD
  // ============================================
  
  downloadCertificate(enrollmentId: string, trainingTitle: string): void {
    console.log('📥 Downloading certificate:', { enrollmentId, trainingTitle });
    
    if (!enrollmentId) {
      console.error('❌ No enrollment ID provided');
      alert('Cannot download certificate: Enrollment ID is missing');
      return;
    }

    this.loading = true;
    
    this.trainingService.downloadCertificate(enrollmentId).subscribe({
      next: (blob: Blob) => {
        this.loading = false;
        
        if (blob.size > 0) {
          console.log('✅ Certificate downloaded:', blob.size, 'bytes');
          
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${trainingTitle.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          alert(`Certificate for "${trainingTitle}" downloaded successfully!`);
        } else {
          console.error('❌ Empty file received');
          alert('Certificate file is empty. Please contact the training provider.');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Error downloading certificate:', error);
        
        let errorMessage = 'Failed to download certificate. ';
        
        if (error.status === 404) {
          errorMessage += 'Certificate file not found on server.';
        } else if (error.status === 401) {
          errorMessage += 'You are not authorized. Please log in again.';
        } else if (error.status === 403) {
          errorMessage += 'Access denied. This certificate may not belong to you.';
        } else {
          errorMessage += 'Please try again or contact support.';
        }
        
        alert(errorMessage);
      }
    });
  }

  downloadCertificateFromList(training: Training): void {
    console.log('📥 List download - enrollment_id:', training.enrollment_id);
    
    if (!training.enrollment_id) {
      console.error('❌ No enrollment_id in training object');
      alert('Certificate information missing. Please refresh the page.');
      this.loadTrainings(this.currentPage);
      return;
    }
    
    this.downloadCertificate(training.enrollment_id, training.title);
  }

  handleCertificateDownloadClick(training: Training): void {
    console.log('🖱️ Download button clicked:', {
      id: training?.id,
      title: training?.title,
      enrolled: training?.enrolled,
      progress: training?.progress,
      certificateIssued: training?.certificate_issued,
      enrollmentId: training?.enrollment_id
    });

    if (this.canDownloadCertificate(training)) {
      this.downloadCertificate(training.enrollment_id!, training.title || 'Training');
      return;
    }

    if (!training.enrollment_id && training.certificate_issued) {
      console.warn('⚠️ enrollment_id missing but certificate issued, refreshing...');
      this.refreshTrainingDetails();
      return;
    }

    const statusMsg = this.getCertificateStatusMessage(training);
    console.log('ℹ️ Cannot download:', statusMsg);
    alert(statusMsg);
  }

  canDownloadCertificate(training: Training): boolean {
    const canDownload = !!(
      training.enrolled && 
      training.progress === 100 && 
      training.certificate_issued &&
      training.enrollment_id
    );
    
    console.log('🔍 Can download check:', {
      trainingId: training.id,
      enrolled: training.enrolled,
      progress: training.progress,
      certificateIssued: training.certificate_issued,
      hasEnrollmentId: !!training.enrollment_id,
      result: canDownload
    });
    
    return canDownload;
  }

  refreshTrainingDetails(): void {
    if (!this.selectedTraining?.id) {
      console.warn('⚠️ No selected training to refresh');
      return;
    }
    
    this.loading = true;
    
    this.trainingService.getTrainingWithDetailsForJobseeker(this.selectedTraining.id, this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success && response.data) {
            this.selectedTraining = response.data;
            console.log('✅ Refreshed enrollment_id:', this.selectedTraining.enrollment_id);
            
            if (this.selectedTraining.certificate_issued) {
              alert('Certificate is ready! Click download again.');
            }
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('❌ Error refreshing training:', error);
          alert('Failed to refresh training details. Please reload the page.');
        }
      });
  }

  getCertificateStatusMessage(training: Training): string {
    if (!training.enrolled) {
      return 'Please enroll in this training to earn a certificate';
    }
    
    const progress = training.progress ?? 0;
    
    if (progress < 100) {
      return `Complete all videos (${progress}% done) to earn your certificate`;
    }
    
    if (progress === 100 && !training.certificate_issued) {
      return 'Training completed! Certificate is being generated...';
    }
    
    if (training.certificate_issued && training.enrollment_id) {
      return 'Certificate is ready for download!';
    }
    
    return 'Certificate status unknown. Please refresh the page.';
  }

  checkAndDownloadCertificate(enrollmentId: string, trainingTitle: string): void {
    console.log('🔍 Checking certificate availability...');
    
    this.loading = true;
    
    this.trainingService.checkCertificateAvailability(enrollmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          
          if (response.success && response.data?.available) {
            console.log('✅ Certificate is available');
            this.downloadCertificate(enrollmentId, trainingTitle);
          } else {
            const reason = response.data?.reason || 'Certificate is not yet available';
            console.warn('⚠️ Certificate not available:', reason);
            alert(`Certificate not available: ${reason}`);
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('❌ Error checking certificate:', error);
          
          console.log('Attempting download anyway...');
          this.downloadCertificate(enrollmentId, trainingTitle);
        }
      });
  }

  previewCertificate(enrollmentId: string): void {
    console.log('👁️ Previewing certificate:', enrollmentId);
    
    if (!enrollmentId) {
      alert('Cannot preview: Enrollment information missing');
      return;
    }
    
    this.trainingService.openCertificateInNewTab(enrollmentId);
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
      console.warn('❌ Not published:', training.title);
      return false;
    }
    if (!training.provider_id) {
      console.warn('❌ Invalid provider_id:', training.title);
      return false;
    }
    if (training.duration_hours <= 0) {
      console.warn('❌ Invalid duration:', training.title);
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
            
            console.log('✅ Loaded trainings:', this.trainings.length);
            
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
          this.trainings = [];
          this.filteredTrainings = [];
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
            console.log('✅ Categories loaded:', this.categories.length);
          }
        },
        error: (error) => {
          console.error('❌ Error loading categories:', error);
          this.categories = ['Data Science', 'Frontend Development', 'Marketing', 'Cloud Computing', 'Design'];
        }
      });
  }

  viewTrainingDetail(training: Training): void {
    this.loading = true;
    this.showVideoLoading = true;
    this.error = null;
    
    console.log('🔍 Fetching full details for training:', training.id);
    
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
                certificateIssued: this.selectedTraining.certificate_issued,
                enrollmentId: this.selectedTraining.enrollment_id
              });
              this.showTrainingDetail = true;
            } else {
              console.error('❌ Training validation failed');
              this.error = 'This training is no longer available.';
            }
          } else {
            this.error = 'Failed to load training details.';
          }
          this.loading = false;
          this.showVideoLoading = false;
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

  // ============================================
  // WISHLIST MANAGEMENT
  // ============================================
  
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

  // ============================================
  // FILTER METHODS
  // ============================================
  
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

  // ============================================
  // UTILITY METHODS
  // ============================================
  
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

  isEnrolled(training: Training): boolean {
    return training.enrolled || false;
  }

  getTrainingProgress(training: Training): number {
    return training.progress || 0;
  }

  getVideosRemaining(training: any): number {
    if (!training || !training.videos) return 0;
    
    const totalVideos = training.videos.length;
    const completedVideos = training.videos.filter((v: any) => v.completed).length;
    
    return totalVideos - completedVideos;
  }

  // ============================================
  // PAGINATION
  // ============================================
  
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

  getPaginationPages(): (number | string)[] {
    const pages: (number | string)[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  refreshTrainings(): void {
    this.loadTrainings(this.currentPage);
  }

  getVideoEmbedUrl(videoUrl: string): string {
    return this.trainingService.getVideoEmbedUrl(videoUrl);
  }
}