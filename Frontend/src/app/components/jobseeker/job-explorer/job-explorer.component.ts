import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, forkJoin, catchError, of, interval } from 'rxjs';
import { JobService, Job } from '../../../../../services/job.service';
import { ProfileService } from '../../../../../services/profile.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Component({
  selector: 'app-job-explorer',
  templateUrl: './job-explorer.component.html',
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./job-explorer.component.css']
})
export class JobExplorerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  jobs: Job[] = [];
  filteredJobs: Job[] = [];
  
  selectedJobType: string = '';
  selectedLocation: string = '';
  selectedSalaryRange: string = '';
  sortBy: string = 'match-score';
  searchQuery: string = '';
  
  recommendedCount: number = 0;
  savedJobsCount: number = 0;
  appliedJobsCount: number = 0;
  
  activeTab: string = 'recommended';
  
  // Notification properties
  showNotification: boolean = false;
  notificationMessage: string = '';
  notifications: Notification[] = [];
  
  // Applied and saved job IDs
  appliedJobIds: string[] = [];
  savedJobIds: string[] = [];
  
  // Loading states
  isLoading: boolean = false;
  isApplying: string | null = null;
  isSaving: string | null = null;
  
  // Profile completion tracking
  profileCompletion: number = 0;
  isProfileComplete: boolean = false;
  isCheckingProfile: boolean = false;
  
  // Cache for match scores and ratings to avoid ExpressionChangedAfterItHasBeenCheckedError
  private matchScoreCache: Map<string, number> = new Map();
  private ratingCache: Map<string, number> = new Map();
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  totalJobs: number = 0;

  // Notification properties
  jobNotifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  lastNotificationCheck: Date = new Date();

  constructor(
    private jobService: JobService,
    private profileService: ProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🚀 JobExplorerComponent initialized');
    
    // Check profile completion first
    this.checkProfileCompletion();
    
    // Load saved/applied jobs FIRST, then load jobs list
    this.loadSavedAndAppliedJobs();
    
    // Load stats with error handling
    this.loadJobseekerStats();

    // Load notifications
    this.loadNotifications();
    
    // Auto-refresh every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if jobseeker's profile is complete
   * Profile must be 100% complete to apply for jobs
   */
  checkProfileCompletion(): void {
    this.isCheckingProfile = true;
    
    this.profileService.getMyPortfolio()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isCheckingProfile = false;
          console.log('✅ Profile check completed:', {
            completion: this.profileCompletion,
            isComplete: this.isProfileComplete
          });
        }),
        catchError((error) => {
          console.error('❌ Error checking profile:', error);
          // If error, assume profile is incomplete for safety
          this.profileCompletion = 0;
          this.isProfileComplete = false;
          
          if (error.status === 404) {
            console.log('ℹ️ No CV found - profile is incomplete');
          }
          
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response && response.success && response.data) {
            // Calculate profile completion percentage
            this.profileCompletion = this.calculateProfileCompletion(response.data);
            this.isProfileComplete = this.profileCompletion === 100;
          } else {
            // No portfolio found
            this.profileCompletion = 0;
            this.isProfileComplete = false;
          }
        }
      });
  }

  /**
   * Calculate profile completion percentage based on portfolio data
   */
  private calculateProfileCompletion(portfolioData: any): number {
    let totalFields = 0;
    let completedFields = 0;
    
    const cvData = portfolioData.cvData;
    const personalInfo = cvData?.personal_info || cvData?.personalInfo;

    // Basic Information (5 fields)
    if (personalInfo) {
      totalFields += 5;
      if (personalInfo.full_name || personalInfo.fullName) completedFields++;
      if (personalInfo.email) completedFields++;
      if (personalInfo.phone) completedFields++;
      if (personalInfo.profile_image || personalInfo.profileImage) completedFields++;
      if (personalInfo.address) completedFields++;
    }

    // Professional Summary (1 field)
    totalFields++;
    if (personalInfo?.professional_summary || personalInfo?.professionalSummary) {
      const summary = personalInfo.professional_summary || personalInfo.professionalSummary;
      if (summary.trim().length > 0) completedFields++;
    }

    // Skills (1 field)
    totalFields++;
    if (cvData?.skills && cvData.skills.length > 0) completedFields++;

    // Work Experience (1 field)
    totalFields++;
    if (cvData?.work_experience && cvData.work_experience.length > 0) completedFields++;

    // Education (1 field)
    totalFields++;
    if (cvData?.education && cvData.education.length > 0) completedFields++;

    // Certifications (1 field)
    totalFields++;
    if (cvData?.certifications && cvData.certifications.length > 0) completedFields++;

    // Projects (1 field)
    totalFields++;
    if (cvData?.projects && cvData.projects.length > 0) completedFields++;

    // Social Links (1 field)
    totalFields++;
    if (personalInfo?.linkedin_url || personalInfo?.github_url || personalInfo?.website_url) {
      completedFields++;
    }

    const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    
    console.log('📊 Profile completion calculation:', {
      totalFields,
      completedFields,
      percentage
    });
    
    return percentage;
  }

  /**
   * Load jobs based on active tab and filters
   */
loadJobs(page: number = 1): void {
  console.log(`🔄 Loading jobs for tab: ${this.activeTab}, page: ${page}`);
  
  this.isLoading = true;
  this.currentPage = page;
  
  // Clear caches when loading new jobs
  this.matchScoreCache.clear();
  this.ratingCache.clear();
  
  const query: any = {
    page: this.currentPage,
    limit: this.itemsPerPage,
    sort_by: this.getSortByField(),
    sort_order: 'DESC' as const
  };
  
  // Add filters if selected
  if (this.searchQuery) query.search = this.searchQuery;
  if (this.selectedJobType) query.employment_type = this.selectedJobType;
  if (this.selectedLocation) query.work_arrangement = this.selectedLocation;
  if (this.selectedSalaryRange) {
    const salaryRange = this.parseSalaryRange(this.selectedSalaryRange);
    if (salaryRange.min) query.salary_min = salaryRange.min;
    if (salaryRange.max) query.salary_max = salaryRange.max;
  }

  // Load different data based on active tab
  let observable;
  switch(this.activeTab) {
    case 'recommended':
      observable = this.jobService.getRecommendedJobs(query);
      break;
    case 'saved':
      observable = this.jobService.getSavedJobs(query);
      break;
    case 'applied':
      observable = this.jobService.getAppliedJobs(query);
      break;
    default:
      observable = this.jobService.getAllJobs(query);
  }

  observable
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        console.log('✅ Jobs loading completed');
      }),
      catchError((error) => {
        console.error('❌ Error loading jobs:', error);
        this.addNotification('Failed to load jobs. Please try again.', 'error');
        return of({ success: false, data: null });
      })
    )
    .subscribe({
      next: (response) => {
        if (!response || !response.success || !response.data) {
          this.jobs = [];
          this.filteredJobs = [];
          return;
        }
        
        console.log('📦 Raw API response:', response);
        
        // 🔥 FIXED: Handle different response structures
        if (this.activeTab === 'saved' || this.activeTab === 'applied') {
          // For saved/applied, extract nested job data
          const dataArray = response.data.data || response.data;
          
          if (Array.isArray(dataArray)) {
            // 🔥 Map nested job objects to flat structure
            this.jobs = dataArray.map((item: any) => {
              // Check if item has nested job object (from bookmarks/applications)
              if (item.job) {
                // Extract the nested job and merge with bookmark/application metadata
                return {
                  ...item.job,
                  // Preserve bookmark/application specific fields
                  saved_at: item.saved_at,
                  applied_at: item.applied_at,
                  application_status: item.status,
                  bookmark_id: item.id,
                  application_id: item.id,
                  // Ensure correct job_id
                  id: item.job.id || item.job_id
                };
              } else {
                // Fallback: item might already be a flat job object
                return {
                  ...item,
                  id: item.id || item.job_id
                };
              }
            });
            
            // Mark all these jobs as saved/applied
            this.jobs.forEach((job: any) => {
              const jobId = job.id;
              if (!jobId) return;
              
              if (this.activeTab === 'saved' && !this.savedJobIds.includes(jobId)) {
                this.savedJobIds.push(jobId);
              } else if (this.activeTab === 'applied' && !this.appliedJobIds.includes(jobId)) {
                this.appliedJobIds.push(jobId);
              }
            });
          } else {
            this.jobs = [];
          }
        } else {
          // For recommended and all jobs - data is already flat
          this.jobs = response.data.jobs || response.data.data || [];
        }
        
        this.filteredJobs = [...this.jobs];
        
        // Update pagination
        if (response.data.pagination) {
          this.totalJobs = response.data.pagination.total;
          this.totalPages = response.data.pagination.total_pages;
        } else {
          this.totalJobs = this.jobs.length;
          this.totalPages = 1;
        }
        
        // Update recommended count
        if (this.activeTab === 'recommended') {
          this.recommendedCount = this.totalJobs;
        }
        
        // Track which jobs are saved/applied based on backend response flags OR our loaded arrays
        this.jobs.forEach(job => {
          const jobId = this.getJobId(job);
          if (!jobId) return;
          
          // Check if job is saved
          if ((job as any).is_saved || this.savedJobIds.includes(jobId)) {
            if (!this.savedJobIds.includes(jobId)) {
              this.savedJobIds.push(jobId);
            }
          }
          
          // Check if job is applied
          if ((job as any).has_applied || this.appliedJobIds.includes(jobId)) {
            if (!this.appliedJobIds.includes(jobId)) {
              this.appliedJobIds.push(jobId);
            }
          }
        });
        
        console.log('✅ Jobs processed:', {
          jobsCount: this.jobs.length,
          savedCount: this.savedJobIds.length,
          appliedCount: this.appliedJobIds.length,
          sampleJob: this.jobs[0] // Log first job for debugging
        });
      }
    });
}

  /**
   * Load jobseeker stats with robust error handling
   */
  loadJobseekerStats(): void {
    console.log('📊 Loading jobseeker stats...');
    
    this.jobService.getJobseekerStats()
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('❌ Error loading stats (non-blocking):', error);
          // Return empty stats on error - don't disrupt UX
          return of({ 
            success: false, 
            data: { 
              total_saved_jobs: this.savedJobIds.length, 
              total_applications: this.appliedJobIds.length 
            } 
          });
        })
      )
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.savedJobsCount = response.data.total_saved_jobs || this.savedJobIds.length;
            this.appliedJobsCount = response.data.total_applications || this.appliedJobIds.length;
            
            console.log('✅ Stats loaded:', {
              saved: this.savedJobsCount,
              applied: this.appliedJobsCount
            });
          }
        }
      });
  }

  /**
   * Load saved and applied jobs from backend to sync state on page refresh
   */
  loadSavedAndAppliedJobs(): void {
    console.log('🔄 Loading saved and applied jobs from backend...');
    
    const savedJobs$ = this.jobService.getSavedJobs({ page: 1, limit: 1000 }).pipe(
      catchError(error => {
        console.error('❌ Error loading saved jobs:', error);
        return of({ success: false, data: null });
      })
    );
    
    const appliedJobs$ = this.jobService.getAppliedJobs({ page: 1, limit: 1000 }).pipe(
      catchError(error => {
        console.error('❌ Error loading applied jobs:', error);
        return of({ success: false, data: null });
      })
    );
    
    // Use forkJoin to load both simultaneously
    forkJoin({
      saved: savedJobs$,
      applied: appliedJobs$
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        console.log('✅ Saved/Applied jobs load completed');
        // NOW load the jobs list after we have saved/applied state
        this.loadJobs();
      })
    )
    .subscribe({
      next: (results) => {
        console.log('📦 Raw responses:', { saved: results.saved, applied: results.applied });
        
        // Process saved jobs
        if (results.saved && results.saved.success && results.saved.data) {
          const savedData = results.saved.data.data || results.saved.data.jobs || results.saved.data;
          
          if (Array.isArray(savedData)) {
            this.savedJobIds = savedData
              .map((item: any) => item.job_id || item.id || item.job?.id)
              .filter(id => id);
            
            console.log('✅ Loaded saved job IDs:', this.savedJobIds.length);
          }
        }
        
        // Process applied jobs
        if (results.applied && results.applied.success && results.applied.data) {
          const appliedData = results.applied.data.data || results.applied.data.jobs || results.applied.data;
          
          if (Array.isArray(appliedData)) {
            this.appliedJobIds = appliedData
              .map((item: any) => item.job_id || item.id || item.job?.id)
              .filter(id => id);
            
            console.log('✅ Loaded applied job IDs:', this.appliedJobIds.length);
          }
        }
        
        console.log('📋 Final state:', {
          savedJobIds: this.savedJobIds,
          appliedJobIds: this.appliedJobIds
        });
      }
    });
  }

  /**
   * Get sort field for API query
   */
  getSortByField(): string {
    switch(this.sortBy) {
      case 'newest':
        return 'created_at';
      case 'salary':
        return 'salary_max';
      case 'rating':
        return 'applications_count';
      default:
        return 'created_at';
    }
  }

  /**
   * Parse salary range string into min/max values
   */
  parseSalaryRange(range: string): { min?: number; max?: number } {
    switch(range) {
      case '50k-80k':
        return { min: 50000, max: 80000 };
      case '80k-120k':
        return { min: 80000, max: 120000 };
      case '120k+':
        return { min: 120000 };
      default:
        return {};
    }
  }

  /**
   * Filter change handlers
   */
  onJobTypeChange(): void {
    this.loadJobs(1);
  }

  onLocationChange(): void {
    this.loadJobs(1);
  }

  onSalaryChange(): void {
    this.loadJobs(1);
  }

  onSortChange(): void {
    this.loadJobs(this.currentPage);
  }

  onSearchSubmit(): void {
    this.loadJobs(1);
  }

  /**
   * Set active tab and reload jobs
   */
  setActiveTab(tab: string): void {
    console.log(`🔄 Switching to tab: ${tab}`);
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadJobs(1);
  }

  /**
   * Apply to a job - WITH PROFILE COMPLETION CHECK
   */
  applyToJob(jobId: string): void {
    console.log('=== APPLY BUTTON CLICKED ===');
    console.log('Job ID:', jobId);
    console.log('Profile completion:', this.profileCompletion);
    console.log('Is profile complete?', this.isProfileComplete);
    
    // Prevent if already applied
    if (this.isJobApplied(jobId)) {
      console.log('❌ Job already applied to');
      this.addNotification('You have already applied to this job', 'info');
      return;
    }

    // Prevent double-click
    if (this.isApplying === jobId) {
      console.log('⏳ Already processing application');
      return;
    }

    // 🔥 CHECK PROFILE COMPLETION BEFORE ALLOWING APPLICATION
    if (!this.isProfileComplete) {
      console.log('❌ Profile is incomplete - blocking application');
      
      const missingPercentage = 100 - this.profileCompletion;
      this.addNotification(
        `⚠️ Profile ${this.profileCompletion}% complete. Need ${missingPercentage}% more to apply!`,
        'warning'
      );

      // Show confirmation dialog
      const confirmComplete = confirm(
        `⚠️ Your profile is only ${this.profileCompletion}% complete.\n\n` +
        `You need 100% completion to apply for jobs.\n\n` +
        `Would you like to complete your profile now?\n\n` +
        `✅ Add missing information:\n` +
        `• Professional Summary\n` +
        `• Work Experience\n` +
        `• Skills & Certifications\n` +
        `• Education Background\n` +
        `• Projects & Portfolio\n` +
        `• Social Links`
      );

      if (confirmComplete) {
        console.log('Redirecting to CV Manager...');
        this.router.navigate(['/jobseeker/cv-manager']);
      }
      
      return; // BLOCK THE APPLICATION
    }

    // Profile is complete - proceed with application
    console.log('✅ Profile is complete - proceeding with application');
    this.isApplying = jobId;
    
    // Application data (can be enhanced with a modal later)
    const applicationData = {
      coverLetter: '',
      resumeId: undefined,
      portfolioUrl: undefined,
      expectedSalary: undefined,
      availabilityDate: undefined
    };

    this.jobService.applyToJob(jobId, applicationData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('🏁 Apply API call completed');
          this.isApplying = null;
        }),
        catchError((error) => {
          console.error('❌ Error applying to job:', error);
          
          let errorMsg = 'Failed to submit application. Please try again.';
          
          // Handle specific error cases
          if (error.status === 401) {
            errorMsg = '🔐 Please log in to apply to jobs';
          } else if (error.status === 409) {
            errorMsg = 'You have already applied to this job';
            // Sync local state with backend
            if (!this.appliedJobIds.includes(jobId)) {
              this.appliedJobIds.push(jobId);
            }
          } else if (error.status === 404) {
            errorMsg = 'Job not found or no longer available';
          } else if (error.status === 400) {
            errorMsg = error.error?.message || 'Invalid application data';
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          this.addNotification(errorMsg, 'error');
          
          return of({ success: false, message: errorMsg });
        })
      )
      .subscribe({
        next: (response) => {
          if (!response || !response.success) return;
          
          console.log('✅ Apply job response:', response);
          
          // Update local state
          if (!this.appliedJobIds.includes(jobId)) {
            this.appliedJobIds.push(jobId);
            console.log('✅ Added to appliedJobIds:', jobId);
          }
          
          // Increment counter
          this.appliedJobsCount++;
          
          // Get job details for notification
          const job = this.jobs.find(j => this.getJobId(j) === jobId);
          const jobTitle = job?.title || 'this position';
          
          // Show success notification
          this.addNotification(
            `🎉 Application submitted successfully for ${jobTitle}!`, 
            'success'
          );
          
          console.log('📊 Updated state:', {
            appliedJobIds: this.appliedJobIds,
            appliedJobsCount: this.appliedJobsCount
          });
          
          // 🔥 Reload jobs and stats after delay
          setTimeout(() => {
            this.loadJobs(this.currentPage);
            this.loadJobseekerStats();
          }, 500);
        }
      });
  }

  /**
   * Save/Bookmark a job with toggle functionality
   */
  saveJob(jobId: string): void {
    console.log('=== SAVE BUTTON CLICKED ===');
    console.log('Job ID:', jobId);
    
    // Toggle functionality - if already saved, unsave it
    if (this.isJobSaved(jobId)) {
      console.log('🔄 Job already saved, toggling to unsave...');
      this.unsaveJob(jobId);
      return;
    }

    // Prevent double-click
    if (this.isSaving === jobId) {
      console.log('⏳ Already processing save request');
      return;
    }

    this.isSaving = jobId;
    console.log('✅ Starting save process...');
    
    this.jobService.saveJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('🏁 Save API call completed');
          this.isSaving = null;
        }),
        catchError((error) => {
          console.error('❌ Error saving job:', error);
          
          let errorMsg = 'Failed to save job. Please try again.';
          
          if (error.status === 401) {
            errorMsg = '🔐 Please log in to save jobs';
          } else if (error.status === 409) {
            errorMsg = 'Job is already saved';
            if (!this.savedJobIds.includes(jobId)) {
              this.savedJobIds.push(jobId);
            }
          } else if (error.status === 404) {
            errorMsg = 'Job not found';
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          this.addNotification(errorMsg, 'error');
          
          return of({ success: false, message: errorMsg });
        })
      )
      .subscribe({
        next: (response) => {
          if (!response || !response.success) return;
          
          console.log('✅ Save job response:', response);
          
          // Update local state
          if (!this.savedJobIds.includes(jobId)) {
            this.savedJobIds.push(jobId);
            console.log('✅ Added to savedJobIds:', jobId);
          }
          
          // Increment counter
          this.savedJobsCount++;
          
          // Show success notification
          this.addNotification('💾 Job saved successfully!', 'success');
          
          // 🔥 Reload jobs and stats after delay
          setTimeout(() => {
            this.loadJobs(this.currentPage);
            this.loadJobseekerStats();
          }, 500);
        }
      });
  }

  /**
   * Unsave/Remove bookmark from a job
   */
  unsaveJob(jobId: string): void {
    console.log('=== UNSAVE BUTTON CLICKED ===');
    console.log('Job ID:', jobId);
    
    if (this.isSaving === jobId) {
      console.log('⏳ Already processing unsave request');
      return;
    }

    this.isSaving = jobId;
    
    this.jobService.unsaveJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSaving = null;
        }),
        catchError((error) => {
          console.error('❌ Error unsaving job:', error);
          
          let errorMsg = 'Failed to unsave job. Please try again.';
          
          if (error.status === 404) {
            errorMsg = 'Job not found or not saved';
            this.savedJobIds = this.savedJobIds.filter(id => id !== jobId);
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          this.addNotification(errorMsg, 'error');
          
          return of({ success: false, message: errorMsg });
        })
      )
      .subscribe({
        next: (response) => {
          if (!response || !response.success) return;
          
          console.log('✅ Unsave job response:', response);
          
          this.savedJobIds = this.savedJobIds.filter(id => id !== jobId);
          this.savedJobsCount = Math.max(0, this.savedJobsCount - 1);
          
          this.addNotification('📝 Job removed from saved list', 'info');
          
          // Reload current view
          if (this.activeTab === 'saved') {
            this.loadJobs(this.currentPage);
          }
          
          this.loadJobseekerStats();
        }
      });
  }

  /**
   * Check if job is applied
   */
  isJobApplied(jobId: string): boolean {
    return this.appliedJobIds.includes(jobId);
  }

  /**
   * Check if job is saved
   */
  isJobSaved(jobId: string): boolean {
    return this.savedJobIds.includes(jobId);
  }

  /**
   * Get job ID from job object
   */
  getJobId(job: any): string {
    return job.job_id || job.id;
  }

  /**
   * Notification management
   */
  hideNotification(): void {
    this.showNotification = false;
    this.notificationMessage = '';
  }

  addNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    const id = Date.now().toString();
    this.notifications.push({ id, message, type });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => this.dismissNotification(id), 5000);
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  /**
   * Pagination methods
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.loadJobs(page);
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

  /**
   * Helper methods for template
   */
  getStarArray(rating: number): number[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(1);
    }
    
    if (hasHalfStar) {
      stars.push(0.5);
    }
    
    while (stars.length < 5) {
      stars.push(0);
    }
    
    return stars;
  }

  formatSalary(job: Job): string {
    return this.jobService.formatSalary(job.salary_min, job.salary_max, job.currency);
  }

  getJobType(job: Job): string {
    return this.jobService.formatJobType(job.employment_type, job.work_arrangement);
  }

  getSkillsArray(job: Job): string[] {
    if (Array.isArray(job.skills_required)) {
      return job.skills_required;
    }
    return [];
  }

  getBenefitsArray(job: Job): string[] {
    if (Array.isArray(job.benefits)) {
      return job.benefits;
    }
    return [];
  }

  getPostedDays(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  getCompanyLogo(job: Job): string {
    if (job.company_logo) {
      return job.company_logo;
    }
    const letter = (job.company_name || 'C').charAt(0).toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='%234285f4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='white'%3E${letter}%3C/text%3E%3C/svg%3E`;
  }

  getMatchScore(job: Job): number {
    const jobId = this.getJobId(job);
    
    if (this.matchScoreCache.has(jobId)) {
      return this.matchScoreCache.get(jobId)!;
    }
    
    const score = Math.floor(Math.random() * 20) + 80;
    this.matchScoreCache.set(jobId, score);
    return score;
  }

  getRating(job: Job): number {
    const jobId = this.getJobId(job);
    
    if (this.ratingCache.has(jobId)) {
      return this.ratingCache.get(jobId)!;
    }
    
    const baseRating = 4.0;
    const bonus = Math.min(job.applications_count * 0.01, 0.9);
    const rating = Math.min(baseRating + bonus, 5.0);
    
    this.ratingCache.set(jobId, rating);
    return rating;
  }

  loadNotifications(): void {
    this.jobService.getNotifications({ read: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobNotifications = response.data.notifications || [];
            this.unreadNotificationCount = this.jobNotifications.filter(n => !n.read).length;
            this.checkForNewNotifications();
          }
        },
        error: (error) => console.error('Error loading notifications:', error)
      });
  }

  private checkForNewNotifications(): void {
    const newNotifications = this.jobNotifications.filter(n => {
      const notificationDate = new Date(n.created_at);
      return notificationDate > this.lastNotificationCheck && !n.read;
    });

    if (newNotifications.length > 0 && 
        'Notification' in window && 
        Notification.permission === 'granted') {
      newNotifications.forEach(n => {
        new Notification(n.title, {
          body: n.message,
          icon: '/assets/logo.png'
        });
      });
    }

    this.lastNotificationCheck = new Date();
  }

  getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'new_job': 'fa-briefcase',
      'application_reviewed': 'fa-eye',
      'application_shortlisted': 'fa-star',
      'application_accepted': 'fa-check-circle',
      'application_rejected': 'fa-times-circle',
      'job_updated': 'fa-edit',
      'job_deleted': 'fa-trash',
      'job_closed': 'fa-lock',
      'job_filled': 'fa-user-check'
    };
    return iconMap[type] || 'fa-info-circle';
  }

  handleNotificationClick(notification: any): void {
    if (!notification.read) {
      this.markNotificationAsRead(notification.id);
    }
    
    // Navigate based on type
    switch (notification.type) {
      case 'new_job':
        if (notification.metadata?.job_id) {
          // Navigate to job details
          this.router.navigate(['/jobseeker/job-details', notification.metadata.job_id]);
        }
        break;
      case 'application_reviewed':
      case 'application_shortlisted':
      case 'application_accepted':
      case 'application_rejected':
        // Navigate to applications
        this.router.navigate(['/jobseeker/applications']);
        break;
    }
    
    this.showNotifications = false;
  }

  markNotificationAsRead(notificationId: string): void {
    const notification = this.jobNotifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
    }
    
    this.jobService.markNotificationRead(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => console.log('Notification marked as read'),
        error: (error) => {
          console.error('Error marking notification:', error);
          if (notification) {
            notification.read = false;
            this.unreadNotificationCount++;
          }
        }
      });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.lastNotificationCheck = new Date();
    }
  }
}