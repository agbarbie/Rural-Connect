import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface JobPost {
  id: string;
  jobTitle: string;
  location: string;
  salary: string;
  duration: string;
  skills: string;
  description: string;
  status: 'Open' | 'Closed';
  postedDate: Date;
  applicants: string[];
}

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
export class PostJobsComponent implements OnInit {
  employerName: string = 'TechCorp Solutions';
  jobForm: FormGroup;
  jobPosts: JobPost[] = [];
  filteredJobPosts: JobPost[] = [];
  activeJobPostsCount: number = 0;
  totalApplicants: number = 0;
  searchQuery: string = '';
  notifications: Notification[] = [];
  showAddForm: boolean = false;
  showJobDetails: boolean = false;
  selectedJob: JobPost | null = null;

  constructor(private fb: FormBuilder) {
    this.jobForm = this.fb.group({
      jobTitle: ['', [Validators.required]],
      location: ['', [Validators.required]],
      salary: ['', [Validators.required]],
      duration: ['', [Validators.required]],
      skills: ['', [Validators.required]],
      description: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadJobPosts();
    this.filteredJobPosts = [...this.jobPosts];
  }

  loadJobPosts(): void {
    this.jobPosts = [
      {
        id: '1',
        jobTitle: 'Frontend Developer',
        location: 'Nairobi, Kenya',
        salary: '$80,000 - $120,000',
        duration: 'Full-time',
        skills: 'React, TypeScript, CSS',
        description: 'Join our team to build cutting-edge web applications with a focus on user experience.',
        status: 'Open',
        postedDate: new Date('2025-07-15'),
        applicants: ['1', '2', '3']
      },
      {
        id: '2',
        jobTitle: 'Data Analyst',
        location: 'Remote',
        salary: '$60,000 - $90,000',
        duration: 'Contract',
        skills: 'Python, SQL, Tableau',
        description: 'Analyze data to provide actionable insights for our business operations.',
        status: 'Open',
        postedDate: new Date('2025-08-01'),
        applicants: ['4']
      },
      {
        id: '3',
        jobTitle: 'Product Manager',
        location: 'Lagos, Nigeria',
        salary: '$100,000 - $150,000',
        duration: 'Full-time',
        skills: 'Agile, Leadership, UX',
        description: 'Lead product development and strategy for our SaaS platform.',
        status: 'Closed',
        postedDate: new Date('2025-06-20'),
        applicants: ['5', '6']
      }
    ];
    this.updateStats();
  }

  updateStats(): void {
    this.activeJobPostsCount = this.jobPosts.filter(job => job.status === 'Open').length;
    this.totalApplicants = this.jobPosts.reduce((total, job) => total + job.applicants.length, 0);
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.jobForm.reset();
    }
  }

  onSubmit(): void {
    if (this.jobForm.valid) {
      const jobData: JobPost = {
        ...this.jobForm.value,
        id: Date.now().toString(),
        status: 'Open',
        postedDate: new Date(),
        applicants: []
      };
      
      this.jobPosts.unshift(jobData);
      this.filteredJobPosts = [...this.jobPosts];
      this.updateStats();
      this.addNotification('Job posted successfully!', 'success');
      this.toggleAddForm();
    } else {
      this.addNotification('Please fill all required fields correctly.', 'error');
    }
  }

  filterJobPosts(): void {
    const query = this.searchQuery.toLowerCase();
    this.filteredJobPosts = this.jobPosts.filter(job =>
      job.jobTitle.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query) ||
      job.skills.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query)
    );
  }

  viewJobDetails(job: JobPost): void {
    this.selectedJob = job;
    this.showJobDetails = true;
  }

  closeJobDetails(): void {
    this.showJobDetails = false;
    this.selectedJob = null;
  }

  toggleJobStatus(job: JobPost): void {
    job.status = job.status === 'Open' ? 'Closed' : 'Open';
    this.updateStats();
    this.addNotification(`Job ${job.jobTitle} is now ${job.status}`, 'info');
  }

  deleteJobPost(jobId: string): void {
    if (confirm('Are you sure you want to delete this job post?')) {
      const job = this.jobPosts.find(j => j.id === jobId);
      this.jobPosts = this.jobPosts.filter(j => j.id !== jobId);
      this.filteredJobPosts = [...this.jobPosts];
      this.updateStats();
      if (this.showJobDetails && this.selectedJob?.id === jobId) {
        this.closeJobDetails();
      }
      if (job) {
        this.addNotification(`Job ${job.jobTitle} deleted successfully`, 'success');
      }
    }
  }

  addNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const id = Date.now().toString();
    this.notifications.push({ id, message, type });
    setTimeout(() => this.dismissNotification(id), 5000);
  }

  dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }
}