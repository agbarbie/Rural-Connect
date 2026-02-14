import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, forkJoin, catchError, throwError, of, interval, Observable } from 'rxjs';
import { JobService, Job } from '../../../../../services/job.service';
import { ProfileService } from '../../../../../services/profile.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-job-explorer',
  templateUrl: './job-explorer.component.html',
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./job-explorer.component.css']
})
export class JobExplorerComponent implements OnInit, OnDestroy {
  // Sidebar toggle methods for mobile
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
  
  // Profile completion tracking - NOW BASED ON FORM FIELDS ONLY
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

  // Job Notification properties
  jobNotifications: any[] = [];
  unreadNotificationCount: number = 0;
  showNotifications: boolean = false;
  lastNotificationCheck: Date = new Date();
  authService: any;

  constructor(
    private jobService: JobService,
    private profileService: ProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🚀 JobExplorerComponent initialized');
    
    // Check profile completion first - NOW USES FORM-BASED CALCULATION
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
 * ✅ FIXED: Check profile completion using BACKEND API
 * This ensures consistency with the profile page
 */
checkProfileCompletion(): void {
  this.isCheckingProfile = true;
  
  // ✅ Call backend API for profile completion
  this.profileService.getProfileCompletion()
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
        console.error('❌ Error checking profile completion:', error);
        // If error, assume profile is incomplete for safety
        this.profileCompletion = 0;
        this.isProfileComplete = false;
        return of(null);
      })
    )
    .subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          // ✅ Use completion from backend API
          this.profileCompletion = response.data.completion || 0;
          
          // ✅ Accept 80% or higher
          this.isProfileComplete = this.profileCompletion >= 80;
          
          console.log('📊 Profile completion from API:', {
            completion: this.profileCompletion,
            isComplete: this.isProfileComplete,
            missingFields: response.data.missingFields
          });
        } else {
          // No profile found
          this.profileCompletion = 0;
          this.isProfileComplete = false;
        }
      }
    });
}

  /**
   * ✅ NEW: Calculate profile completion based on FORM FIELDS ONLY
   * No dependency on CV upload or portfolio data
   */
  private calculateProfileCompletion(profileData: any): number {
    let totalFields = 0;
    let completedFields = 0;

    // 1. Basic Contact Information (3 required fields)
    totalFields += 3;
    if (profileData.phone && profileData.phone.trim().length > 0) {
      completedFields++;
    }
    if (profileData.location && profileData.location.trim().length > 0) {
      completedFields++;
    }
    // Profile image is optional in job explorer calculation (or you can require it)
    // For now, we'll count it as completed if it exists
    if (profileData.profile_image || profileData.profileImage) {
      completedFields++;
    } else {
      // Give them credit if they have any image set
      completedFields++; // Make it lenient for now
    }

    // 2. Professional Summary (1 required field)
    totalFields += 1;
    if (profileData.bio && profileData.bio.trim().length >= 50) {
      completedFields++;
    }

    // 3. Skills (1 required field - at least 3 skills)
    totalFields += 1;
    const skills = this.parseJsonArrayField(profileData.skills);
    if (skills && skills.length >= 3) {
      completedFields++;
    }

    // 4. Social Links (1 required field - at least one link)
    totalFields += 1;
    const hasLinkedIn = profileData.linkedin_url && profileData.linkedin_url.trim().length > 0;
    const hasGithub = profileData.github_url && profileData.github_url.trim().length > 0;
    const hasWebsite = profileData.website_url && profileData.website_url.trim().length > 0;
    
    if (hasLinkedIn || hasGithub || hasWebsite) {
      completedFields++;
    }

    // 5. Career Preferences (3 required fields)
    totalFields += 3;
    if (profileData.years_of_experience > 0) {
      completedFields++;
    }
    if (profileData.current_position && profileData.current_position.trim().length > 0) {
      completedFields++;
    }
    const jobTypes = this.parseJsonArrayField(profileData.preferred_job_types);
    if (jobTypes && jobTypes.length > 0) {
      completedFields++;
    }

    // 6. Salary Expectations (1 field - bonus if filled)
    totalFields += 1;
    if (profileData.salary_expectation_min > 0 || profileData.salary_expectation_max > 0) {
      completedFields++;
    }

    const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    
    console.log('📊 Profile completion calculation (Form-based):', {
      totalFields,
      completedFields,
      percentage,
      fields: {
        phone: !!profileData.phone,
        location: !!profileData.location,
        bio: profileData.bio?.length >= 50,
        skills: skills?.length >= 3,
        socialLinks: hasLinkedIn || hasGithub || hasWebsite,
        yearsOfExperience: profileData.years_of_experience > 0,
        currentPosition: !!profileData.current_position,
        jobTypes: jobTypes?.length > 0,
        salary: profileData.salary_expectation_min > 0 || profileData.salary_expectation_max > 0
      }
    });
    
    return percentage;
  }

  /**
   * Helper to parse JSON array fields
   */
  private parseJsonArrayField(field: any): string[] {
    if (!field) return [];
    try {
      if (typeof field === 'string') {
        return JSON.parse(field);
      }
      if (Array.isArray(field)) {
        return field;
      }
      return [];
    } catch {
      return [];
    }
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
      // ✅ FIX: Use getAllJobs instead of getRecommendedJobs
      observable = this.jobService.getAllJobs(query);
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
          
          // Handle different response structures
          if (this.activeTab === 'saved' || this.activeTab === 'applied') {
            // For saved/applied, extract nested job data
            const dataArray = response.data.data || response.data;
            
            if (Array.isArray(dataArray)) {
              // Map nested job objects to flat structure
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
            sampleJob: this.jobs[0]
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
    
    // ✅ FIX: Explicitly exclude withdrawn applications
    const appliedJobs$ = this.jobService.getAppliedJobs({ 
      page: 1, 
      limit: 1000,
      status: 'active'
    }).pipe(
      catchError(error => {
        console.error('❌ Error loading applied jobs:', error);
        return of({ success: false, data: null });
      })
    );
    
    forkJoin({
      saved: savedJobs$,
      applied: appliedJobs$
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        console.log('✅ Saved/Applied jobs load completed');
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
              .filter((item: any) => {
                const status = item.status || item.application_status || item.job?.application_status;
                return status !== 'withdrawn';
              })
              .map((item: any) => item.job_id || item.id || item.job?.id)
              .filter(id => id);
            
            console.log('✅ Loaded applied job IDs (excluding withdrawn):', this.appliedJobIds.length);
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
   * Apply to a job - WITH PROFILE COMPLETION CHECK (FORM-BASED)
   */
  applyToJob(jobId: string): void {
    console.log('=== APPLY/WITHDRAW BUTTON CLICKED ===');
    console.log('Job ID:', jobId);
    console.log('Is already applied?', this.isJobApplied(jobId));
    console.log('Profile completion:', this.profileCompletion);
    
    // ✅ IF ALREADY APPLIED - OFFER TO WITHDRAW
    if (this.isJobApplied(jobId)) {
      console.log('🔄 Job already applied - triggering withdrawal flow');
      this.withdrawApplication(jobId);
      return;
    }

    // Prevent double-click
    if (this.isApplying === jobId) {
      console.log('⏳ Already processing application');
      return;
    }

    // ✅ CHECK PROFILE COMPLETION BEFORE ALLOWING APPLICATION (FORM-BASED)
    if (!this.isProfileComplete) {
      console.log('❌ Profile is incomplete - blocking application');
      
      const missingPercentage = 100 - this.profileCompletion;
      this.addNotification(
        `⚠️ Profile ${this.profileCompletion}% complete. Need ${missingPercentage}% more to apply!`,
        'warning'
      );

      const confirmComplete = confirm(
        `⚠️ Your profile is only ${this.profileCompletion}% complete.\n\n` +
        `You need 100% completion to apply for jobs.\n\n` +
        `Would you like to complete your profile now?\n\n` +
        `✅ Complete these fields in your Profile:\n` +
        `• Contact Information (Phone & Location)\n` +
        `• Professional Summary (50+ characters)\n` +
        `• Skills (at least 3 skills)\n` +
        `• Social Links (LinkedIn/GitHub/Website)\n` +
        `• Career Preferences (Experience, Position, Job Types)\n` +
        `• Salary Expectations (Optional but recommended)`
      );

      if (confirmComplete) {
        console.log('Redirecting to Profile page...');
        this.router.navigate(['/jobseeker/profile']);
      }
      
      return;
    }

    // Profile is complete - proceed with application
    console.log('✅ Profile is complete - proceeding with application');
    this.isApplying = jobId;
    
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
          
          if (error.status === 401) {
            errorMsg = '🔐 Please log in to apply to jobs';
          } else if (error.status === 409) {
            errorMsg = 'You have already applied to this job';
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
        next: (response: ApiResponse | any) => {
          if (!response || !(response as ApiResponse).success) return;
          
          console.log('✅ Apply job response:', response);
          
          if (!this.appliedJobIds.includes(jobId)) {
            this.appliedJobIds.push(jobId);
            console.log('✅ Added to appliedJobIds:', jobId);
          }
          
          this.appliedJobsCount++;
          
          const job = this.jobs.find(j => this.getJobId(j) === jobId);
          const jobTitle = job?.title || 'this position';
          
          this.addNotification(
            `🎉 Application submitted successfully for ${jobTitle}!`, 
            'success'
          );
          
          console.log('📊 Updated state:', {
            appliedJobIds: this.appliedJobIds,
            appliedJobsCount: this.appliedJobsCount
          });
          
          setTimeout(() => {
            this.loadJobs(this.currentPage);
            this.loadJobseekerStats();
          }, 500);
        }
      });
  }

  /**
   * Withdraw/Unapply from a job
   */
  withdrawApplication(jobId: string): void {
    console.log('=== WITHDRAW APPLICATION ===');
    console.log('Job ID:', jobId);
    
    // Prevent double-click
    if (this.isApplying === jobId) {
      console.log('⏳ Already processing application action');
      return;
    }

    // Get job details for confirmation
    const job = this.jobs.find(j => this.getJobId(j) === jobId);
    const jobTitle = job?.title || 'this position';
    
    // Check if already withdrawn
    if (job && (job as any).application_status === 'withdrawn') {
      console.log('ℹ️ Application already withdrawn');
      this.addNotification(
        `This application was already withdrawn from "${jobTitle}"`, 
        'info'
      );
      
      // Clean up local state
      this.appliedJobIds = this.appliedJobIds.filter(id => id !== jobId);
      this.appliedJobsCount = Math.max(0, this.appliedJobsCount - 1);
      
      // ✅ FIX: If on Applied tab, remove job from view immediately
      if (this.activeTab === 'applied') {
        this.jobs = this.jobs.filter(j => this.getJobId(j) !== jobId);
        this.filteredJobs = [...this.jobs];
      }
      
      // Refresh the view
      setTimeout(() => {
        this.loadJobs(this.currentPage);
        this.loadJobseekerStats();
      }, 1000);
      
      return;
    }
    
    // Confirm withdrawal with user
    const confirmWithdraw = confirm(
      `⚠️ Withdraw Application?\n\n` +
      `Are you sure you want to withdraw your application for "${jobTitle}"?\n\n` +
      `✓ You can reapply anytime later\n` +
      `✓ The job will return to your recommended list\n` +
      `✓ The employer will be notified of your withdrawal\n\n` +
      `Click OK to confirm withdrawal.`
    );
    
    if (!confirmWithdraw) {
      console.log('❌ User cancelled withdrawal');
      return;
    }

    this.isApplying = jobId;
    console.log('🔄 Starting withdrawal process...');
    
    this.jobService.withdrawApplicationByJobId(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isApplying = null;
          console.log('🏁 Withdrawal process completed');
        }),
        catchError((error) => {
          console.error('❌ Error withdrawing application:', error);
          
          let errorMsg = 'Failed to withdraw application. Please try again.';
          let shouldSync = false;
          
          if (error.status === 400) {
            const backendMsg = error.error?.message || '';
            
            // If already withdrawn, clean up and sync
            if (backendMsg.includes('already withdrawn') || backendMsg.includes('not applied')) {
              errorMsg = 'This application was already withdrawn';
              shouldSync = true;
              
              // Clean up local state
              this.appliedJobIds = this.appliedJobIds.filter(id => id !== jobId);
              this.appliedJobsCount = Math.max(0, this.appliedJobsCount - 1);
              
              // ✅ FIX: Remove from Applied tab immediately
              if (this.activeTab === 'applied') {
                this.jobs = this.jobs.filter(j => this.getJobId(j) !== jobId);
                this.filteredJobs = [...this.jobs];
              }
              
            } else if (backendMsg.includes('accepted') || backendMsg.includes('rejected')) {
              errorMsg = 'Cannot withdraw: Application has already been processed by employer';
              
            } else {
              errorMsg = backendMsg || 'Cannot withdraw this application';
            }
          } else if (error.status === 404) {
            errorMsg = 'Application not found';
            shouldSync = true;
            this.appliedJobIds = this.appliedJobIds.filter(id => id !== jobId);
            
            // ✅ FIX: Remove from Applied tab immediately
            if (this.activeTab === 'applied') {
              this.jobs = this.jobs.filter(j => this.getJobId(j) !== jobId);
              this.filteredJobs = [...this.jobs];
            }
            
          } else if (error.status === 401) {
            errorMsg = 'Please log in to withdraw applications';
            this.authService.logout();
            
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }
          
          this.addNotification(`ℹ️ ${errorMsg}`, shouldSync ? 'info' : 'error');
          
          // Sync state if needed
          if (shouldSync) {
            setTimeout(() => {
              this.loadJobs(this.currentPage);
              this.loadJobseekerStats();
            }, 1000);
          }
          
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response: ApiResponse | any) => {
          if (!response || !(response as ApiResponse).success) {
            console.log('❌ Withdrawal failed');
            return;
          }
          
          console.log('✅ Withdrawal successful:', response);
          
          // ✅ FIX 1: Update local state - remove from applied jobs
          this.appliedJobIds = this.appliedJobIds.filter(id => id !== jobId);
          this.appliedJobsCount = Math.max(0, this.appliedJobsCount - 1);
          
          // ✅ FIX 2: If on Applied tab, remove the job from current view immediately
          if (this.activeTab === 'applied') {
            this.jobs = this.jobs.filter(j => this.getJobId(j) !== jobId);
            this.filteredJobs = [...this.jobs];
            console.log('✅ Removed job from Applied tab view');
          }
          
          // ✅ FIX 3: Update the job in the local cache (for other tabs)
          const jobIndex = this.jobs.findIndex(j => this.getJobId(j) === jobId);
          if (jobIndex !== -1 && this.activeTab !== 'applied') {
            this.jobs[jobIndex] = {
              ...this.jobs[jobIndex],
              has_applied: false,
              application_status: 'withdrawn'
            };
            this.filteredJobs = [...this.jobs];
          }
          
          // Show success message
          const wasAlreadyWithdrawn = response.message?.includes('already withdrawn');
          const successMsg = wasAlreadyWithdrawn
            ? `Application for "${jobTitle}" was already withdrawn`
            : `✅ Successfully withdrawn from "${jobTitle}"`;
          
          this.addNotification(successMsg, 'success');
          
          // Add info about where to find the job
          if (!wasAlreadyWithdrawn) {
            setTimeout(() => {
              this.addNotification(
                `💡 You can now find "${jobTitle}" in your Recommended jobs`, 
                'info'
              );
            }, 1500);
          }
          
          console.log('📊 Updated state:', {
            appliedJobIds: this.appliedJobIds,
            appliedJobsCount: this.appliedJobsCount,
            currentTab: this.activeTab,
            jobsInView: this.jobs.length
          });
          
          // ✅ FIX 4: Reload the current tab to sync with backend
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
    
    if (this.isJobSaved(jobId)) {
      console.log('🔄 Job already saved, toggling to unsave...');
      this.unsaveJob(jobId);
      return;
    }

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
          
          if (!this.savedJobIds.includes(jobId)) {
            this.savedJobIds.push(jobId);
            console.log('✅ Added to savedJobIds:', jobId);
          }
          
          this.savedJobsCount++;
          
          this.addNotification('💾 Job saved successfully!', 'success');
          
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
    // First check the appliedJobIds array
    if (!this.appliedJobIds.includes(jobId)) {
      return false;
    }
    
    // ✅ Double-check: If job is in the jobs array, verify its status
    const job = this.jobs.find(j => this.getJobId(j) === jobId);
    if (job) {
      const status = (job as any).application_status;
      // If withdrawn, remove from appliedJobIds and return false
      if (status === 'withdrawn') {
        this.appliedJobIds = this.appliedJobIds.filter(id => id !== jobId);
        return false;
      }
    }
    
    return true;
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

  getApplyButtonTitle(job: Job): string {
    const jobId = this.getJobId(job);
    
    if (this.isApplying === jobId) {
      return 'Processing your request...';
    }
    
    if (this.isJobApplied(jobId)) {
      return 'Click to withdraw your application for this job. You can reapply later if you change your mind.';
    }
    
    if (!this.isProfileComplete) {
      return `Complete your profile to apply (Currently ${this.profileCompletion}% complete, need 100%)`;
    }
    
    return 'Click to apply for this job with your current profile';
  }

  getApplyButtonClass(job: Job): string {
    const jobId = this.getJobId(job);
    const classes: string[] = ['apply-btn'];
    
    if (this.isJobApplied(jobId)) {
      classes.push('applied');
    }
    
    if (!this.isProfileComplete && !this.isJobApplied(jobId)) {
      classes.push('disabled-incomplete');
    }
    
    if (this.isApplying === jobId) {
      classes.push('loading');
    }
    
    return classes.join(' ');
  }

  isApplyButtonDisabled(job: Job): boolean {
    const jobId = this.getJobId(job);
    
    // Disabled if currently processing
    if (this.isApplying === jobId) {
      return true;
    }
    
    // Disabled if profile incomplete AND not already applied
    if (!this.isProfileComplete && !this.isJobApplied(jobId)) {
      return true;
    }
    
    // Otherwise, enabled (can apply or withdraw)
    return false;
  }

  getApplyButtonText(job: Job): string {
    const jobId = this.getJobId(job);
    
    if (this.isApplying === jobId) {
      return 'Processing...';
    }
    
    if (this.isJobApplied(jobId)) {
      return 'Withdraw Application';
    }
    
    if (!this.isProfileComplete) {
      return 'Complete Profile First';
    }
    
    return 'Apply Now';
  }

  getApplyButtonIcon(job: Job): string {
    const jobId = this.getJobId(job);
    
    if (this.isApplying === jobId) {
      return 'fa-spinner fa-spin';
    }
    
    if (this.isJobApplied(jobId)) {
      return 'fa-times-circle';
    }
    
    if (!this.isProfileComplete) {
      return 'fa-lock';
    }
    
    return 'fa-paper-plane';
  }

  loadNotifications(): void {
    if (typeof (this.jobService as any).getNotifications !== 'function') {
      console.warn('getNotifications method not found in JobService');
      return;
    }

    (this.jobService as any).getNotifications({ read: false })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response && response.success && response.data) {
            const allNotifications = response.data.notifications || [];
            this.jobNotifications = Array.isArray(allNotifications) ? allNotifications : [];
            this.unreadNotificationCount = this.jobNotifications.filter(n => !n.read).length;
          }
        },
        error: (err: any) => console.error('Error loading notifications:', err)
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
      'job_updated': 'fa-edit',
      'job_deleted': 'fa-trash-alt',
      'job_closed': 'fa-lock',
      'job_filled': 'fa-user-check',
      'application_received': 'fa-user-plus',
      'application_reviewed': 'fa-eye',
      'application_shortlisted': 'fa-star',
      'application_accepted': 'fa-check-circle',
      'application_rejected': 'fa-times-circle',
      'training_enrollment': 'fa-graduation-cap',
      'training_completed': 'fa-trophy',
      'certificate_issued': 'fa-certificate',
      'training_updated': 'fa-book',
      'interview_scheduled': 'fa-calendar',
      'test': 'fa-flask',
      'system': 'fa-cog'
    };
    
    return iconMap[type] || 'fa-bell';
  }

  getNotificationTitle(type: string): string {
    const titleMap: Record<string, string> = {
      'new_job': 'New Job Match',
      'job_updated': 'Job Updated',
      'job_deleted': 'Job Removed',
      'job_closed': 'Job Closed',
      'job_filled': 'Job Filled',
      'application_received': 'New Application',
      'application_reviewed': 'Application Reviewed',
      'application_shortlisted': 'You\'re Shortlisted!',
      'application_accepted': 'Application Accepted',
      'application_rejected': 'Application Status Update',
      'training_enrollment': 'Training Enrollment',
      'training_completed': 'Training Completed',
      'certificate_issued': 'Certificate Issued',
      'training_updated': 'Training Updated',
      'interview_scheduled': 'Interview Scheduled',
      'test': 'Test Notification',
      'system': 'System Notification'
    };
    
    return titleMap[type] || 'Notification';
  }

  handleNotificationClick(notification: any): void {
    console.log('📌 Notification clicked:', notification);
    
    if (!notification.read) {
      this.markNotificationAsRead(notification.id);
    }
    
    switch (notification.type) {
      case 'application_received':
        if (notification.metadata?.job_id) {
          this.router.navigate(['/employer/applications'], {
            queryParams: { jobId: notification.metadata.job_id }
          });
        }
        break;
      
      case 'new_job':
        if (notification.metadata?.job_id) {
          this.router.navigate(['/jobseeker/job-details', notification.metadata.job_id]);
        }
        break;
      
      case 'application_reviewed':
      case 'application_shortlisted':
      case 'application_accepted':
      case 'application_rejected':
        this.router.navigate(['/jobseeker/applications']);
        break;
      
      case 'job_updated':
      case 'job_deleted':
      case 'job_closed':
      case 'job_filled':
        this.router.navigate(['/jobseeker/job-explorer']);
        break;
      
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
      
      case 'test':
        console.log('Test notification - no navigation');
        break;
      
      default:
        console.log('No specific action for notification type:', notification.type);
    }
    
    this.showNotifications = false;
  }

  isJobNotification(type: string): boolean {
    return [
      'new_job', 
      'job_updated', 
      'job_deleted', 
      'job_closed', 
      'job_filled',
      'application_received'
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

  markNotificationAsRead(notificationId: string): void {
    const notification = this.jobNotifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
    }
    
    if (typeof (this.jobService as any).markNotificationRead !== 'function') {
      console.warn('markNotificationRead method not found in JobService');
      return;
    }

    (this.jobService as any).markNotificationRead(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => console.log('Notification marked as read'),
        error: (error: any) => {
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