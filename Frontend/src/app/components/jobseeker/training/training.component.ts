// jobseeker-training.component.ts - BOOTCAMP MODEL (Application & Live Sessions) - FIXED
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
  
  constructor(
    private trainingService: TrainingService,
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
    
    this.loadTrainings();
    this.loadCategories();
    this.loadNotifications();
    
    // Auto-refresh trainings every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auto-refreshing trainings...');
        if (this.showEnrolledOnly) {
          this.loadEnrolledTrainings();
        } else {
          this.loadTrainings();
        }
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
    this.destroy$.next();
    this.destroy$.complete();
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

  // ============================================
  // NOTIFICATIONS
  // ============================================
  
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
    
    if (!notification.read) {
      this.markNotificationAsRead(notification.id);
    }
    
    switch (notification.type) {
      case 'certificate_issued':
        const enrollmentId = notification.related_id || notification.metadata?.enrollment_id;
        if (enrollmentId) {
          const trainingTitle = notification.metadata?.training_title || 'Training';
          if (confirm(`Download certificate for "${trainingTitle}"?`)) {
            this.downloadCertificate(enrollmentId, trainingTitle);
          }
          this.showNotifications = false;
        }
        break;
      
      case 'application_accepted':
      case 'shortlisted':
      case 'training_starting_soon':
      case 'session_reminder':
        if (notification.metadata?.training_id) {
          this.viewTrainingFromNotification(notification.metadata.training_id);
        }
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
   
    // ✅ FIXED: Service expects only params object, not userId and userType
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
    
    // ✅ FIXED: Service expects only notificationId, not userId
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
    console.log('🔔 Loading notifications for jobseeker:', this.userId);
    
    // ✅ FIXED: Service expects only params object, not userId and userType
    this.trainingService.getNotifications({ read: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.notifications = response.data.notifications || response.data || [];
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
          errorMessage += 'Certificate not found.';
        } else if (error.status === 401) {
          errorMessage += 'You are not authorized. Please log in again.';
        } else if (error.status === 403) {
          errorMessage += 'Access denied.';
        } else {
          errorMessage += 'Please try again or contact support.';
        }
        
        alert(errorMessage);
      }
    });
  }

  downloadCertificateFromCard(training: Training): void {
    if (!training.enrollment_id) {
      alert('Enrollment ID is missing. Please contact support.');
      return;
    }
    this.downloadCertificate(training.enrollment_id, training.title);
  }

  canDownloadCertificate(training: Training): boolean {
    return !!(
      training.enrolled && 
      training.status === 'completed' &&
      training.certificate_issued &&
      training.enrollment_id
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

  // ============================================
  // DATA LOADING
  // ============================================
  
  private isValidTraining(training: Training): boolean {
    if (!training.id || !training.title || !training.description || !training.provider_name) {
      console.warn('❌ Missing required fields:', training.id);
      return false;
    }
    if (training.status !== 'published' && training.status !== 'applications_closed') {
      console.warn('❌ Not published:', training.title);
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

  loadEnrolledTrainings(): void {
    this.loading = true;
    this.error = null;
    
    console.log('📚 Loading enrolled trainings for user:', this.userId);

    this.trainingService.getEnrolledTrainings({ page: 1, limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📦 Enrolled trainings response:', response);
          
          if (response.success && response.data) {
            this.enrolledTrainings = response.data.trainings || [];
            this.filteredTrainings = [...this.enrolledTrainings];
            
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
          console.log('📦 Training details response:', response);
          if (response.success && response.data) {
            if (this.isValidTraining(response.data)) {
              this.selectedTraining = response.data;
              console.log('✅ Training loaded:', {
                title: this.selectedTraining.title,
                sessions: this.selectedTraining.sessions?.length || 0,
                enrolled: this.selectedTraining.enrolled,
                applied: this.selectedTraining.applied,
                applicationStatus: this.selectedTraining.application_status,
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

  // ============================================
  // APPLICATION PROCESS
  // ============================================
  
  openApplicationModal(training: Training): void {
    if (!training || !training.id) {
      alert('Training information is missing');
      return;
    }
    
    // Check if already applied
    if (training.applied) {
      alert(`You have already applied for this training. Status: ${training.application_status || 'Pending'}`);
      return;
    }
    
    // Check if already enrolled
    if (training.enrolled) {
      alert('You are already enrolled in this training');
      return;
    }
    
    // Check if application deadline has passed
    if (training.application_deadline) {
      const deadline = new Date(training.application_deadline);
      if (new Date() > deadline) {
        alert('Application deadline has passed');
        return;
      }
    }
    
    // Check if max participants reached
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
    
    this.loading = true;
    this.trainingService.applyForTraining(this.applyingTrainingId, this.motivationLetter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response.success) {
            console.log('✅ Application submitted successfully');
            alert('Application submitted successfully! You will be notified about the shortlisting process.');
            
            // Update training in list
            const training = this.trainings.find(t => t.id === this.applyingTrainingId);
            if (training) {
              training.applied = true;
              training.application_status = 'pending';
            }
            
            this.closeApplicationModal();
            
            if (this.showEnrolledOnly) {
              this.loadEnrolledTrainings();
            } else {
              this.loadTrainings(this.currentPage);
            }
          }
        },
        error: (error: any) => {
          this.loading = false;
          console.error('❌ Error submitting application:', error);
          this.error = error.message || 'Failed to submit application. Please try again.';
          alert('Failed to submit application. Please try again.');
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

  // ============================================
  // FILTER METHODS
  // ============================================
  
  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.currentPage = 1;
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(1);
    }
  }

  onSearchChange(): void {
    setTimeout(() => {
      this.currentPage = 1;
      if (this.showEnrolledOnly) {
        this.loadEnrolledTrainings();
      } else {
        this.loadTrainings(1);
      }
    }, 500);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  onFilterChange(): void {
    this.currentPage = 1;
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
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(1);
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
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
    // Cannot apply if already applied or enrolled
    if (training.applied || training.enrolled) return false;
    
    // Cannot apply if status is not 'published'
    if (training.status !== 'published') return false;
    
    // Check application deadline
    if (training.application_deadline) {
      const deadline = new Date(training.application_deadline);
      if (new Date() > deadline) return false;
    }
    
    // Check max participants
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

  // ============================================
  // PAGINATION
  // ============================================
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
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
    if (this.showEnrolledOnly) {
      this.loadEnrolledTrainings();
    } else {
      this.loadTrainings(this.currentPage);
    }
  }
}