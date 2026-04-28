// jobseeker-training.component.ts - WITH CLIPBOARD FUNCTIONALITY
import { Component, OnInit, OnDestroy, Inject, forwardRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  TrainingService,
  Training,
  TrainingSession,
  TrainingSearchParams
} from '../../../../../services/training.service';
import { AuthService } from '../../../../../services/auth.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

interface FilterOptions {
  level: string[];
  cost: string[];
  mode: string[];
  category: string[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./training.component.css'],
  providers: [DatePipe]
})
export class TrainingComponent implements OnInit, OnDestroy {
  Math = Math;
  
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();
  private lastNotificationCheck: Date = new Date();
  
  // Training data
  trainings: Training[] = [];
  filteredTrainings: Training[] = [];
  selectedCategory: string = 'all';
  searchQuery: string = '';
  
  // Filters
  filters: FilterOptions = {
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
  
  // Application modal
  showApplicationModal: boolean = false;
  motivationLetter: string = '';
  applyingTrainingId: string | null = null;
  
  // Enrolled trainings view
  showEnrolledOnly: boolean = false;
  enrolledTrainings: Training[] = [];
  
  // Notifications
  notifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  totalPages: number = 1;
  pageSize: number = 12;
  totalCount: number = 0;
  
  // User ID
  userId: string = '';
  
  // Cache management
  private lastDataFetch: Date = new Date(0);
  private lastNotificationFetch: Date = new Date(0);
  private readonly CACHE_DURATION_MS = 120000;
  private readonly NOTIFICATION_CACHE_MS = 60000;

  constructor(
    @Inject(forwardRef(() => TrainingService)) private trainingService: TrainingService,
    private authService: AuthService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserId() || '';
    
    if (!this.userId) {
      console.error('❌ No user ID found');
      alert('Please log in to view trainings');
      return;
    }

    console.log('✅ Jobseeker ID:', this.userId);
    
    this.searchSubject$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      if (this.showEnrolledOnly) {
        this.loadEnrolledTrainings();
      } else {
        this.loadTrainings(1);
      }
    });
    
    this.loadTrainings();
    this.loadCategories();
    this.loadNotifications();
    
    interval(300000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const now = new Date();
        
        if (now.getTime() - this.lastDataFetch.getTime() > this.CACHE_DURATION_MS) {
          console.log('🔄 Auto-refreshing trainings (cache expired)...');
          if (this.showEnrolledOnly) {
            this.loadEnrolledTrainings();
          } else {
            this.loadTrainings();
          }
        }
        
        if (now.getTime() - this.lastNotificationFetch.getTime() > this.NOTIFICATION_CACHE_MS) {
          console.log('🔔 Auto-refreshing notifications (cache expired)...');
          this.loadNotifications();
        }
      });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // CLIPBOARD FUNCTIONALITY - NEW
  // ============================================
  
  /**
   * Copy text to clipboard with visual feedback
   */
  copyToClipboard(text: string, successMessage: string = 'Copied!'): void {
  if (!text) {
    console.warn('⚠️ No text to copy');
    return;
  }

  // Use modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      this.showCopySuccess(successMessage);
    }).catch(err => {
      console.error('❌ Failed to copy:', err);
      this.fallbackCopyToClipboard(text, successMessage);
    });
  } else {
    // Fallback for older browsers or non-HTTPS
    this.fallbackCopyToClipboard(text, successMessage);
  }
}

private fallbackCopyToClipboard(text: string, successMessage: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    this.showCopySuccess(successMessage);
  } catch (err) {
    console.error('❌ Fallback copy failed:', err);
    alert('Failed to copy. Please copy manually.');
  }
  
  document.body.removeChild(textArea);
}

private showCopySuccess(message: string): void {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'copy-success-toast';
  notification.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

  /**
   * Show temporary success notification for clipboard operations
   */
  private showCopyNotification(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'copy-success-notification';
    notification.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // ============================================
  // SIDEBAR TOGGLE METHODS
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
      return this.datePipe.transform(date, 'medium') || 'N/A';
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
  // ✅ ADD THIS METHOD to jobseeker-training.component.ts
getMeetingRoute(meetingUrl: string): string[] {
  if (!meetingUrl) return ['/'];
  
  try {
    const url = new URL(meetingUrl);
    const pathParts = url.pathname.split('/').filter(p => p);
    return ['/', ...pathParts];
  } catch (error) {
    console.error('❌ Invalid meeting URL:', meetingUrl);
    return ['/'];
  }
}

// ✅ ALTERNATIVE: If you prefer direct URL navigation
openMeetingInNewTab(meetingUrl: string): void {
  if (!meetingUrl) {
    alert('Meeting link not available');
    return;
  }
  
  window.open(meetingUrl, '_blank', 'noopener,noreferrer');
}

// ✅ ADD THIS METHOD
joinMeeting(sessionId: string): void {
  if (!sessionId) {
    alert('Invalid session ID');
    return;
  }

  this.loading = true;

  this.trainingService.joinSession(sessionId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        this.loading = false;
        
        if (response.success && response.data?.joinUrl) {
          // Open BBB meeting in new tab
          window.open(response.data.joinUrl, '_blank', 'noopener,noreferrer');
        } else {
          alert('Failed to join meeting. Please try again.');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Error joining meeting:', error);
        
        let errorMessage = 'Failed to join meeting. ';
        
        if (error.message?.includes('not started')) {
          errorMessage += 'The meeting has not started yet. Please wait for the instructor to start the session.';
        } else if (error.message?.includes('not found')) {
          errorMessage += 'Session not found.';
        } else {
          errorMessage += 'Please try again or contact support.';
        }
        
        alert(errorMessage);
      }
    });
}


  // ... [REST OF THE EXISTING METHODS FROM THE ORIGINAL FILE]
  // [Include all other methods: getNotificationIcon, loadNotifications, loadTrainings, etc.]
  // [I'm keeping this abbreviated to focus on the new clipboard functionality]

  getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'certificate_issued': 'fa-certificate',
      'application_accepted': 'fa-check-circle',
      'application_rejected': 'fa-times-circle',
      'training_starting_soon': 'fa-clock',
      'session_reminder': 'fa-calendar-alt',
      'training_completed': 'fa-graduation-cap',
      'shortlisted': 'fa-user-check'
    };
    
    return iconMap[type] || 'fa-bell';
  }
  
  getNotificationIconClass(type: string): string {
    const classMap: Record<string, string> = {
      'certificate_issued': 'certificate',
      'application_accepted': 'success',
      'application_rejected': 'error',
      'training_starting_soon': 'warning',
      'session_reminder': 'info',
      'training_completed': 'certificate',
      'shortlisted': 'success'
    };
   
    return classMap[type] || 'default';
  }
  
  getNotificationTitle(type: string): string {
    const titleMap: Record<string, string> = {
      'certificate_issued': '🎓 Certificate Ready',
      'application_accepted': '✅ Application Accepted',
      'application_rejected': '❌ Application Not Accepted',
      'training_starting_soon': '⏰ Training Starting Soon',
      'session_reminder': '📅 Session Reminder',
      'training_completed': '🎉 Training Completed',
      'shortlisted': '✨ You\'ve Been Shortlisted!'
    };
    
    return titleMap[type] || 'Training Update';
  }
  
  handleNotificationClick(notification: any): void {
  console.log('🔔 Notification clicked:', notification);
  
  if (!notification.read && notification.id) {
    this.markNotificationAsRead(notification.id);
  }
  
  try {
    switch (notification.type) {
      case 'certificate_issued':
        // ✅ CRITICAL: Safe metadata access
        const metadata = notification.metadata || {};
        const enrollmentId = notification.related_id || 
                            metadata.enrollment_id || 
                            notification.enrollment_id;
        
        const trainingTitle = metadata.training_title || 
                             notification.training_title || 
                             'Training';
        
        if (enrollmentId && enrollmentId !== 'undefined' && enrollmentId !== 'null') {
          if (confirm(`Download certificate for "${trainingTitle}"?`)) {
            this.downloadCertificate(enrollmentId, trainingTitle);
          }
          this.showNotifications = false;
        } else {
          console.error('❌ No valid enrollment ID in notification:', notification);
          alert('Certificate download information is missing. Please refresh the page and try again.');
        }
        break;
      
      case 'application_accepted':
      case 'shortlisted':
      case 'training_starting_soon':
      case 'session_reminder':
        const trainingId = notification.metadata?.training_id || 
                          notification.training_id;
        
        if (trainingId) {
          this.viewTrainingFromNotification(trainingId);
        }
        break;
      
      default:
        this.showNotifications = false;
        break;
    }
  } catch (error) {
    console.error('❌ Error handling notification click:', error);
    alert('Failed to process notification. Please try again.');
  }
}

  
  viewTrainingFromNotification(trainingId: string): void {
    console.log('👀 Viewing training from notification:', trainingId);
    
    const training = this.trainings.find(t => t.id === trainingId);
    
    if (training) {
      this.viewTrainingDetail(training);
      this.showNotifications = false;
    } else {
      this.loading = true;
      this.trainingService.getTrainingDetails(trainingId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.loading = false;
            if (response && response.success && response.data) {
              this.viewTrainingDetail(response.data);
              this.showNotifications = false;
            } else {
              alert('Training not found or no longer available');
            }
          },
          error: (error) => {
            this.loading = false;
            console.error('❌ Error loading training:', error);
            alert('Unable to load training. It may have been removed.');
          }
        });
    }
  }
  
  viewAllNotifications(): void {
    console.log('📋 Viewing all notifications');
   
    this.trainingService.getNotifications({ read: undefined })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.notifications = response.data.notifications || response.data || [];
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
    
    this.trainingService.markNotificationRead(notificationId)
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
    const now = new Date();
    if (this.notifications.length > 0 && 
        now.getTime() - this.lastNotificationFetch.getTime() < this.NOTIFICATION_CACHE_MS) {
      console.log('⚡ Using cached notifications');
      return;
    }

    console.log('🔔 Loading notifications for jobseeker');
    
    this.trainingService.getNotifications({ read: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            let notificationsList: any[] = [];
            
            if (Array.isArray(response.data.notifications)) {
              notificationsList = response.data.notifications;
            } else if (Array.isArray(response.data)) {
              notificationsList = response.data;
            }
            
            this.notifications = notificationsList;
            this.unreadNotificationCount = this.notifications.filter(n => !n.read).length;
            this.lastNotificationFetch = new Date();
            
            console.log('✅ Notifications loaded:', this.notifications.length);
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
  
  private checkForNewNotifications(): void {
    const newNotifications = this.notifications.filter(n => {
      const notificationDate = new Date(n.created_at);
      return notificationDate > this.lastNotificationCheck && !n.read;
    });

    if (newNotifications.length > 0) {
      const importantTypes = [
        'certificate_issued',
        'application_accepted',
        'shortlisted',
        'training_starting_soon',
        'session_reminder'
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
    }
  }
  
  clearReadNotifications(): void {
    const readNotifications = this.notifications.filter(n => n.read);
    
    if (readNotifications.length === 0) {
      alert('No read notifications to clear');
      return;
    }
    
    if (confirm(`Clear ${readNotifications.length} read notifications?`)) {
      this.notifications = this.notifications.filter(n => !n.read);
      alert(`Cleared ${readNotifications.length} read notifications`);
    }
  }

  downloadCertificate(enrollmentId: string, trainingTitle: string = 'Training'): void {
  console.log('📥 Downloading certificate:', { enrollmentId, trainingTitle });
  
  // ✅ CRITICAL: Validate enrollmentId
  if (!enrollmentId || enrollmentId === 'undefined' || enrollmentId === 'null') {
    console.error('❌ Invalid enrollment ID:', enrollmentId);
    alert('Cannot download certificate: Invalid enrollment ID. Please refresh the page and try again.');
    return;
  }

  // ✅ Sanitize training title for filename
  const sanitizedTitle = (trainingTitle || 'Training')
    .replace(/[^a-z0-9\s-]/gi, '') // Remove special chars
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .substring(0, 50);              // Limit length

  this.loading = true;
  
  this.trainingService.downloadCertificate(enrollmentId).subscribe({
    next: (blob: Blob) => {
      this.loading = false;
      
      // ✅ Validate blob
      if (!blob || blob.size === 0) {
        console.error('❌ Empty certificate blob received');
        alert('Certificate file is empty. Please contact the training provider.');
        return;
      }
      
      console.log('✅ Certificate blob received:', {
        size: blob.size,
        type: blob.type
      });
      
      // ✅ Create download
      try {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizedTitle}_Certificate.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        alert(`Certificate for "${trainingTitle}" downloaded successfully!`);
        
      } catch (downloadError) {
        console.error('❌ Error creating download:', downloadError);
        alert('Failed to download certificate. Please try again.');
      }
    },
    error: (error) => {
      this.loading = false;
      console.error('❌ Certificate download error:', error);
      
      let errorMessage = 'Failed to download certificate. ';
      
      if (error.status === 404) {
        errorMessage += 'Certificate not found. It may not have been issued yet.';
      } else if (error.status === 401) {
        errorMessage += 'You are not authorized. Please log in again.';
      } else if (error.status === 403) {
        errorMessage += 'Access denied. You may not have permission to download this certificate.';
      } else if (error.status === 0) {
        errorMessage += 'Network error. Please check your internet connection and try again.';
      } else {
        errorMessage += 'Please try again or contact support.';
      }
      
      alert(errorMessage);
    }
  });
}

  downloadCertificateFromCard(training: Training): void {
  // ✅ CRITICAL: Validate enrollment_id
  if (!training.enrollment_id || 
      training.enrollment_id === 'undefined' || 
      training.enrollment_id === 'null') {
    console.error('❌ Invalid enrollment ID for training:', training);
    alert('Enrollment ID is missing. Please refresh the page and try again.');
    return;
  }
  
  this.downloadCertificate(training.enrollment_id, training.title);
}

  canDownloadCertificate(training: Training): boolean {
  // ✅ All conditions must be met
  const hasValidEnrollmentId = training.enrollment_id && 
                               training.enrollment_id !== 'undefined' && 
                               training.enrollment_id !== 'null';
  
  return !!(
    training.enrolled && 
    training.status === 'completed' &&
    training.certificate_issued &&
    hasValidEnrollmentId
  );
}


  getCertificateStatusMessage(training: Training): string {
    if (!training.enrolled) {
      return 'Apply for this training to earn a certificate';
    }
    
    if (training.application_status === 'pending') {
      return 'Application pending review';
    }
    
    if (training.application_status === 'rejected') {
      return 'Application not accepted';
    }
    
    if (training.application_status === 'shortlisted') {
      return 'You have been shortlisted! Training will start soon.';
    }
    
    if (training.status === 'in_progress') {
      return 'Training in progress';
    }
    
    if (training.status === 'completed' && !training.certificate_issued) {
      return 'Certificate is being prepared by the provider';
    }
    
    if (training.certificate_issued && training.enrollment_id) {
      return 'Certificate is ready for download!';
    }
    
    return 'Certificate status unknown. Please refresh the page.';
  }

  private isValidTraining(training: Training): boolean {
    if (!training.id || !training.title || !training.description || !training.provider_name) {
      return false;
    }
    if (training.status !== 'published' && training.status !== 'applications_closed') {
      return false;
    }
    return true;
  }

  loadTrainings(page: number = 1): void {
    const now = new Date();
    if (this.trainings.length > 0 && 
        page === this.currentPage &&
        now.getTime() - this.lastDataFetch.getTime() < this.CACHE_DURATION_MS) {
      console.log('⚡ Using cached data');
      return;
    }

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
          if (response.success && response.data) {
            const rawTrainings = response.data.trainings || [];
            
            const validTrainings = rawTrainings
              .filter((training: Training) => this.isValidTraining(training))
              .map((training: Training) => ({
                ...training,
                applied: training.applied || training.has_applied || false,
                enrolled: training.enrolled || training.is_enrolled || false,
                application_status: training.application_status ?? undefined,
                enrollment_id: training.enrollment_id ?? undefined,
                certificate_issued: !!training.certificate_issued
              } as Training));
            
            this.trainings = validTrainings;
            this.filteredTrainings = [...this.trainings];
            this.lastDataFetch = new Date();
            
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

  loadEnrolledTrainings(): void {
    const now = new Date();
    if (this.enrolledTrainings.length > 0 && 
        now.getTime() - this.lastDataFetch.getTime() < this.CACHE_DURATION_MS) {
      console.log('⚡ Using cached enrolled trainings');
      return;
    }

    this.loading = true;
    this.error = null;
    
    console.log('📚 Loading enrolled trainings for user:', this.userId);

    this.trainingService.getEnrolledTrainings({ page: 1, limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.enrolledTrainings = response.data.trainings || [];
            this.filteredTrainings = [...this.enrolledTrainings];
            this.lastDataFetch = new Date();
            
            console.log('✅ Loaded enrolled trainings:', this.enrolledTrainings.length);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading enrolled trainings:', error);
          this.error = 'Failed to load your enrolled trainings. Please try again.';
          this.loading = false;
          this.enrolledTrainings = [];
          this.filteredTrainings = [];
        }
      });
  }

  toggleEnrolledView(): void {
    this.showEnrolledOnly = !this.showEnrolledOnly;
    this.lastDataFetch = new Date(0);
    
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(this.currentPage);
    }
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
          this.categories = [
            'Technology', 'Business', 'Design', 'Marketing',
            'Personal Development', 'Health & Safety', 'Finance',
            'Communication', 'Leadership', 'Project Management'
          ];
        }
      });
  }

  viewTrainingDetail(training: Training): void {
    this.loading = true;
    this.error = null;
    
    console.log('🔍 Fetching full details for training:', training.id);
    
    this.trainingService.getTrainingDetails(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            if (this.isValidTraining(response.data)) {
              this.selectedTraining = response.data;
              this.showTrainingDetail = true;
            } else {
              this.error = 'This training is no longer available.';
            }
          } else {
            this.error = 'Failed to load training details.';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading training details:', error);
          this.error = 'Failed to load training details. Please try again.';
          this.loading = false;
        }
      });
  }

  closeTrainingDetail(): void {
    this.showTrainingDetail = false;
    this.selectedTraining = null;
  }

  refreshTrainingDetails(): void {
    if (this.selectedTraining) {
      this.viewTrainingDetail(this.selectedTraining);
    }
  }

  openApplicationModal(training: Training): void {
    if (!training || !training.id) {
      alert('Training information is missing');
      return;
    }
    
    const hasApplied = training.applied || training.has_applied;
    
    if (hasApplied) {
      const statusText = training.application_status || 'Pending';
      alert(`You have already applied for this training.\n\nStatus: ${statusText}\n\nPlease wait for the employer's decision.`);
      return;
    }
    
    if (training.enrolled) {
      alert('You are already enrolled in this training');
      return;
    }
    
    if (training.application_deadline) {
      const deadline = new Date(training.application_deadline);
      if (new Date() > deadline) {
        alert('Application deadline has passed');
        return;
      }
    }
    
    if (training.max_participants && training.current_participants >= training.max_participants) {
      alert('This training has reached maximum capacity');
      return;
    }
    
    this.selectedTraining = training;
    this.applyingTrainingId = training.id;
    this.motivationLetter = '';
    this.showApplicationModal = true;
  }

  closeApplicationModal(): void {
    this.showApplicationModal = false;
    this.selectedTraining = null;
    this.applyingTrainingId = null;
    this.motivationLetter = '';
  }

  submitApplication(): void {
    if (!this.applyingTrainingId) {
      alert('No training selected');
      return;
    }

    if (!this.motivationLetter.trim()) {
      alert('Please provide a motivation letter explaining why you want to join this training');
      return;
    }

    if (this.motivationLetter.trim().length < 50) {
      alert('Motivation letter must be at least 50 characters long');
      return;
    }

    console.log('📝 Submitting application for training:', this.applyingTrainingId);
    
    if (!this.userId) {
      console.error('❌ No user ID found for application submission');
      alert('Your session may have expired. Please log in again to apply for this training.');
      return;
    }

    this.loading = true;
    
    this.trainingService.applyForTraining(this.applyingTrainingId, this.motivationLetter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          
          if (response.success) {
            const training = this.trainings.find(t => t.id === this.applyingTrainingId);
            if (training) {
              training.applied = true;
              training.has_applied = true;
              training.application_status = 'pending';
            }
            
            alert('Application submitted successfully!\n\nYou will be notified about the shortlisting process.');
            
            this.closeApplicationModal();
            this.lastDataFetch = new Date(0);
            this.lastNotificationFetch = new Date(0);
            
            setTimeout(() => {
              this.loadTrainings(this.currentPage);
              this.loadNotifications();
            }, 500);
          }
        },
        error: (error: any) => {
          this.loading = false;
          console.error('❌ Error submitting application:', error);
          
          let errorMessage = 'Failed to submit application.';
          
          if (error && error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error && error.message) {
            errorMessage = error.message;
          }
          
          if (errorMessage.includes('user information')) {
            errorMessage += ' Please try logging out and logging back in.';
          }
          
          alert(errorMessage);
        }
      });
  }

  getApplicationStatusBadge(training: Training): string {
    if (!training.applied) return '';
    
    switch (training.application_status) {
      case 'pending':
        return 'Application Pending Review';
      case 'shortlisted':
        return 'Shortlisted - Awaiting Training Start';
      case 'rejected':
        return 'Application Not Accepted';
      default:
        return 'Application Status Unknown';
    }
  }

  getApplicationStatusClass(training: Training): string {
    if (!training.applied) return '';
    
    switch (training.application_status) {
      case 'pending':
        return 'status-pending';
      case 'shortlisted':
        return 'status-shortlisted';
      case 'rejected':
        return 'status-rejected';
      default:
        return '';
    }
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.lastDataFetch = new Date(0);
    
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(1);
    }
  }

  onSearchChange(): void {
    this.searchSubject$.next(this.searchQuery);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.lastDataFetch = new Date(0);
    
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(1);
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
      level: [],
      cost: [],
      mode: [],
      category: []
    };
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.lastDataFetch = new Date(0);
    
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(1);
    }
  }

  formatDuration(duration_hours: number): string {
    return this.trainingService.formatDuration(duration_hours);
  }

  formatPrice(training: Training): string {
    return this.trainingService.formatPrice(training.price, training.cost_type);
  }

  isEnrolled(training: Training): boolean {
    return training.enrolled || false;
  }

  hasApplied(training: Training): boolean {
    return training.applied || false;
  }

  canApply(training: Training): boolean {
    const hasApplied = training.applied || training.has_applied;
    
    if (hasApplied || training.enrolled) {
      return false;
    }
    
    if (training.status !== 'published') {
      return false;
    }
    
    if (training.application_deadline) {
      const deadline = new Date(training.application_deadline);
      if (new Date() > deadline) {
        return false;
      }
    }
    
    if (training.max_participants && training.current_participants >= training.max_participants) {
      return false;
    }
    
    return true;
  }

  isApplicationDeadlinePassed(training: Training): boolean {
    if (!training.application_deadline) return false;
    const deadline = new Date(training.application_deadline);
    return new Date() > deadline;
  }

  getSessionsCount(training: Training): number {
    return training.sessions?.length || training.session_count || 0;
  }

  getDaysUntilDeadline(training: Training): number {
    if (!training.application_deadline) return 0;
    const deadline = new Date(training.application_deadline);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.lastDataFetch = new Date(0);
      
      if (this.showEnrolledOnly) {
        this.loadEnrolledTrainings();
      } else {
        this.loadTrainings(page);
      }
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
    this.lastDataFetch = new Date(0);
    
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(this.currentPage);
    }
  }
}