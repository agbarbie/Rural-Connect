import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
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
  notifications: Notification[] = [];
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
    private jobService: JobService
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
    this.notifications.push({ id, message, type });
    setTimeout(() => this.dismissNotification(id), 5000);
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
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
}