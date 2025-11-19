import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, interval, merge } from 'rxjs';
import { JobService, Job, CreateJobRequest, JobStats } from '../../../../../services/job.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-post-jobs',
  templateUrl: './post-jobs.component.html',
  styleUrls: ['./post-jobs.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, SidebarComponent]
})
export class PostJobsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private autoRefreshInterval$ = new Subject<void>();
  
  employerName: string = 'TechCorp Solutions';
  jobForm: FormGroup;
  jobPosts: Job[] = [];
  filteredJobPosts: Job[] = [];
  
  jobStats: JobStats = {
    overview: {
      total_jobs: 0,
      active_jobs: 0,
      filled_jobs: 0,
      paused_jobs: 0,
      closed_jobs: 0,
      total_applications: 0,
      total_views: 0,
      avg_applications_per_job: '0',
      avg_views_per_job: '0',
      featured_jobs_count: 0,
      remote_jobs_count: 0,
      hybrid_jobs_count: 0
    },
    recent_activity: {
      jobs_posted_last_30_days: 0,
      applications_last_30_days: 0
    },
    top_performing_jobs: [],
    application_status_breakdown: {
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      interviewed: 0,
      offered: 0,
      hired: 0,
      rejected: 0
    }
  };
  
  searchQuery: string = '';
  toasts: Notification[] = [];
  jobNotifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  lastNotificationCheck: Date = new Date();
  showAddForm: boolean = false;
  showJobDetails: boolean = false;
  selectedJob: Job | null = null;
  
  // Loading states
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  isDeleting: string | null = null;
  isToggling: string | null = null;
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  totalJobs: number = 0;
  
  // 🔥 Auto-refresh with enhanced notification
  autoRefreshEnabled: boolean = true;
  lastRefreshTime: Date = new Date();
  newApplicationsDetected: number = 0;

  constructor(
    private fb: FormBuilder,
    private jobService: JobService,
    private router: Router
  ) {
    this.jobForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      requirements: [''],
      responsibilities: [''],
      location: ['', [Validators.required]],
      employment_type: ['', [Validators.required]],
      work_arrangement: ['', [Validators.required]],
      salary_min: [''],
      salary_max: [''],
      currency: ['USD'],
      skills_required: ['', [Validators.required]],
      experience_level: [''],
      education_level: [''],
      benefits: [''],
      department: [''],
      application_deadline: [''],
      is_featured: [false]
    });
  }

  ngOnInit(): void {
    console.log('🚀 PostJobsComponent initialized');
    this.jobService.debugAuthInfo();
    
    this.loadJobPosts();
    this.loadJobStats();
    
    // 🔥 CRITICAL: Listen for real-time application updates
    this.subscribeToApplicationUpdates();
    
    // 🔥 Start auto-refresh with shorter interval (20 seconds for better responsiveness)
    this.startAutoRefresh();

    // ✅ NEW: Load notifications
    this.loadNotifications();

    // ✅ NEW: Auto-refresh notifications every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔔 Auto-refreshing notifications...');
        this.loadNotifications();
      });

    // ✅ NEW: Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.autoRefreshInterval$.next();
    this.autoRefreshInterval$.complete();
  }

  /**
   * 🔥 NEW: Subscribe to real-time application updates from JobService
   */
  subscribeToApplicationUpdates(): void {
    console.log('🔔 Subscribing to application updates...');
    
    this.jobService.applicationUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        if (!update) return;
        
        console.log('🔔 Received application update:', update);
        
        // Find and update the specific job
        const jobIndex = this.jobPosts.findIndex(j => j.id === update.jobId);
        
        if (jobIndex !== -1) {
          const previousCount = this.jobPosts[jobIndex].applications_count;
          
          // Update the job in the list
          this.jobPosts[jobIndex] = {
            ...this.jobPosts[jobIndex],
            applications_count: update.count
          };
          
          this.filteredJobPosts = [...this.jobPosts];
          
          // Calculate new applications
          const newApps = update.count - previousCount;
          
          if (newApps > 0) {
            this.newApplicationsDetected += newApps;
            
            console.log(`✅ Updated job "${this.jobPosts[jobIndex].title}" - New applications: ${newApps}`);
            
            // Show notification
            this.addNotification(
              `🎉 ${newApps} new application${newApps > 1 ? 's' : ''} for "${this.jobPosts[jobIndex].title}"`,
              'success'
            );
            
            // Update stats
            this.loadJobStats();
          }
          
          // Update selected job if it's the one being viewed
          if (this.selectedJob && this.selectedJob.id === update.jobId) {
            this.selectedJob = { ...this.jobPosts[jobIndex] };
          }
        }
      });
  }

  /**
   * 🔥 UPDATED: Enhanced auto-refresh with better detection
   */
  startAutoRefresh(): void {
    if (!this.autoRefreshEnabled) return;
    
    console.log('🔄 Starting auto-refresh (20s interval)');
    
    // Refresh every 20 seconds for more responsive updates
    interval(20000)
      .pipe(takeUntil(this.autoRefreshInterval$), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.autoRefreshEnabled && !this.isLoading) {
          console.log('🔄 Auto-refreshing job data...');
          this.refreshData();
        }
      });
  }

  /**
   * 🔥 Stop auto-refresh
   */
  stopAutoRefresh(): void {
    console.log('⏸️ Stopping auto-refresh');
    this.autoRefreshInterval$.next();
  }

  /**
   * 🔥 Toggle auto-refresh on/off
   */
  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
      this.addNotification('Auto-refresh enabled (20s)', 'info');
    } else {
      this.stopAutoRefresh();
      this.addNotification('Auto-refresh disabled', 'info');
    }
  }

  /**
   * 🔥 ENHANCED: Manual refresh with visual feedback
   */
  refreshData(): void {
    console.log('🔄 Manual refresh triggered');
    this.loadJobPosts(this.currentPage, true); // Silent refresh
    this.loadJobStats();
    this.lastRefreshTime = new Date();
    
    // Reset new applications counter after manual refresh
    if (this.newApplicationsDetected > 0) {
      console.log(`✅ Acknowledged ${this.newApplicationsDetected} new applications`);
      this.newApplicationsDetected = 0;
    }
  }

  /**
   * 🔥 ENHANCED: Load jobs with better application tracking
   */
  loadJobPosts(page: number = 1, silent: boolean = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    
    this.currentPage = page;
    
    const query = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      search: this.searchQuery || undefined,
      sort_by: 'created_at' as const,
      sort_order: 'DESC' as const
    };

    // Store previous application counts for comparison
    const previousApplicationCounts = new Map(
      this.jobPosts.map(job => [job.id, job.applications_count])
    );

    this.jobService.getMyJobs(query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          if (!silent) {
            this.isLoading = false;
          }
        })
      )
      .subscribe({
        next: (response) => {
          console.log('📦 Jobs response:', response);
          
          if (response.success && response.data) {
            this.jobPosts = response.data.jobs;
            this.filteredJobPosts = [...this.jobPosts];
            this.totalJobs = response.data.pagination.total;
            this.totalPages = response.data.pagination.total_pages;
            this.jobService.updateJobsCache(this.jobPosts);
            
            // 🔥 DETECT NEW APPLICATIONS during refresh
            if (silent && previousApplicationCounts.size > 0) {
              let totalNewApps = 0;
              
              this.jobPosts.forEach(job => {
                const previousCount = previousApplicationCounts.get(job.id) || 0;
                const currentCount = job.applications_count;
                
                if (currentCount > previousCount) {
                  const newApps = currentCount - previousCount;
                  totalNewApps += newApps;
                  
                  console.log(`✅ Detected ${newApps} new application(s) for "${job.title}"`);
                  
                  this.addNotification(
                    `🎉 ${newApps} new application${newApps > 1 ? 's' : ''} for "${job.title}"`,
                    'success'
                  );
                }
              });
              
              if (totalNewApps > 0) {
                this.newApplicationsDetected += totalNewApps;
              }
            }
          } else {
            if (!silent) {
              this.addNotification(response.message || 'Failed to load jobs', 'error');
            }
          }
        },
        error: (error) => {
          console.error('❌ Error loading jobs:', error);
          
          if (!silent) {
            let errorMessage = 'Failed to load job posts. Please try again.';
            
            if (error.status === 401) {
              errorMessage = 'Your session has expired. Please log in again.';
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            }
            
            this.addNotification(errorMessage, 'error');
          }
        }
      });
  }

  loadJobStats(): void {
    this.jobService.getJobStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📊 Stats response:', response);
          if (response.success && response.data) {
            this.jobStats = response.data;
          }
        },
        error: (error) => {
          console.error('❌ Error loading job stats:', error);
          if (error.status === 404) {
            console.warn('Stats endpoint not found - using default values');
          }
        }
      });
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.jobForm.reset();
      this.jobForm.patchValue({ currency: 'USD', is_featured: false });
    }
  }

  onSubmit(): void {
    if (this.jobForm.valid) {
      console.log('📝 Form submission started');
      this.isSubmitting = true;
      
      const formData = { ...this.jobForm.value };
      
      // Process skills_required
      if (typeof formData.skills_required === 'string') {
        formData.skills_required = formData.skills_required
          .split(',')
          .map((skill: string) => skill.trim())
          .filter((skill: string) => skill.length > 0);
      }
      
      // Process benefits
      if (formData.benefits && typeof formData.benefits === 'string') {
        formData.benefits = formData.benefits
          .split(',')
          .map((benefit: string) => benefit.trim())
          .filter((benefit: string) => benefit.length > 0);
      }
      
      // Handle salary values
      if (formData.salary_min) {
        formData.salary_min = Number(formData.salary_min);
      }
      if (formData.salary_max) {
        formData.salary_max = Number(formData.salary_max);
      }
      
      // Remove empty fields
      Object.keys(formData).forEach(key => {
        if (formData[key] === '' || formData[key] === null || formData[key] === undefined) {
          delete formData[key];
        }
      });

      const jobData: CreateJobRequest = formData;
      console.log('📤 Processed job data:', jobData);
      
      this.jobService.createJob(jobData)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isSubmitting = false)
        )
        .subscribe({
          next: (response) => {
            console.log('✅ Job creation response:', response);
            if (response.success && response.data) {
              this.addNotification('Job posted successfully!', 'success');
              this.toggleAddForm();
              this.loadJobPosts();
              this.loadJobStats();
            } else {
              this.addNotification(response.message || 'Failed to create job', 'error');
            }
          },
          error: (error) => {
            console.error('❌ Error creating job:', error);
            let errorMessage = 'Failed to create job. Please try again.';
            
            if (error.status === 403) {
              errorMessage = 'You do not have permission to create jobs.';
            } else if (error.status === 401) {
              errorMessage = 'Your session has expired. Please log in again.';
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            }
            
            this.addNotification(errorMessage, 'error');
          }
        });
    } else {
      this.addNotification('Please fill all required fields correctly.', 'error');
      this.markFormGroupTouched();
    }
  }

  filterJobPosts(): void {
    if (!this.searchQuery.trim()) {
      this.loadJobPosts();
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredJobPosts = this.jobPosts.filter(job =>
      job.title.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query) ||
      job.skills_required.some(skill => skill.toLowerCase().includes(query)) ||
      job.location.toLowerCase().includes(query)
    );
  }

  onSearchSubmit(): void {
    this.loadJobPosts(1);
  }

  viewJobDetails(job: Job): void {
    this.selectedJob = job;
    this.showJobDetails = true;
  }

  closeJobDetails(): void {
    this.showJobDetails = false;
    this.selectedJob = null;
  }

  toggleJobStatus(job: Job): void {
    this.isToggling = job.id;
    
    this.jobService.toggleJobStatus(job.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isToggling = null)
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const updatedJob = response.data;
            const index = this.jobPosts.findIndex(j => j.id === job.id);
            if (index !== -1) {
              this.jobPosts[index] = updatedJob;
              this.filteredJobPosts = [...this.jobPosts];
            }
            
            if (this.selectedJob && this.selectedJob.id === job.id) {
              this.selectedJob = updatedJob;
            }
            
            this.loadJobStats();
            this.addNotification(`Job ${updatedJob.status.toLowerCase()} successfully`, 'info');
          }
        },
        error: (error) => {
          console.error('❌ Error toggling job status:', error);
          this.addNotification('Failed to update job status. Please try again.', 'error');
        }
      });
  }

  deleteJobPost(jobId: string): void {
    const job = this.jobPosts.find(j => j.id === jobId);
    if (!job) return;
    
    const confirmMessage = `Are you sure you want to delete the job "${job.title}"?`;
    if (!confirm(confirmMessage)) return;
    
    this.isDeleting = jobId;
    
    this.jobService.deleteJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isDeleting = null)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.jobPosts = this.jobPosts.filter(j => j.id !== jobId);
            this.filteredJobPosts = [...this.jobPosts];
            
            if (this.showJobDetails && this.selectedJob?.id === jobId) {
              this.closeJobDetails();
            }
            
            this.loadJobStats();
            this.addNotification(`Job "${job.title}" deleted successfully`, 'success');
            
            if (this.filteredJobPosts.length === 0 && this.currentPage > 1) {
              this.loadJobPosts(this.currentPage - 1);
            }
          }
        },
        error: (error) => {
          console.error('❌ Error deleting job:', error);
          this.addNotification('Failed to delete job. Please try again.', 'error');
        }
      });
  }

  duplicateJob(job: Job): void {
    this.jobService.duplicateJob(job.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.addNotification(`Job "${job.title}" duplicated successfully`, 'success');
            this.loadJobPosts();
            this.loadJobStats();
          }
        },
        error: (error) => {
          console.error('❌ Error duplicating job:', error);
          this.addNotification('Failed to duplicate job. Please try again.', 'error');
        }
      });
  }

  markJobAsFilled(job: Job): void {
    this.jobService.markJobAsFilled(job.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const updatedJob = response.data;
            const index = this.jobPosts.findIndex(j => j.id === job.id);
            if (index !== -1) {
              this.jobPosts[index] = updatedJob;
              this.filteredJobPosts = [...this.jobPosts];
            }
            
            this.loadJobStats();
            this.addNotification(`Job "${job.title}" marked as filled`, 'success');
          }
        },
        error: (error) => {
          console.error('❌ Error marking job as filled:', error);
          this.addNotification('Failed to mark job as filled. Please try again.', 'error');
        }
      });
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.loadJobPosts(page);
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

  // Utility methods
  formatSalary(job: Job): string {
    return this.jobService.formatSalary(job.salary_min, job.salary_max, job.currency);
  }

  formatJobType(job: Job): string {
    return this.jobService.formatJobType(job.employment_type, job.work_arrangement);
  }

  getSkillsArray(job: Job): string[] {
    if (Array.isArray(job.skills_required)) {
      return job.skills_required;
    }
    if (typeof job.skills_required === 'string') {
      return (job.skills_required as string).split(',').map((skill: string) => skill.trim());
    }
    return [];
  }

  addNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const id = Date.now().toString();
    this.toasts.push({ id, message, type });
    setTimeout(() => this.dismissToast(id), 5000);
  }

  dismissToast(id: string): void {
    this.toasts = this.toasts.filter(n => n.id !== id);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.jobForm.controls).forEach(key => {
      const control = this.jobForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  // Computed properties
  get activeJobPostsCount(): number {
    return this.jobStats.overview.active_jobs;
  }

  get totalApplicants(): number {
    return this.jobStats.overview.total_applications;
  }

  get totalJobPosts(): number {
    return this.jobStats.overview.total_jobs;
  }

  get featuredJobsCount(): number {
    return this.jobStats.overview.featured_jobs_count;
  }
  
  /**
   * 🔥 Get time since last refresh
   */
  getTimeSinceRefresh(): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - this.lastRefreshTime.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  /**
   * ✅ NEW: Load notifications
   */
loadNotifications(): void {
  this.jobService.getNotifications({ read: false })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const allNotifications = response.data.notifications || [];
          this.jobNotifications = Array.isArray(allNotifications) ? allNotifications : [];
          this.unreadNotificationCount = this.jobNotifications.filter(n => !n.read).length;
        }
      }
    });
}

  /**
   * ✅ NEW: Check for new notifications
   */
  private checkForNewNotifications(): void {
    const newNotifications = this.jobNotifications.filter(n => {
      const notificationDate = new Date(n.created_at);
      return notificationDate > this.lastNotificationCheck && !n.read;
    });

    if (newNotifications.length > 0) {
      console.log('🔔 New notifications detected:', newNotifications.length);

      const importantTypes = [
        'application_received',
        'application_shortlisted',
        'interview_scheduled'
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

  /**
   * ✅ NEW: Get notification icon
   */
getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    // Job notifications (for employers)
    'new_job': 'fa-briefcase',
    'job_updated': 'fa-edit',
    'job_deleted': 'fa-trash-alt',
    'job_closed': 'fa-lock',
    'job_filled': 'fa-user-check',
    'application_received': 'fa-user-plus',  // ✅ EMPLOYER: New application
    
    // Application status (for jobseekers)
    'application_reviewed': 'fa-eye',
    'application_shortlisted': 'fa-star',
    'application_accepted': 'fa-check-circle',
    'application_rejected': 'fa-times-circle',
    
    // Training notifications
    'training_enrollment': 'fa-graduation-cap',
    'training_completed': 'fa-trophy',
    'certificate_issued': 'fa-certificate',
    'training_updated': 'fa-book',
    
    // Interview notifications
    'interview_scheduled': 'fa-calendar',
    
    // Generic
    'test': 'fa-flask',
    'system': 'fa-cog'
  };
  
  return iconMap[type] || 'fa-bell';  // ✅ Default icon instead of fa-info-circle
}

/**
 * ✅ FIXED: Get notification title - comprehensive mapping
 */
getNotificationTitle(type: string): string {
  const titleMap: Record<string, string> = {
    // Job notifications
    'new_job': '💼 New Job Posted',
    'job_updated': '✏️ Job Updated',
    'job_deleted': '🗑️ Job Deleted',
    'job_closed': '🔒 Job Closed',
    'job_filled': '✅ Job Filled',
    'application_received': '📨 New Application',  // ✅ For employers
    
    // Application status (for jobseekers)
    'application_reviewed': '👀 Application Reviewed',
    'application_shortlisted': '⭐ You\'re Shortlisted!',
    'application_accepted': '✅ Application Accepted',
    'application_rejected': '❌ Application Update',
    
    // Training notifications
    'training_enrollment': '🎓 Training Enrollment',
    'training_completed': '🏆 Training Completed',
    'certificate_issued': '📜 Certificate Issued',
    'training_updated': '📚 Training Updated',
    
    // Interview
    'interview_scheduled': '📅 Interview Scheduled',
    
    // Generic
    'test': '🧪 Test Notification',
    'system': '⚙️ System Notification'
  };
  
  return titleMap[type] || 'Notification';
}

/**
 * ✅ FIXED: Handle notification click with proper routing
 */
handleNotificationClick(notification: any): void {
  console.log('📌 Notification clicked:', notification);
  
  if (!notification.read) {
    this.markNotificationAsRead(notification.id);
  }
  
  // Route based on notification type and user role
  switch (notification.type) {
    // ===== EMPLOYER NOTIFICATIONS =====
    case 'application_received':
      if (notification.metadata?.job_id) {
        // Navigate to applications page filtered by job
        this.router.navigate(['/employer/applications'], {
          queryParams: { jobId: notification.metadata.job_id }
        });
      }
      break;
    
    // ===== JOBSEEKER NOTIFICATIONS =====
    case 'new_job':
      if (notification.metadata?.job_id) {
        this.router.navigate(['/jobseeker/job-details', notification.metadata.job_id]);
      }
      break;
    
    case 'application_reviewed':
    case 'application_shortlisted':
    case 'application_accepted':
    case 'application_rejected':
      // Navigate to jobseeker's applications list
      this.router.navigate(['/jobseeker/applications']);
      break;
    
    case 'job_updated':
    case 'job_deleted':
    case 'job_closed':
    case 'job_filled':
      // Navigate to job explorer
      this.router.navigate(['/jobseeker/job-explorer']);
      break;
    
    // ===== TRAINING NOTIFICATIONS =====
    case 'certificate_issued':
    case 'training_completed':
      this.router.navigate(['/jobseeker/certificates']);
      break;
    
    case 'training_updated':
    case 'training_enrollment':
      if (notification.metadata?.training_id) {
        this.router.navigate(['/jobseeker/training', notification.metadata.training_id]);
      } else {
        this.router.navigate(['/jobseeker/trainings']);
      }
      break;
    
    // ===== TEST/SYSTEM =====
    case 'test':
      console.log('Test notification - no navigation');
      break;
    
    default:
      console.log('No specific action for notification type:', notification.type);
  }
  
  this.showNotifications = false;
}
isJobNotification(type: string): boolean {
  // Job-related: includes application_received for employers
  return [
    'new_job', 
    'job_updated', 
    'job_deleted', 
    'job_closed', 
    'job_filled',
    'application_received'  // ✅ ADDED: This IS a job notification for employers
  ].includes(type);
}

isTrainingNotification(type: string): boolean {
  return [
    'training_enrollment', 
    'training_completed', 
    'certificate_issued', 
    'training_updated'
  ].includes(type);
}

isApplicationNotification(type: string): boolean {
  // Application status updates for JOBSEEKERS
  return [
    'application_reviewed', 
    'application_shortlisted', 
    'application_accepted', 
    'application_rejected'
  ].includes(type);
}


getNotificationCategory(type: string): string {
  if (this.isJobNotification(type)) return 'JOB';
  if (this.isTrainingNotification(type)) return 'TRAINING';
  if (this.isApplicationNotification(type)) return 'APPLICATION';
  return 'SYSTEM';
}

getTimeSince(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
  /**
   * ✅ NEW: Mark notification as read
   */
  markNotificationAsRead(notificationId: string): void {
    console.log('✅ Marking notification as read:', notificationId);
    
    const notification = this.jobNotifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
    }
    
    this.jobService.markNotificationRead(notificationId)
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

  /**
   * ✅ NEW: Toggle notifications dropdown
   */
  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    
    if (this.showNotifications) {
      this.lastNotificationCheck = new Date();
      console.log('👀 Notifications panel opened');
    }
  }

  /**
   * ✅ NEW: View all notifications
   */
  viewAllNotifications(): void {
    console.log('📋 Viewing all notifications');
    this.router.navigate(['/employer/notifications']);
  }
}