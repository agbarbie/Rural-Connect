import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { JobService, Job } from '../../../../../services/job.service';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-job-explorer',
  templateUrl: './job-explorer.component.html',
  imports: [CommonModule, FormsModule],
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
  
  // Cache for match scores and ratings to avoid ExpressionChangedAfterItHasBeenCheckedError
  private matchScoreCache: Map<string, number> = new Map();
  private ratingCache: Map<string, number> = new Map();
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  totalJobs: number = 0;

  constructor(private jobService: JobService) {}

  ngOnInit(): void {
    this.loadJobs();
    this.loadJobseekerStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadJobs(page: number = 1): void {
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
    if (this.searchQuery) {
      query.search = this.searchQuery;
    }
    if (this.selectedJobType) {
      query.employment_type = this.selectedJobType;
    }
    if (this.selectedLocation) {
      query.work_arrangement = this.selectedLocation;
    }
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
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          console.log('Raw API response:', response);
          
          if (response.success && response.data) {
            // Handle different response structures based on tab
            if (this.activeTab === 'saved' || this.activeTab === 'applied') {
              // For saved/applied, the data structure is different
              // It returns an array directly or in a 'data' property
              const dataArray = response.data.data || response.data;
              
              if (Array.isArray(dataArray)) {
                this.jobs = dataArray;
                
                // Mark all these jobs as saved/applied
                dataArray.forEach((item: any) => {
                  if (this.activeTab === 'saved') {
                    const jobId = item.job_id || item.id;
                    if (jobId && !this.savedJobIds.includes(jobId)) {
                      this.savedJobIds.push(jobId);
                    }
                  } else if (this.activeTab === 'applied') {
                    const jobId = item.job_id || item.id;
                    if (jobId && !this.appliedJobIds.includes(jobId)) {
                      this.appliedJobIds.push(jobId);
                    }
                  }
                });
              } else {
                this.jobs = [];
              }
            } else {
              // For recommended and all jobs
              this.jobs = response.data.jobs || response.data.data || [];
            }
            
            this.filteredJobs = [...this.jobs];
            
            if (response.data.pagination) {
              this.totalJobs = response.data.pagination.total;
              this.totalPages = response.data.pagination.total_pages;
            } else {
              this.totalJobs = this.jobs.length;
              this.totalPages = 1;
            }
            
            this.recommendedCount = this.activeTab === 'recommended' ? this.totalJobs : this.recommendedCount;
            
            // Track which jobs are saved/applied based on backend response flags
            this.jobs.forEach(job => {
              if ((job as any).is_saved) {
                if (!this.savedJobIds.includes(job.id)) {
                  this.savedJobIds.push(job.id);
                }
              }
              if ((job as any).has_applied) {
                if (!this.appliedJobIds.includes(job.id)) {
                  this.appliedJobIds.push(job.id);
                }
              }
            });
            
            console.log('Jobs loaded:', this.jobs.length);
            console.log('Saved job IDs:', this.savedJobIds);
            console.log('Applied job IDs:', this.appliedJobIds);
          }
        },
        error: (error) => {
          console.error('Error loading jobs:', error);
          this.addNotification('Failed to load jobs. Please try again.', 'error');
        }
      });
  }

  loadJobseekerStats(): void {
    this.jobService.getJobseekerStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.savedJobsCount = response.data.total_saved_jobs || 0;
            this.appliedJobsCount = response.data.total_applications || 0;
          }
        },
        error: (error) => {
          console.error('Error loading stats:', error);
          // Don't show error notification for stats
        }
      });
  }

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

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadJobs(1);
  }

  applyToJob(jobId: string): void {
    if (this.isJobApplied(jobId)) {
      return;
    }

    this.isApplying = jobId;
    
    // You can customize this application data
    const applicationData = {
      coverLetter: '', // Can be filled from a modal/form
      resumeId: undefined,
      portfolioUrl: undefined,
      expectedSalary: undefined,
      availabilityDate: undefined
    };

    this.jobService.applyToJob(jobId, applicationData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isApplying = null)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.appliedJobIds.push(jobId);
            this.appliedJobsCount++;
            
            const job = this.jobs.find(j => j.id === jobId);
            this.notificationMessage = `Application submitted successfully for ${job?.title || 'this job'}!`;
            this.showNotification = true;
            
            setTimeout(() => this.hideNotification(), 4000);
            
            this.loadJobseekerStats();
          } else {
            this.addNotification(response.message || 'Failed to apply', 'error');
          }
        },
        error: (error) => {
          console.error('Error applying to job:', error);
          const errorMsg = error.error?.message || 'Failed to apply. Please try again.';
          this.addNotification(errorMsg, 'error');
        }
      });
  }

  saveJob(jobId: string): void {
    console.log('=== SAVE JOB CLICKED ===');
    console.log('Job ID:', jobId);
    console.log('Is authenticated?', this.jobService['authService'].isAuthenticated());
    console.log('Current user:', this.jobService['authService'].getCurrentUser());
    console.log('Is already saved?', this.isJobSaved(jobId));
    console.log('SavedJobIds array:', this.savedJobIds);
    console.log('========================');
    
    if (this.isJobSaved(jobId)) {
      console.log('Job is already saved, unsaving...');
      this.unsaveJob(jobId);
      return;
    }

    this.isSaving = jobId;
    console.log('Calling save API...');
    
    this.jobService.saveJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('Save API call completed');
          this.isSaving = null;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Save job response:', response);
          if (response.success) {
            if (!this.savedJobIds.includes(jobId)) {
              this.savedJobIds.push(jobId);
            }
            this.savedJobsCount++;
            this.addNotification('Job saved successfully!', 'success');
            this.loadJobseekerStats();
            console.log('Updated savedJobIds:', this.savedJobIds);
          } else {
            console.error('Save failed:', response.message);
            this.addNotification(response.message || 'Failed to save job', 'error');
          }
        },
        error: (error) => {
          console.error('Error saving job:', error);
          console.error('Error details:', error.error);
          const errorMsg = error.error?.message || 'Failed to save job. Please try again.';
          this.addNotification(errorMsg, 'error');
        }
      });
  }

  unsaveJob(jobId: string): void {
    console.log('Unsave job clicked for ID:', jobId);
    this.isSaving = jobId;
    
    this.jobService.unsaveJob(jobId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('Unsave API call completed');
          this.isSaving = null;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Unsave job response:', response);
          if (response.success) {
            this.savedJobIds = this.savedJobIds.filter(id => id !== jobId);
            this.savedJobsCount = Math.max(0, this.savedJobsCount - 1);
            this.addNotification('Job removed from saved list', 'info');
            
            if (this.activeTab === 'saved') {
              this.loadJobs(this.currentPage);
            }
            this.loadJobseekerStats();
            console.log('Updated savedJobIds:', this.savedJobIds);
          } else {
            console.error('Unsave failed:', response.message);
            this.addNotification(response.message || 'Failed to unsave job', 'error');
          }
        },
        error: (error) => {
          console.error('Error unsaving job:', error);
          console.error('Error details:', error.error);
          const errorMsg = error.error?.message || 'Failed to unsave job. Please try again.';
          this.addNotification(errorMsg, 'error');
        }
      });
  }

  isJobApplied(jobId: string): boolean {
    return this.appliedJobIds.includes(jobId);
  }

  isJobSaved(jobId: string): boolean {
    return this.savedJobIds.includes(jobId);
  }

  hideNotification(): void {
    this.showNotification = false;
    this.notificationMessage = '';
  }

  addNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const id = Date.now().toString();
    this.notifications.push({ id, message, type });
    setTimeout(() => this.dismissNotification(id), 5000);
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  // Pagination
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

  // Helper method to get job ID from different structures
  getJobId(job: any): string {
    return job.job_id || job.id;
  }

  // Helper methods for template
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
    // Use a data URL for placeholder instead of external service
    const letter = (job.company_name || 'C').charAt(0).toUpperCase();
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='%234285f4'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='white'%3E${letter}%3C/text%3E%3C/svg%3E`;
  }

  // Calculate match score (you can customize this logic)
  getMatchScore(job: Job): number {
    const jobId = this.getJobId(job);
    
    // Return cached value if exists
    if (this.matchScoreCache.has(jobId)) {
      return this.matchScoreCache.get(jobId)!;
    }
    
    // Calculate and cache the score
    const score = Math.floor(Math.random() * 20) + 80; // Returns 80-100
    this.matchScoreCache.set(jobId, score);
    return score;
  }

  getRating(job: Job): number {
    const jobId = this.getJobId(job);
    
    // Return cached value if exists
    if (this.ratingCache.has(jobId)) {
      return this.ratingCache.get(jobId)!;
    }
    
    // Calculate rating based on applications_count or views_count
    const baseRating = 4.0;
    const bonus = Math.min(job.applications_count * 0.01, 0.9);
    const rating = Math.min(baseRating + bonus, 5.0);
    
    // Cache the rating
    this.ratingCache.set(jobId, rating);
    return rating;
  }
}