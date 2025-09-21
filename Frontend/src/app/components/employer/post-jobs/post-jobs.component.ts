import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { JobService, Job, CreateJobRequest, JobStats } from '../../../../../services/job.service'

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
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule]
})
export class PostJobsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  employerName: string = 'TechCorp Solutions';
  jobForm: FormGroup;
  jobPosts: Job[] = [];
  filteredJobPosts: Job[] = [];
  jobStats: JobStats = {
    total_jobs: 0,
    active_jobs: 0,
    paused_jobs: 0,
    closed_jobs: 0,
    total_applications: 0,
    average_applications_per_job: 0,
    featured_jobs_count: 0,
    remote_jobs_count: 0,
    hybrid_jobs_count: 0
  };
  
  searchQuery: string = '';
  notifications: Notification[] = [];
  showAddForm: boolean = false;
  showJobDetails: boolean = false;
  selectedJob: Job | null = null;
  
  // Loading states
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  isDeleting: string | null = null; // Job ID being deleted
  isToggling: string | null = null; // Job ID being toggled
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  totalJobs: number = 0;

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
    this.loadJobPosts();
    this.loadJobStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadJobPosts(page: number = 1): void {
    this.isLoading = true;
    this.currentPage = page;
    
    const query = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      search: this.searchQuery || undefined,
      sort_by: 'created_at' as const,
      sort_order: 'DESC' as const
    };

    this.jobService.getMyJobs(query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobPosts = response.data.jobs;
            this.filteredJobPosts = [...this.jobPosts];
            this.totalJobs = response.data.pagination.total;
            this.totalPages = response.data.pagination.total_pages;
            this.jobService.updateJobsCache(this.jobPosts);
          } else {
            this.addNotification(response.message || 'Failed to load jobs', 'error');
          }
        },
        error: (error) => {
          console.error('Error loading jobs:', error);
          this.addNotification('Failed to load job posts. Please try again.', 'error');
        }
      });
  }

  loadJobStats(): void {
    this.jobService.getJobStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobStats = response.data;
          }
        },
        error: (error) => {
          console.error('Error loading job stats:', error);
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
      
      this.jobService.createJob(jobData)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isSubmitting = false)
        )
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.addNotification('Job posted successfully!', 'success');
              this.toggleAddForm();
              this.loadJobPosts(); // Reload to show new job
              this.loadJobStats(); // Update stats
            } else {
              this.addNotification(response.message || 'Failed to create job', 'error');
            }
          },
          error: (error) => {
            console.error('Error creating job:', error);
            let errorMessage = 'Failed to create job. Please try again.';
            
            if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.status === 400) {
              errorMessage = 'Please check all required fields and try again.';
            } else if (error.status === 401) {
              errorMessage = 'You are not authorized to create jobs. Please log in again.';
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
      // If search is empty, reload from server
      this.loadJobPosts();
      return;
    }
    
    // For local filtering while user types, we'll use local data
    const query = this.searchQuery.toLowerCase();
    this.filteredJobPosts = this.jobPosts.filter(job =>
      job.title.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query) ||
      job.skills_required.some(skill => skill.toLowerCase().includes(query)) ||
      job.location.toLowerCase().includes(query)
    );
  }

  onSearchSubmit(): void {
    // Perform server-side search
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
            
            this.loadJobStats(); // Update stats
            this.addNotification(`Job ${updatedJob.status.toLowerCase()} successfully`, 'info');
          } else {
            this.addNotification(response.message || 'Failed to update job status', 'error');
          }
        },
        error: (error) => {
          console.error('Error toggling job status:', error);
          this.addNotification('Failed to update job status. Please try again.', 'error');
        }
      });
  }

  deleteJobPost(jobId: string): void {
    const job = this.jobPosts.find(j => j.id === jobId);
    if (!job) return;
    
    const confirmMessage = `Are you sure you want to delete the job "${job.title}"? This action cannot be undone.`;
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
            
            this.loadJobStats(); // Update stats
            this.addNotification(`Job "${job.title}" deleted successfully`, 'success');
            
            // If this was the last item on the page, go to previous page
            if (this.filteredJobPosts.length === 0 && this.currentPage > 1) {
              this.loadJobPosts(this.currentPage - 1);
            }
          } else {
            this.addNotification(response.message || 'Failed to delete job', 'error');
          }
        },
        error: (error) => {
          console.error('Error deleting job:', error);
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
            this.loadJobPosts(); // Reload to show duplicated job
            this.loadJobStats(); // Update stats
          } else {
            this.addNotification(response.message || 'Failed to duplicate job', 'error');
          }
        },
        error: (error) => {
          console.error('Error duplicating job:', error);
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
            
            this.loadJobStats(); // Update stats
            this.addNotification(`Job "${job.title}" marked as filled`, 'success');
          } else {
            this.addNotification(response.message || 'Failed to mark job as filled', 'error');
          }
        },
        error: (error) => {
          console.error('Error marking job as filled:', error);
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

  // Computed properties for template
  get activeJobPostsCount(): number {
    return this.jobStats.active_jobs;
  }

  get totalApplicants(): number {
    return this.jobStats.total_applications;
  }
}