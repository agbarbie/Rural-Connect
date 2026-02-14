// employer-training.component.ts - COMPLETE WITH CLOUDFLARE REALTIME INTEGRATION
import { Component, OnInit, OnDestroy, Inject, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, interval } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  TrainingService,
  Training,
  CreateTrainingRequest,
  UpdateTrainingRequest,
  TrainingStats,
  TrainingSession,
  TrainingOutcome,
  TrainingApplication,
  TrainingSearchParams
} from '../../../../../services/training.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { DatePipe } from '@angular/common';
import { SafePipe } from '../../../pipes/safe.pipe';


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
  application_deadline: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  sessions: TrainingSession[];
  outcomes: TrainingOutcome[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  imports: [CommonModule, FormsModule, SidebarComponent, SafePipe],
  styleUrls: ['./training.component.css'],
  providers: [DatePipe]
})
export class TrainingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  // Component state
  employerName: string = 'Training Provider';
  employerId: string = '';
  trainings: Training[] = [];
  showAddForm: boolean = false;
  selectedTraining: Training | null = null;
  isLoading: boolean = false;
  error: string | null = null;

  // Modals
  showDetailsModal: boolean = false;
  detailedTraining: Training | null = null;
  showApplicationsModal: boolean = false;
  showEnrollmentsModal: boolean = false;
  
  // Editing
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
  pageSize: number = 10;

  // Form data
  newTraining: NewTraining = {
    title: '',
    description: '',
    category: 'Technology',
    level: 'Beginner',
    duration_hours: 40,
    cost_type: 'Free',
    price: 0,
    mode: 'Online',
    provider_name: this.employerName,
    has_certificate: true,
    thumbnail_url: '',
    location: '',
    application_deadline: '',
    start_date: '',
    end_date: '',
    max_participants: 30,
    sessions: [],
    outcomes: []
  };

  // Categories
  categories: string[] = [
    'Technology', 'Business', 'Design', 'Marketing',
    'Personal Development', 'Health & Safety', 'Finance',
    'Communication', 'Leadership', 'Project Management'
  ];

  levels: ('Beginner' | 'Intermediate' | 'Advanced')[] = ['Beginner', 'Intermediate', 'Advanced'];

  // Session form
  showSessionForm: boolean = false;
  editingSessionId: string | null = null;
  newSession: TrainingSession = {
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 120,
    meeting_url: '',
    meeting_password: '',
    order_index: 0,
    is_completed: false
  };

  // Outcome form
  showOutcomeForm: boolean = false;
  newOutcome: TrainingOutcome = {
    outcome_text: '',
    order_index: 0
  };

  // Applications
  applications: TrainingApplication[] = [];
  selectedApplications: Set<string> = new Set();

  // Enrollments
  enrollments: any[] = [];
  
  // ✅ Meeting modal
  showMeetingModal: boolean = false;
  meetingIframeUrl: string | null = null;
  currentSession: TrainingSession | null = null;
  
  // Notifications
  enrollmentNotifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  hasMoreEnrollmentNotifications: boolean = false;
  loadingNotifications: boolean = false;
  private notificationsPage: number = 1;
  private notificationsLimit: number = 10;

  // Bulk operations
  selectedTrainingIds: Set<string> = new Set();

  // ✅ PERFORMANCE: Cache management
  private lastDataFetch: Date = new Date(0);
  private lastNotificationFetch: Date = new Date(0);
  private readonly CACHE_DURATION_MS = 120000; // 2 minutes cache
  private readonly NOTIFICATION_CACHE_MS = 60000; // 1 minute for notifications

  constructor(
    @Inject(forwardRef(() => TrainingService)) private trainingService: TrainingService,
    private http: HttpClient,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    console.log('🚀 Initializing Training Component with Cloudflare Realtime...');
    
    const userId = localStorage.getItem('userId');
    if (userId) {
      this.employerId = userId;
      console.log('✅ Employer ID loaded:', this.employerId);
    } else {
      console.error('❌ No employer ID found in localStorage');
      this.error = 'Session expired. Please log in again.';
      return;
    }
    
    const userName = localStorage.getItem('userName');
    if (userName) {
      this.employerName = userName;
      this.newTraining.provider_name = userName;
    }
    
    // Subscribe to trainings observable
    this.trainingService.trainings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trainings => {
        if (trainings && trainings.length > 0) {
          this.trainings = trainings;
          this.calculateLocalStats();
        }
      });
    
    // Debounced search
    this.searchSubject$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchParams.search = searchTerm;
      this.searchParams.page = 1;
      this.loadTrainings();
    });
    
    // Initial data load
    this.loadTrainings();
    this.loadNotifications();
    
    // Auto-refresh every 5 minutes
    interval(300000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.showAddForm && !this.showApplicationsModal && !this.showEnrollmentsModal) {
          const now = new Date();
          
          if (now.getTime() - this.lastDataFetch.getTime() > this.CACHE_DURATION_MS) {
            console.log('🔄 Auto-refreshing data (cache expired)...');
            this.loadTrainings();
          }
          
          if (now.getTime() - this.lastNotificationFetch.getTime() > this.NOTIFICATION_CACHE_MS) {
            console.log('🔔 Auto-refreshing notifications (cache expired)...');
            this.loadNotifications();
          }
        }
      });
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
  // DATA LOADING - OPTIMIZED
  // ============================================
  
  loadTrainings(): void {
    if (!this.employerId) {
      console.error('❌ Cannot load trainings: No employer ID');
      this.error = 'Session error. Please log in again.';
      return;
    }
    
    const now = new Date();
    if (this.trainings.length > 0 && 
        now.getTime() - this.lastDataFetch.getTime() < this.CACHE_DURATION_MS) {
      console.log('⚡ Using cached data');
      return;
    }
    
    console.log('🔄 Loading trainings for employer:', this.employerId);
    this.isLoading = true;
    
    this.trainingService.getMyTrainings(this.searchParams, this.employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data && Array.isArray(response.data.trainings)) {
            this.trainings = response.data.trainings;
            this.lastDataFetch = new Date();
            console.log('✅ Trainings loaded:', this.trainings.length);
            
            this.calculateLocalStats();
            
            if (response.pagination) {
              this.totalPages = response.pagination.total_pages;
              this.currentPage = response.pagination.current_page;
            }
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading trainings:', error);
          this.error = 'Failed to load trainings. Please try again.';
          this.isLoading = false;
        }
      });
  }

  loadStats(): void {
    this.calculateLocalStats();
  }

  private calculateLocalStats(): void {
    if (this.trainings.length === 0) {
      this.stats = {
        total_trainings: 0,
        published_trainings: 0,
        draft_trainings: 0,
        total_enrollments: 0,
        total_revenue: 0,
        avg_rating: 0,
        completion_rate: 0,
        certificates_issued: 0,
        total_applications: 0,
        pending_applications: 0
      };
      return;
    }

    const stats = this.trainings.reduce((acc, training) => {
      acc.total_trainings++;
      
      if (training.status === 'published') acc.published_trainings++;
      if (training.status === 'draft') acc.draft_trainings++;
      
      acc.total_enrollments += training.total_students || 0;
      
      if (training.cost_type === 'Paid') {
        acc.total_revenue += (training.price || 0) * (training.total_students || 0);
      }
      
      acc.avg_rating += training.rating || 0;
      
      return acc;
    }, {
      total_trainings: 0,
      published_trainings: 0,
      draft_trainings: 0,
      total_enrollments: 0,
      total_revenue: 0,
      avg_rating: 0,
      completion_rate: 0,
      certificates_issued: 0,
      total_applications: 0,
      pending_applications: 0
    });

    stats.avg_rating = stats.avg_rating / this.trainings.length;
    this.stats = stats;
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================
  
  loadNotifications(): void {
    const now = new Date();
    if (this.enrollmentNotifications.length > 0 && 
        now.getTime() - this.lastNotificationFetch.getTime() < this.NOTIFICATION_CACHE_MS) {
      console.log('⚡ Using cached notifications');
      return;
    }

    console.log('🔔 Loading employer notifications');
    
    this.trainingService.getNotifications({})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const notifications = response.data.notifications || response.data || [];
            
            this.enrollmentNotifications = notifications.map((n: any) => {
              const metadata = typeof n.metadata === 'string' 
                ? JSON.parse(n.metadata) 
                : (n.metadata || {});
              
              const displayName = 
                n.display_name ||
                n.user_name ||
                n.jobseeker_name ||
                metadata.display_name ||
                metadata.user_name ||
                metadata.jobseeker_name ||
                metadata.applicant_name ||
                (n.first_name && n.last_name ? `${n.first_name} ${n.last_name}`.trim() : null) ||
                (metadata.first_name && metadata.last_name ? `${metadata.first_name} ${metadata.last_name}`.trim() : null) ||
                (n.email ? n.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : null) ||
                (metadata.email ? metadata.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : null) ||
                'Anonymous User';
              
              const userEmail = 
                n.user_email ||
                n.email ||
                metadata.user_email ||
                metadata.applicant_email ||
                metadata.email ||
                '';
              
              const profileImage = 
                n.profile_image ||
                metadata.profile_image ||
                null;
              
              return {
                id: n.id,
                type: n.type,
                title: n.title || this.getNotificationTitle(n.type, n.message || ''),
                message: n.message,
                is_read: n.is_read || false,
                created_at: n.created_at,
                display_name: displayName,
                user_id: n.user_id || metadata.user_id || '',
                user_email: userEmail,
                phone_number: n.phone_number || metadata.phone_number || '',
                profile_image: profileImage,
                training_id: n.training_id || metadata.training_id || '',
                training_title: n.training_title || metadata.training_title || '',
                application_id: n.application_id || metadata.application_id || '',
                motivation_letter: n.motivation_letter || metadata.motivation_letter || metadata.motivation || '',
                applied_at: n.applied_at || metadata.applied_at || n.created_at,
                metadata: metadata
              };
            });
            
            this.unreadNotificationCount = this.enrollmentNotifications.filter(
              (n: any) => !n.is_read && (n.type === 'application_submitted' || n.type === 'application_received')
            ).length;
            
            this.lastNotificationFetch = new Date();
            console.log('✅ Notifications loaded:', this.enrollmentNotifications.length);
          }
        },
        error: (error) => {
          console.error('❌ Error loading notifications:', error);
          this.enrollmentNotifications = [];
          this.unreadNotificationCount = 0;
        }
      });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'application_submitted': return 'fa-file-alt';
      case 'application_shortlisted': return 'fa-check-circle';
      case 'application_rejected': return 'fa-times-circle';
      case 'training_completed': return 'fa-graduation-cap';
      case 'new_enrollment': return 'fa-user-plus';
      default: return 'fa-bell';
    }
  }
  
  getNotificationIconClass(type: string): string {
    const classMap: Record<string, string> = {
      'application_submitted': 'notification-new',
      'application_shortlisted': 'notification-success',
      'application_rejected': 'notification-error',
      'training_completed': 'notification-complete',
      'new_enrollment': 'notification-success'
    };
   
    return classMap[type] || 'notification-default';
  }

  getAvatarUrl(notification: any): string {
    if (notification.profile_image) {
      return notification.profile_image;
    }
    
    const name = notification.display_name || 'User';
    const encodedName = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=3b82f6&color=fff&size=128`;
  }

  getInitials(name: string): string {
    if (!name || name === 'Anonymous User') return 'U';
    
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  getNotificationTitle(type: string, message: string): string {
    const titleMap: Record<string, string> = {
      'application_submitted': '📝 New Application',
      'application_shortlisted': '✅ Application Shortlisted',
      'application_rejected': '❌ Application Rejected',
      'training_completed': '🎉 Training Completed',
      'new_enrollment': '👤 New Enrollment'
    };
    
    return titleMap[type] || message.split('.')[0].substring(0, 50) || 'Training Update';
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    try {
      return this.datePipe.transform(date, 'medium') || 'N/A';
    } catch {
      return 'Invalid date';
    }
  }

  viewStudentProfile(notification: any): void {
    console.log('👤 Viewing applicant profile:', notification);
    
    const applicationId = notification.application_id || notification.metadata?.application_id;
    const trainingId = notification.training_id || notification.metadata?.training_id;
    
    if (!applicationId || !trainingId) {
      alert('Unable to load profile: Missing application information');
      return;
    }
    
    this.markNotificationAsRead(notification.id);
    
    this.isLoading = true;
    this.http.get<any>(
      `${this.trainingService['API_BASE']}/trainings/${trainingId}/applications/${applicationId}/profile`,
      { headers: this.trainingService['getAuthHeaders']() }
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response.success && response.data) {
            const profile = response.data;
            
            const profileText = `
═══════════════════════════════════════════════════════
                    APPLICANT PROFILE
═══════════════════════════════════════════════════════

📋 PERSONAL INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:         ${profile.first_name || ''} ${profile.last_name || ''}
Email:        ${profile.email || 'N/A'}
Phone:        ${profile.phone_number || profile.contact_number || 'N/A'}
Location:     ${profile.location || 'N/A'}

🎓 TRAINING APPLICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Training:     ${profile.training_title || notification.training_title || 'N/A'}
Applied:      ${this.formatDate(profile.applied_at)}
Status:       ${profile.application_status || 'Pending'}

📝 MOTIVATION LETTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profile.motivation || 'No motivation letter provided'}

${profile.skills ? `
💼 SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills}
` : ''}

${profile.experience ? `
🏢 EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profile.experience}
` : ''}

${profile.education ? `
🎓 EDUCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profile.education}
` : ''}

${profile.bio ? `
ℹ️  BIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${profile.bio}
` : ''}

═══════════════════════════════════════════════════════
          `.trim();

            alert(profileText);
          } else {
            alert('Unable to load applicant profile');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error loading profile:', error);
          this.showFallbackProfile(notification);
        }
      });
  }

  private showFallbackProfile(notification: any): void {
    const metadata = notification.metadata || {};
    
    const fallbackText = `
═══════════════════════════════════════════════════════
              APPLICANT PROFILE (Limited)
═══════════════════════════════════════════════════════

📋 AVAILABLE INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:         ${notification.display_name || 'N/A'}
Email:        ${notification.user_email || metadata.email || 'N/A'}
Phone:        ${notification.phone_number || metadata.phone_number || 'N/A'}

Training:     ${notification.training_title || metadata.training_title || 'N/A'}
Applied:      ${this.formatDate(notification.applied_at || notification.created_at)}

📝 MOTIVATION LETTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${notification.motivation_letter || metadata.motivation || 'Not available'}

⚠️  Complete profile could not be loaded.
    Please view full application details for more information.

═══════════════════════════════════════════════════════
    `.trim();

    alert(fallbackText);
  }

  viewApplicationDetails(notification: any): void {
    console.log('📄 Viewing application details:', notification);
    
    const metadata = notification.metadata || {};
    const trainingId = notification.training_id || metadata.training_id;
    
    if (!trainingId) {
      alert('Training information is missing from this notification.');
      return;
    }

    const training = this.trainings.find(t => t.id === trainingId);
    
    if (training) {
      this.selectedTraining = training;
      this.viewApplications(training);
      this.showNotifications = false;
      this.markNotificationAsRead(notification.id);
    } else {
      this.isLoading = true;
      this.trainingService.getTrainingDetails(trainingId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading = false;
            if (response.success && response.data) {
              this.selectedTraining = response.data;
              this.viewApplications(response.data);
              this.showNotifications = false;
              this.markNotificationAsRead(notification.id);
            } else {
              alert('Unable to load training details');
            }
          },
          error: (error) => {
            this.isLoading = false;
            console.error('❌ Error loading training:', error);
            alert('Unable to load training. It may have been removed.');
          }
        });
    }
  }

  markNotificationAsRead(notificationId: string): void {
    console.log('✅ Marking notification as read:', notificationId);
    
    const notification = this.enrollmentNotifications.find(n => n.id === notificationId);
    if (notification && !notification.is_read) {
      notification.is_read = true;
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
            notification.is_read = false;
            this.unreadNotificationCount++;
          }
        }
      });
  }

  markAllEnrollmentNotificationsRead(): void {
    if (!confirm('Mark all enrollment notifications as read?')) return;

    this.enrollmentNotifications.forEach(n => {
      if (!n.is_read) {
        this.markNotificationAsRead(n.id);
      }
    });
  }

  loadMoreEnrollmentNotifications(): void {
    if (this.loadingNotifications) return;

    this.loadingNotifications = true;
    this.notificationsPage += 1;

    this.trainingService.getNotifications({ 
      page: this.notificationsPage,
      limit: this.notificationsLimit,
      read: undefined 
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const newItems = response?.data?.notifications || response?.data || [];
          if (!Array.isArray(newItems) || newItems.length === 0) {
            this.hasMoreEnrollmentNotifications = false;
          } else {
            const mapped = newItems.map((n: any) => ({
              ...n,
              display_name: n.jobseeker_name || `${n.first_name || ''} ${n.last_name || ''}`.trim() ||
                            (n.email ? n.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Anonymous User')
            }));
            this.enrollmentNotifications = [...this.enrollmentNotifications, ...mapped];
            this.hasMoreEnrollmentNotifications = newItems.length === this.notificationsLimit;
          }
          this.loadingNotifications = false;
        },
        error: (err: any) => {
          console.error('Error loading more notifications:', err);
          this.loadingNotifications = false;
        }
      });
  }

  confirmClearEnrollmentNotifications(): void {
    if (!confirm('Are you sure you want to clear all enrollment notifications?')) return;

    this.enrollmentNotifications = [];
    this.unreadNotificationCount = 0;
    this.hasMoreEnrollmentNotifications = false;
    this.notificationsPage = 1;
  }

  // ============================================
  // FORM MANAGEMENT
  // ============================================
  
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
      duration_hours: 40,
      cost_type: 'Free',
      price: 0,
      mode: 'Online',
      provider_name: this.employerName,
      has_certificate: true,
      thumbnail_url: '',
      location: '',
      application_deadline: '',
      start_date: '',
      end_date: '',
      max_participants: 30,
      sessions: [],
      outcomes: []
    };
    this.editingTrainingId = null;
    this.thumbnailPreview = null;
    this.thumbnailFile = null;
    this.error = null;
  }

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

  // ============================================
  // SESSION MANAGEMENT WITH CLOUDFLARE MEETING
  // ============================================
  
  toggleSessionForm(): void {
    this.showSessionForm = !this.showSessionForm;
    if (!this.showSessionForm) {
      this.resetSessionForm();
    }
  }

  resetSessionForm(): void {
    this.newSession = {
      title: '',
      description: '',
      scheduled_at: '',
      duration_minutes: 120,
      meeting_url: '',
      meeting_password: this.generateMeetingPassword(),
      order_index: this.newTraining.sessions.length,
      is_completed: false
    };
    this.editingSessionId = null;
  }

  openSessionFormForNewTraining(): void {
    this.selectedTraining = null;
    this.editingSessionId = null;
    this.resetSessionForm();
    this.newSession.order_index = this.newTraining.sessions.length;
    this.newSession.meeting_password = this.generateMeetingPassword();
    this.showSessionForm = true;
  }

  addSession(): void {
    console.log('📅 addSession called');

    if (!this.newSession.title || !this.newSession.scheduled_at) {
      alert('Please fill in session title and schedule');
      return;
    }

    // Generate a temporary meeting URL (will be replaced by actual Cloudflare meeting when training is created)
    if (!this.newSession.meeting_url) {
      this.newSession.meeting_url = `https://realtime.cloudflare.com/meeting/pending-${Date.now()}`;
    }

    if (!this.newSession.meeting_password) {
      this.newSession.meeting_password = this.generateMeetingPassword();
    }

    if (!this.selectedTraining || this.editingTrainingId) {
      console.log('📅 Adding session to form array');
      
      this.newTraining.sessions.push({ 
        ...this.newSession,
        order_index: this.newTraining.sessions.length 
      });
      
      console.log('✅ Session added. Total sessions:', this.newTraining.sessions.length);
      this.toggleSessionForm();
      return;
    }

    if (this.selectedTraining && this.selectedTraining.id) {
      alert('To add sessions to an existing training, please edit the training and add sessions there.');
      this.toggleSessionForm();
      return;
    }
  }

  removeSession(index: number): void {
    this.newTraining.sessions.splice(index, 1);
    this.newTraining.sessions.forEach((session, i) => {
      session.order_index = i;
    });
  }

  openSessionForm(training?: Training, session?: TrainingSession): void {
    if (training && training.id && !this.editingTrainingId) {
      alert('To add or edit sessions, please first click "Edit" on the training card.');
      return;
    }
    
    if (training) {
      this.selectedTraining = training;
      
      if (session) {
        this.editingSessionId = session.id || null;
        this.newSession = { ...session };
      } else {
        this.resetSessionForm();
        this.newSession.order_index = training.sessions?.length || 0;
        this.newSession.meeting_password = this.generateMeetingPassword();
      }
    } else {
      this.selectedTraining = null;
      this.resetSessionForm();
      this.newSession.order_index = this.newTraining.sessions.length;
      this.newSession.meeting_password = this.generateMeetingPassword();
    }
   
    this.showSessionForm = true;
  }

  deleteSession(trainingId: string, sessionId: string): void {
    if (confirm('Are you sure you want to delete this session?')) {
      alert('Session deletion not yet implemented');
    }
  }

  /**
   * Generate random meeting password
   */
  private generateMeetingPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // ============================================
  // OUTCOME MANAGEMENT
  // ============================================
  
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
  // TRAINING CRUD WITH CLOUDFLARE MEETING
  // ============================================
  
  saveTraining(): void {
    console.log('💾 saveTraining called');

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

  private uploadThumbnail(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.thumbnailFile) {
        resolve('');
        return;
      }
      setTimeout(() => {
        resolve(this.thumbnailPreview || '');
      }, 1000);
    });
  }

  private performSave(thumbnailUrl: string): void {
    console.log('🚀 performSave called with thumbnail:', thumbnailUrl);
    
    const baseData: CreateTrainingRequest = {
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
      eligibility_requirements: undefined,
      application_deadline: this.newTraining.application_deadline || undefined,
      start_date: this.newTraining.start_date || undefined,
      end_date: this.newTraining.end_date || undefined,
      max_participants: this.newTraining.max_participants || undefined,
      
      sessions: (this.newTraining.sessions || []).map((s, index) => ({
        title: s.title,
        description: s.description,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
        meeting_url: s.meeting_url,
        meeting_password: s.meeting_password,
        order_index: index
      })),
      outcomes: (this.newTraining.outcomes || []).map((o, index) => ({
        outcome_text: o.outcome_text,
        order_index: index
      }))
    };

    if (this.editingTrainingId) {
      console.log('🔄 Updating training:', this.editingTrainingId);
      
      this.trainingService.updateTraining(this.editingTrainingId, baseData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              console.log('✅ Training updated successfully');
              this.cancelEdit();
              
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
              
              alert('Training updated successfully!');
            }
          },
          error: (error) => {
            console.error('❌ Error updating training:', error);
            this.error = 'Failed to update training: ' + (error.message || 'Unknown error');
            alert('Failed to update training: ' + (error.message || 'Unknown error'));
          }
        });
    } else {
      console.log('➕ Creating new training');
      
      this.trainingService.createTraining(baseData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              console.log('✅ Training created successfully');
              
              // ✅ CREATE CLOUDFLARE MEETING FOR THE NEW TRAINING
              if (response.data?.id) {
                this.createMeetingForTraining(
                  response.data.id.toString(),
                  response.data.title
                );
              }
              
              this.toggleAddForm();
              this.resetForm();
              
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
              
              alert('Training created successfully! Meeting links will be generated.');
            }
          },
          error: (error) => {
            console.error('❌ Error creating training:', error);
            this.error = 'Failed to create training: ' + (error.message || 'Unknown error');
            alert('Failed to create training: ' + (error.message || 'Unknown error'));
          }
        });
    }
  }

  /**
   * Create Cloudflare meeting for training
   */
  private async createMeetingForTraining(trainingId: string, title: string): Promise<void> {
    console.log('🎥 Creating Dyte meeting for training:', trainingId);
    
    // Meeting will be auto-created by backend when sessions are added
    // No need for separate meeting creation call
    console.log('✅ Meeting will be created with first session');
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingTrainingId = null;
    this.resetForm();
    this.thumbnailPreview = null;
    this.thumbnailFile = null;
  }

  editTraining(training: Training): void {
    console.log('✏️ Editing training:', training.id);
    
    this.trainingService.getTrainingDetails(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const fullTraining = response.data;
            
            this.editingTrainingId = fullTraining.id;
            
            // Store meeting ID if exists
            if (fullTraining.meeting_id) {
              console.log('📹 Training has existing meeting:', fullTraining.meeting_id);
            }
            
            const mappedSessions: TrainingSession[] = (fullTraining.sessions || []).map((s: any, index: number) => ({
              id: s.id,
              training_id: s.training_id,
              title: s.title || '',
              description: s.description || '',
              scheduled_at: s.scheduled_at ? this.formatDateTimeLocal(s.scheduled_at) : '',
              duration_minutes: s.duration_minutes || 120,
              meeting_url: s.meeting_url || '',
              meeting_password: s.meeting_password || '',
              order_index: s.order_index ?? index,
              is_completed: s.is_completed || false,
              attendance_count: s.attendance_count || 0,
              created_at: s.created_at,
              updated_at: s.updated_at
            }));
            
            const mappedOutcomes: TrainingOutcome[] = (fullTraining.outcomes || []).map((o: any, index: number) => ({
              id: o.id,
              training_id: o.training_id,
              outcome_text: o.outcome_text || '',
              order_index: o.order_index ?? index,
              created_at: o.created_at
            }));
            
            this.newTraining = {
              title: fullTraining.title,
              description: fullTraining.description,
              category: fullTraining.category,
              level: fullTraining.level,
              duration_hours: fullTraining.duration_hours,
              cost_type: fullTraining.cost_type,
              price: fullTraining.price || 0,
              mode: fullTraining.mode,
              provider_name: fullTraining.provider_name,
              has_certificate: fullTraining.has_certificate,
              thumbnail_url: fullTraining.thumbnail_url || '',
              location: fullTraining.location || '',
              application_deadline: fullTraining.application_deadline 
                ? this.datePipe.transform(fullTraining.application_deadline, 'yyyy-MM-dd') || '' 
                : '',
              start_date: fullTraining.start_date
                ? this.datePipe.transform(fullTraining.start_date, 'yyyy-MM-dd') || '' 
                : '',
              end_date: fullTraining.end_date
                ? this.datePipe.transform(fullTraining.end_date, 'yyyy-MM-dd') || '' 
                : '',
              max_participants: fullTraining.max_participants || 30,
              sessions: mappedSessions,
              outcomes: mappedOutcomes
            };
            
            if (fullTraining.thumbnail_url) {
              this.thumbnailPreview = fullTraining.thumbnail_url;
            }
            
            this.showAddForm = true;
            this.error = null;
          }
        },
        error: (error) => {
          console.error('❌ Error loading training details:', error);
          this.error = 'Failed to load training details for editing';
        }
      });
  }

  private formatDateTimeLocal(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  deleteTraining(trainingId: string): void {
    if (confirm('Are you sure you want to delete this training? This action cannot be undone.')) {
      this.trainingService.deleteTraining(trainingId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
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
        sessions: training.sessions || [],
        outcomes: training.outcomes || []
      };
      
      this.trainingService.createTraining(duplicatedTraining)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
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

  /**
   * Regenerate meeting if it was lost/deleted
   */
  regenerateMeeting(training: Training): void {
    if (!training.id) {
      alert('❌ Invalid training');
      return;
    }
    
    alert('⚠️ Meeting regeneration is handled automatically when you edit sessions.\n\nTo update meeting links:\n1. Click "Edit" on the training\n2. Update session details\n3. Save changes\n\nNew Dyte meeting links will be generated automatically.');
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================
  
  publishTraining(training: Training): void {
    if (confirm('Publish this training? Applications will open to jobseekers.')) {
      this.trainingService.publishTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
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
    if (confirm('Unpublish this training? It will no longer be visible to jobseekers.')) {
      this.trainingService.unpublishTraining(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
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

  closeApplications(training: Training): void {
    if (confirm('Close applications for this training? You can then shortlist candidates.')) {
      this.trainingService.closeApplications(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
              alert('Applications closed. You can now review and shortlist candidates.');
            }
          },
          error: (error) => {
            console.error('Error closing applications:', error);
            this.error = 'Failed to close applications. Please try again.';
          }
        });
    }
  }

  startTrainingProgram(training: Training): void {
    if (confirm('Start this training program? Sessions will begin as scheduled.')) {
      this.trainingService.startTrainingProgram(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
              alert('Training program started!');
            }
          },
          error: (error) => {
            console.error('Error starting training:', error);
            this.error = 'Failed to start training. Please try again.';
          }
        });
    }
  }

  completeTrainingProgram(training: Training): void {
    if (confirm('Mark this training program as completed? Certificates can then be issued.')) {
      this.trainingService.completeTrainingProgram(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.lastDataFetch = new Date(0);
              this.loadTrainings();
              alert('Training program completed! You can now issue certificates.');
            }
          },
          error: (error) => {
            console.error('Error completing training:', error);
            this.error = 'Failed to complete training. Please try again.';
          }
        });
    }
  }

  // ============================================
  // APPLICATION MANAGEMENT
  // ============================================
  
  viewApplications(training: Training): void {
    console.log('Viewing applications for training:', training.id);
    
    this.selectedTraining = training;
    this.showApplicationsModal = true;
    
    this.trainingService.getApplications(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            if (Array.isArray(response.data)) {
              this.applications = response.data;
            } else if (response.data.applications) {
              this.applications = response.data.applications;
            } else {
              this.applications = response.data;
            }
            console.log('✅ Applications loaded:', this.applications.length);
          } else {
            this.applications = [];
            this.error = 'Failed to load applications.';
          }
        },
        error: (error) => {
          console.error('❌ Error loading applications:', error);
          this.error = 'Failed to load applications.';
          this.applications = [];
        }
      });
  }

  closeApplicationsModal(): void {
    this.showApplicationsModal = false;
    this.selectedTraining = null;
    this.applications = [];
    this.selectedApplications.clear();
  }

  toggleApplicationSelection(applicationId: string): void {
    if (this.selectedApplications.has(applicationId)) {
      this.selectedApplications.delete(applicationId);
    } else {
      this.selectedApplications.add(applicationId);
    }
  }

  shortlistSelected(): void {
    if (this.selectedApplications.size === 0) {
      alert('Please select applications to shortlist');
      return;
    }

    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }

    if (confirm(`Shortlist ${this.selectedApplications.size} applicant(s)?`)) {
      const promises: Promise<any>[] = [];
      
      this.selectedApplications.forEach(appId => {
        const promise = this.trainingService.shortlistApplicant(
          this.selectedTraining!.id,
          appId,
          'shortlisted'
        ).toPromise();
        promises.push(promise);
      });

      Promise.all(promises).then(() => {
        alert('Applicants shortlisted successfully!');
        this.viewApplications(this.selectedTraining!);
        this.selectedApplications.clear();
      }).catch(error => {
        console.error('Error shortlisting applicants:', error);
        alert('Failed to shortlist some applicants. Please try again.');
      });
    }
  }

  rejectSelected(): void {
    if (this.selectedApplications.size === 0) {
      alert('Please select applications to reject');
      return;
    }

    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }

    if (confirm(`Reject ${this.selectedApplications.size} applicant(s)?`)) {
      const promises: Promise<any>[] = [];
      
      this.selectedApplications.forEach(appId => {
        const promise = this.trainingService.shortlistApplicant(
          this.selectedTraining!.id,
          appId,
          'rejected'
        ).toPromise();
        promises.push(promise);
      });

      Promise.all(promises).then(() => {
        alert('Applicants rejected successfully!');
        this.viewApplications(this.selectedTraining!);
        this.selectedApplications.clear();
      }).catch(error => {
        console.error('Error rejecting applicants:', error);
        alert('Failed to reject some applicants. Please try again.');
      });
    }
  }

  enrollShortlisted(app: TrainingApplication): void {
    if (!this.selectedTraining) return;
    
    const isAlreadyEnrolled = app.enrollment_id || app.status === 'enrolled';
    
    if (isAlreadyEnrolled) {
      alert('✅ This applicant is already enrolled in the training!');
      return;
    }
    
    const applicantName = `${app.user?.first_name || ''} ${app.user?.last_name || ''}`.trim() || 'this applicant';
    
    if (confirm(`Enroll ${applicantName} in this training?\n\nThey will officially become a trainee and receive access to training sessions.`)) {
      this.isLoading = true;
      
      this.trainingService.enrollShortlistedApplicant(
        this.selectedTraining.id,
        app.id!
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading = false;
            
            if (response.success) {
              alert(`✅ ${applicantName} has been successfully enrolled!`);
              
              if (response.data && response.data.enrollment) {
                app.enrollment_id = response.data.enrollment.id;
                app.enrollment_status = 'enrolled';
              } else if (response.data) {
                app.enrollment_id = response.data.id;
                app.enrollment_status = 'enrolled';
              }
              
              this.viewApplications(this.selectedTraining!);
              
              this.lastDataFetch = new Date(0);
              this.lastNotificationFetch = new Date(0);
            } else {
              if (response.message?.includes('already enrolled')) {
                alert('ℹ️ This applicant is already enrolled in the training.');
                this.viewApplications(this.selectedTraining!);
              } else {
                alert('❌ ' + (response.message || 'Failed to enroll applicant'));
              }
            }
          },
          error: (error) => {
            this.isLoading = false;
            console.error('❌ Error enrolling applicant:', error);
            
            let errorMessage = 'Failed to enroll applicant';
            
            if (error.message) {
              if (error.message.includes('duplicate') || error.message.includes('already enrolled')) {
                errorMessage = 'This applicant is already enrolled in the training';
              } else if (error.message.includes('capacity')) {
                errorMessage = 'Training is at full capacity';
              } else {
                errorMessage = error.message;
              }
            }
            
            alert('❌ ' + errorMessage);
            this.viewApplications(this.selectedTraining!);
          }
        });
    }
  }

  quickShortlist(app: TrainingApplication): void {
    if (!this.selectedTraining) return;
    
    if (confirm(`Shortlist ${app.user?.first_name} ${app.user?.last_name}?`)) {
      this.trainingService.shortlistApplicant(
        this.selectedTraining.id,
        app.id!,
        'shortlisted'
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            alert('Applicant shortlisted successfully!');
            this.viewApplications(this.selectedTraining!);
          },
          error: (error) => {
            console.error('Error shortlisting applicant:', error);
            alert('Failed to shortlist applicant');
          }
        });
    }
  }

  quickReject(app: TrainingApplication): void {
    if (!this.selectedTraining) return;
    
    if (confirm(`Reject ${app.user?.first_name} ${app.user?.last_name}?`)) {
      this.trainingService.shortlistApplicant(
        this.selectedTraining.id,
        app.id!,
        'rejected'
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            alert('Applicant rejected');
            this.viewApplications(this.selectedTraining!);
          },
          error: (error) => {
            console.error('Error rejecting applicant:', error);
            alert('Failed to reject applicant');
          }
        });
    }
  }

  // ============================================
  // ENROLLMENT MANAGEMENT
  // ============================================
  // Optimistic/loading states
  isLoadingEnrollments: Record<string, boolean> = {};
  isProcessingEnrollment: Record<string, boolean> = {};

  viewEnrollments(training: Training): void {
    console.log('Viewing enrollments for training:', training.id);
    
    this.selectedTraining = training;
    this.showEnrollmentsModal = true;
    this.isLoadingEnrollments[training.id] = true;

    this.trainingService.getTrainingEnrollments(training.id, { page: 1, limit: 50 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoadingEnrollments[training.id] = false;
          // handle normalized response from service
          if (response && response.success && response.data) {
            this.enrollments = response.data.enrollments || [];
            console.log('Enrollments loaded:', this.enrollments.length);
            return;
          }

          // fallback: backend may return enrollments at top-level
          if (response && (response as any).enrollments) {
            this.enrollments = (response as any).enrollments;
            console.log('Enrollments loaded (fallback):', this.enrollments.length);
            return;
          }

          this.enrollments = [];
        },
        error: (error) => {
          this.isLoadingEnrollments[training.id] = false;
          console.error('Error loading enrollments:', error);
          this.error = 'Failed to load enrollments.';
          this.enrollments = [];
        }
      });
  }

  closeEnrollmentsModal(): void {
    this.showEnrollmentsModal = false;
    this.selectedTraining = null;
    this.enrollments = [];
  }

  markCompletion(enrollment: any, completed: boolean): void {
    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }

    const action = completed ? 'complete' : 'incomplete';
    if (confirm(`Mark this trainee as ${action}?`)) {
      // optimistic UI
      this.isProcessingEnrollment[enrollment.id] = true;
      this.trainingService.markCompletion(
        this.selectedTraining.id,
        enrollment.id,
        completed
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isProcessingEnrollment[enrollment.id] = false;
            if (response.success) {
              enrollment.completed = completed;
              alert(`Trainee marked as ${action}!`);
            }
          },
          error: (error) => {
            this.isProcessingEnrollment[enrollment.id] = false;
            console.error('Error updating completion:', error);
            alert('Failed to update completion status.');
          }
        });
    }
  }

  issueCertificate(enrollment: any): void {
    if (confirm('Issue certificate for this trainee?')) {
      this.isProcessingEnrollment[enrollment.id] = true;
      this.trainingService.issueCertificate(this.selectedTraining!.id, enrollment.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isProcessingEnrollment[enrollment.id] = false;
            if (response.success) {
              enrollment.certificate_issued = true;
              alert('Certificate issued successfully! Trainee will be notified.');
            }
          },
          error: (error) => {
            this.isProcessingEnrollment[enrollment.id] = false;
            console.error('Error issuing certificate:', error);
            alert('Failed to issue certificate. Please try again.');
          }
        });
    }
  }

  // ============================================
  // TRAINING DETAILS
  // ============================================
  
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
    this.selectedTraining = null;
  }

  // ============================================
  // CLOUDFLARE REALTIME MEETING METHODS
  // ============================================
  
  /**
   * Start meeting as moderator (Cloudflare Realtime)
   */
  startMeeting(session: TrainingSession): void {
    if (!session.meeting_url) {
      alert('❌ No meeting link available for this session');
      return;
    }

    if (!session.id) {
      alert('❌ Invalid session');
      return;
    }

    console.log('🎥 Starting Dyte meeting for session:', session.id);
    this.isLoading = true;

    // Call backend to get iframe URL (employers only)
    this.trainingService.getSessionIframeUrl(session.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response.success && response.data?.iframeUrl) {
            // Assign only known TrainingSession properties
            this.currentSession = { ...session };
            
            // Set iframe URL directly
            this.meetingIframeUrl = response.data.iframeUrl;
            
            this.showMeetingModal = true;
            console.log('✅ Dyte meeting ready');
          } else {
            alert('❌ Failed to start meeting - Invalid response');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error starting Dyte meeting:', error);
          
          let errorMessage = 'Failed to start meeting';
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.error) {
            errorMessage = error.error.error;
          }
          
          alert('❌ ' + errorMessage);
        }
      });
  }

  /**
   * Extract meeting ID from Cloudflare Realtime URL
   */
  private extractMeetingIdFromUrl(url: string): string | null {
    try {
      // Dyte URL format: https://app.dyte.io/meeting?id=meetingId
      const urlObj = new URL(url);
      const meetingId = urlObj.searchParams.get('id');
      return meetingId;
    } catch {
      return null;
    }
  }

  /**
   * Close meeting modal
   */
  closeMeetingModal(): void {
    this.showMeetingModal = false;
    this.meetingIframeUrl = null;
    this.currentSession = null;
  }

  /**
   * Copy meeting link to clipboard (with full meeting info)
   */
  copyMeetingLink(session: TrainingSession): void {
    if (!session || !session.meeting_url) {
      alert('❌ No meeting link available');
      return;
    }

    // Create meeting info text
    const meetingInfo = `
Training Session: ${session.title}
Date: ${this.datePipe.transform(session.scheduled_at, 'full')}
Duration: ${session.duration_minutes} minutes

Meeting Link: ${session.meeting_url}
Meeting Password: ${session.meeting_password || 'N/A'}

Instructions:
1. Click the meeting link to join
2. Enter your name when prompted
3. If asked for password, use: ${session.meeting_password || 'N/A'}
4. Employers/Trainers join as moderators
5. Jobseekers join as participants

Join via browser - no installation required!
Powered by Dyte
    `.trim();

    navigator.clipboard.writeText(meetingInfo).then(() => {
      const notification = document.createElement('div');
      notification.className = 'copy-success-notification';
      notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
          <strong>Meeting details copied!</strong>
          <small style="display: block; font-size: 0.8rem; opacity: 0.9;">
            Link and password copied to clipboard
          </small>
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => notification.classList.add('show'), 10);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 4000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('❌ Failed to copy meeting details. Please copy manually.');
    });
  }

  // ============================================
  // FORM VALIDATION
  // ============================================
  
  isFormValid(): boolean {
    const basicValidation = !!(
      this.newTraining.title &&
      this.newTraining.description &&
      this.newTraining.category &&
      this.newTraining.level &&
      this.newTraining.duration_hours > 0 &&
      this.newTraining.provider_name &&
      this.newTraining.application_deadline &&
      this.newTraining.start_date &&
      this.newTraining.end_date
    );
   
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      return false;
    }
   
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      return false;
    }
   
    const appDeadline = new Date(this.newTraining.application_deadline);
    const startDate = new Date(this.newTraining.start_date);
    const endDate = new Date(this.newTraining.end_date);
    
    if (appDeadline >= startDate) {
      return false;
    }
    
    if (startDate >= endDate) {
      return false;
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
    if (!this.newTraining.application_deadline) errors.push('Application deadline is required');
    if (!this.newTraining.start_date) errors.push('Training start date is required');
    if (!this.newTraining.end_date) errors.push('Training end date is required');
    
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      errors.push('Price must be greater than 0 for paid trainings');
    }
    
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      errors.push('Location is required for offline trainings');
    }
    
    if (this.newTraining.application_deadline && this.newTraining.start_date) {
      const appDeadline = new Date(this.newTraining.application_deadline);
      const startDate = new Date(this.newTraining.start_date);
      if (appDeadline >= startDate) {
        errors.push('Application deadline must be before training start date');
      }
    }
    
    if (this.newTraining.start_date && this.newTraining.end_date) {
      const startDate = new Date(this.newTraining.start_date);
      const endDate = new Date(this.newTraining.end_date);
      if (startDate >= endDate) {
        errors.push('Training end date must be after start date');
      }
    }
    
    return errors;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
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
      case 'published': return 'Open for Applications';
      case 'draft': return 'Draft';
      case 'applications_closed': return 'Applications Closed';
      case 'in_progress': return 'In Progress';
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

  onSearch(searchTerm: string): void {
    this.searchSubject$.next(searchTerm);
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
    }
    this.searchParams.page = 1;
    
    this.lastDataFetch = new Date(0);
    this.loadTrainings();
  }

  onPageChange(page: number): void {
    this.searchParams.page = page;
    this.lastDataFetch = new Date(0);
    this.loadTrainings();
  }
}