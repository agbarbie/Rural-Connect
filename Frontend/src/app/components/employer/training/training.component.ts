// employer-training.component.ts - BOOTCAMP MODEL (Fixed Method Signatures)
import { Component, OnInit, OnDestroy, Inject, forwardRef } from '@angular/core';
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
  TrainingSession,
  TrainingOutcome,
  TrainingApplication,
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
  application_deadline: string;
  training_start_date: string;
  training_end_date: string;
  max_participants: number;
  sessions: TrainingSession[];
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
    training_start_date: '',
    training_end_date: '',
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

  constructor(
    @Inject(forwardRef(() => TrainingService)) private trainingService: TrainingService,
    private http: HttpClient,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    console.log('🚀 Initializing Training Component (Bootcamp Model)...');
   
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
  // COMPUTED PROPERTIES
  // ============================================
  
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

  get totalTrainingsCount(): number {
    return this.trainings.length;
  }

  get totalSessionsCount(): number {
    return this.trainings.reduce((sum, t) => {
      const sessionCount = t.sessions?.length || t.session_count || 0;
      return sum + sessionCount;
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

  // ============================================
  // DATA LOADING
  // ============================================
  
  loadTrainings(): void {
    // ✅ FIXED: getMyTrainings expects (params, employerId) - include employerId as second argument
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
   
    // ✅ FIXED: getTrainingStats expects no arguments
    this.trainingService.getTrainingStats()
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
      total_enrollments: this.totalCompletions,
      total_revenue: this.totalRevenue,
      avg_rating: this.averageRating,
      completion_rate: 0,
      certificates_issued: 0,
      total_applications: 0,
      pending_applications: 0,
      categories_breakdown: this.getCategoriesBreakdown()
    };
   
    this.stats = computedStats as TrainingStats;
  }

  private getCategoriesBreakdown(): any[] {
    const categoriesMap = new Map<string, {
      count: number;
      total_revenue: number;
      rating_sum: number;
      rating_count: number;
      sessions: number;
      enrollments: number;
    }>();

    this.trainings.forEach(t => {
      const category = t.category || 'Uncategorized';
      const existing = categoriesMap.get(category) || {
        count: 0,
        total_revenue: 0,
        rating_sum: 0,
        rating_count: 0,
        sessions: 0,
        enrollments: 0
      };

      existing.count += 1;

      if (t.cost_type === 'Paid') {
        const price = Number(t.price) || 0;
        const students = Number(t.total_students) || 0;
        existing.total_revenue += price * students;
      }

      if (typeof t.rating === 'number' && !isNaN(t.rating)) {
        existing.rating_sum += t.rating;
        existing.rating_count += 1;
      }

      existing.sessions += (Array.isArray(t.sessions) ? t.sessions.length : (Number(t.session_count) || 0));
      existing.enrollments += Number(t.total_students) || 0;

      categoriesMap.set(category, existing);
    });

    return Array.from(categoriesMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      total_revenue: Math.round(data.total_revenue * 100) / 100,
      avg_rating: data.rating_count ? Math.round((data.rating_sum / data.rating_count) * 10) / 10 : 0,
      sessions: data.sessions,
      enrollments: data.enrollments
    })).sort((a, b) => b.count - a.count);
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================
  
  loadNotifications(): void {
    // ✅ FIXED: getNotifications expects (params?) - removed employerId and role parameters
    this.trainingService.getNotifications({ read: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📢 Enrollment notifications:', response.data?.length || 0);
          
          if (response.success && response.data) {
            this.enrollmentNotifications = (response.data.notifications || response.data).map((n: any) => ({
              ...n,
              display_name: n.jobseeker_name || `${n.first_name || ''} ${n.last_name || ''}`.trim() || 
                            (n.email ? n.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Anonymous User')
            }));
            
            this.unreadNotificationCount = this.enrollmentNotifications.filter(
              (n: any) => !n.is_read && n.notification_type === 'new'
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

  getJobseekerDisplayName(notification: any): string {
    let name = notification.display_name || notification.jobseeker_name || '';
    if (!name || name === 'Anonymous User') {
      name = notification.email ? notification.email.split('@')[0].replace(/[_.-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Anonymous User';
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  canIssueCertificate(notification: any): boolean {
    return notification.notification_type === 'completed' && 
           notification.progress_percentage === 100 && 
           !notification.certificate_issued;
  }

  issueCertificateFromNotification(notification: any): void {
    if (!notification.enrollment_id) {
      alert('No enrollment ID available');
      return;
    }

    if (confirm(`Issue certificate to ${this.getJobseekerDisplayName(notification)} for "${notification.training_title}"?`)) {
      // ✅ FIXED: issueCertificate expects (trainingId, enrollmentId) - removed employerId parameter
      this.trainingService.issueCertificate(notification.training_id, notification.enrollment_id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              alert('Certificate issued successfully! Trainee notified.');
              notification.certificate_issued = true;
              this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
              this.loadNotifications();
            }
          },
          error: (error) => {
            console.error('Error issuing certificate:', error);
            alert('Failed to issue certificate: ' + (error.message || 'Try again'));
          }
        });
    }
  }

  downloadEmployerCertificate(enrollmentId: string): void {
    if (!enrollmentId) {
      alert('No enrollment ID available');
      return;
    }
    
    this.trainingService.downloadCertificate(enrollmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (blob.size > 0) {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `certificate-${enrollmentId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          } else {
            alert('Empty file – ask to re-issue.');
          }
        },
        error: (error) => {
          console.error('❌ Download failed:', error);
          alert(`Download failed: ${error?.message || 'File not found'}`);
        }
      });
  }

  viewStudentProfile(notification: any): void {
    console.log('Viewing student profile:', notification.user_id);
    alert(`View profile for ${this.getJobseekerDisplayName(notification)}`);
  }

  markAllEnrollmentNotificationsRead(): void {
    if (!confirm('Mark all enrollment notifications as read?')) return;

    this.enrollmentNotifications.forEach(n => n.is_read = true);
    this.unreadNotificationCount = 0;
  }

  loadMoreEnrollmentNotifications(): void {
    if (this.loadingNotifications) return;

    this.loadingNotifications = true;
    this.notificationsPage += 1;

    // ✅ FIXED: getNotifications expects (params?) - removed employerId and role parameters
    this.trainingService.getNotifications({ read: undefined })
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
      training_start_date: '',
      training_end_date: '',
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
  // SESSION MANAGEMENT
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
    this.showSessionForm = true;
  }

  addSession(): void {
    console.log('📅 addSession called');

    if (!this.newSession.title || !this.newSession.scheduled_at) {
      alert('Please fill in session title and schedule');
      return;
    }

    if (!this.selectedTraining && !this.editingTrainingId) {
      console.log('📅 Adding session to NEW training form array');
      
      this.newTraining.sessions.push({ 
        ...this.newSession,
        order_index: this.newTraining.sessions.length 
      });
      
      console.log('✅ Session added to form array. Total sessions:', this.newTraining.sessions.length);
      this.toggleSessionForm();
      return;
    }

    if (this.selectedTraining) {
      console.log('📅 Adding session to EXISTING training via API');
      this.saveSession();
      return;
    }

    alert('Cannot add session: Please save the training first.');
  }

  removeSession(index: number): void {
    this.newTraining.sessions.splice(index, 1);
    this.newTraining.sessions.forEach((session, i) => {
      session.order_index = i;
    });
  }

  openSessionForm(training?: Training, session?: TrainingSession): void {
    if (training) {
      this.selectedTraining = training;
      
      if (session) {
        this.editingSessionId = session.id || null;
        this.newSession = { ...session };
      } else {
        this.resetSessionForm();
        this.newSession.order_index = training.sessions?.length || 0;
      }
    } else {
      this.selectedTraining = null;
      this.resetSessionForm();
      this.newSession.order_index = this.newTraining.sessions.length;
    }
   
    this.showSessionForm = true;
  }

  saveSession(): void {
    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }

    if (!this.selectedTraining.id || this.selectedTraining.id === 'undefined') {
      console.error('❌ Invalid training ID:', this.selectedTraining.id);
      alert('Cannot add session: Training ID is invalid. Please save the training first.');
      return;
    }

    const title = this.newSession.title ? this.newSession.title.trim() : '';
    
    if (!title || !this.newSession.scheduled_at) {
      alert('Please fill in all required fields (title and schedule)');
      return;
    }

    console.log('💾 Saving session to training:', {
      trainingId: this.selectedTraining.id,
      sessionTitle: title,
      isEditing: !!this.editingSessionId
    });

    if (this.editingSessionId) {
      // Update existing session (if API supports it)
      alert('Session update not yet implemented');
    } else {
      // Add new session (if API supports it)
      alert('Session creation not yet implemented - sessions are created with training');
    }
  }

  deleteSession(trainingId: string, sessionId: string): void {
    if (confirm('Are you sure you want to delete this session?')) {
      alert('Session deletion not yet implemented');
    }
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
  // TRAINING CRUD
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
    eligibility_requirements: undefined,
    application_deadline: this.newTraining.application_deadline || undefined,
    
    // Use training_start_date and training_end_date to match UpdateTrainingRequest
    training_start_date: this.newTraining.training_start_date || undefined,
    training_end_date: this.newTraining.training_end_date || undefined,
    
    max_participants: this.newTraining.max_participants || undefined,
    
    sessions: this.newTraining.sessions.map((s, index) => ({
      ...s,
      order_index: index
    })),
    outcomes: this.newTraining.outcomes.map((o, index) => ({
      ...o,
      order_index: index
    }))
  };

  console.log('📦 Training payload:', {
    ...baseData,
    sessionCount: baseData.sessions?.length || 0,
    outcomeCount: baseData.outcomes?.length || 0
  });

  if (this.editingTrainingId) {
    console.log('🔄 Updating training:', this.editingTrainingId);
    this.trainingService.updateTraining(this.editingTrainingId, baseData)
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
    
    this.trainingService.createTraining(trainingData)
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
            alert('Training created successfully with sessions and outcomes!');
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
      application_deadline: training.application_deadline ? this.datePipe.transform(training.application_deadline, 'yyyy-MM-dd') || '' : '',
      training_start_date: training.training_start_date ? this.datePipe.transform(training.training_start_date, 'yyyy-MM-dd') || '' : '',
      training_end_date: training.training_end_date ? this.datePipe.transform(training.training_end_date, 'yyyy-MM-dd') || '' : '',
      max_participants: training.max_participants || 30,
      sessions: training.sessions || [],
      outcomes: training.outcomes || []
    };
    if (training.thumbnail_url) {
      this.thumbnailPreview = training.thumbnail_url;
    }
    this.showAddForm = true;
    this.error = null;
  }

  deleteTraining(trainingId: string): void {
    if (confirm('Are you sure you want to delete this training? This action cannot be undone.')) {
      // ✅ FIXED: deleteTraining expects (id) - removed employerId parameter
      this.trainingService.deleteTraining(trainingId)
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
      // ✅ FIXED: createTraining expects (trainingData) - removed employerId parameter
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
    if (confirm('Unpublish this training? It will no longer be visible to jobseekers.')) {
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

  closeApplications(training: Training): void {
    if (confirm('Close applications for this training? You can then shortlist candidates.')) {
      this.trainingService.closeApplications(training.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.loadStats();
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
              this.loadStats();
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
              this.loadStats();
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
    
    // ✅ FIXED: getApplications expects (trainingId, params?) - removed employerId parameter
    this.trainingService.getApplications(training.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.applications = response.data;
            console.log('Applications loaded:', this.applications.length);
          }
        },
        error: (error) => {
          console.error('Error loading applications:', error);
          this.error = 'Failed to load applications.';
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
        // ✅ FIXED: shortlistApplicant expects (trainingId, applicationId, decision, employer_notes?) - removed employerId parameter
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
        // ✅ FIXED: shortlistApplicant expects (trainingId, applicationId, decision, employer_notes?) - removed employerId parameter
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

  // ============================================
  // ENROLLMENT MANAGEMENT
  // ============================================
  
  viewEnrollments(training: Training): void {
    console.log('Viewing enrollments for training:', training.id);
    
    this.selectedTraining = training;
    this.showEnrollmentsModal = true;
    
    // ✅ FIXED: getTrainingEnrollments expects (id, params?) - removed employerId parameter
    this.trainingService.getTrainingEnrollments(training.id, { page: 1, limit: 50 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.enrollments = response.data.enrollments || response.data;
            console.log('Enrollments loaded:', this.enrollments.length);
          }
        },
        error: (error) => {
          console.error('Error loading enrollments:', error);
          this.error = 'Failed to load enrollments.';
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
      // ✅ FIXED: markCompletion expects (trainingId, enrollmentId, completed, employer_notes?) - removed employerId parameter
      this.trainingService.markCompletion(
        this.selectedTraining.id,
        enrollment.id,
        completed
      ).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              enrollment.completed = completed;
              alert(`Trainee marked as ${action}!`);
              if (completed) {
                alert('You can now issue a certificate for this trainee.');
              }
            }
          },
          error: (error) => {
            console.error('Error updating completion:', error);
            alert('Failed to update completion status.');
          }
        });
    }
  }

  issueCertificate(enrollment: any): void {
    if (!enrollment.completed) {
      alert('Trainee must complete the training first');
      return;
    }

    if (confirm('Issue certificate for this trainee?')) {
      // ✅ FIXED: issueCertificate expects (trainingId, enrollmentId) - removed employerId parameter
      this.trainingService.issueCertificate(this.selectedTraining!.id, enrollment.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              enrollment.certificate_issued = true;
              alert('Certificate issued successfully! Trainee will be notified.');
            }
          },
          error: (error) => {
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
      this.newTraining.training_start_date &&
      this.newTraining.training_end_date
    );
   
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      return false;
    }
   
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      return false;
    }
   
    const appDeadline = new Date(this.newTraining.application_deadline);
    const startDate = new Date(this.newTraining.training_start_date);
    const endDate = new Date(this.newTraining.training_end_date);
    
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
    if (!this.newTraining.training_start_date) errors.push('Training start date is required');
    if (!this.newTraining.training_end_date) errors.push('Training end date is required');
   
    if (this.newTraining.cost_type === 'Paid' && this.newTraining.price <= 0) {
      errors.push('Price must be greater than 0 for paid trainings');
    }
   
    if (this.newTraining.mode === 'Offline' && !this.newTraining.location?.trim()) {
      errors.push('Location is required for offline trainings');
    }
   
    if (this.newTraining.application_deadline && this.newTraining.training_start_date) {
      const appDeadline = new Date(this.newTraining.application_deadline);
      const startDate = new Date(this.newTraining.training_start_date);
      if (appDeadline >= startDate) {
        errors.push('Application deadline must be before training start date');
      }
    }
    
    if (this.newTraining.training_start_date && this.newTraining.training_end_date) {
      const startDate = new Date(this.newTraining.training_start_date);
      const endDate = new Date(this.newTraining.training_end_date);
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
    }
    this.searchParams.page = 1;
    this.loadTrainings();
  }

  onPageChange(page: number): void {
    this.searchParams.page = page;
    this.loadTrainings();
  }
}