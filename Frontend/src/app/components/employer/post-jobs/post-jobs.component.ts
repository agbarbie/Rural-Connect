import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

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

@Component({
  selector: 'app-post-jobs',
  templateUrl: './post-jobs.component.html',
  styleUrls: ['./post-jobs.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class PostJobsComponent implements OnInit {
  employerName: string = 'TechCorp Solutions';
  jobForm: FormGroup;
  jobPosts: JobPost[] = [];
  activeJobPostsCount: number = 0;
  totalApplicants: number = 0;

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
    this.updateStats();
  }

  loadJobPosts(): void {
    // For demo purposes, using in-memory storage instead of localStorage
    // since localStorage isn't available in artifacts
    if (this.jobPosts.length === 0) {
      // Add some sample data
      this.jobPosts = [
        {
          id: '1',
          jobTitle: 'Senior Frontend Developer',
          location: 'Nairobi, Kenya',
          salary: 'KES 150,000 - 200,000',
          duration: 'Full-time',
          skills: 'React, TypeScript, Angular',
          description: 'We are looking for an experienced frontend developer...',
          status: 'Open',
          postedDate: new Date(),
          applicants: ['1', '2', '3']
        },
        {
          id: '2',
          jobTitle: 'Backend Developer',
          location: 'Remote',
          salary: 'KES 120,000 - 180,000',
          duration: 'Full-time',
          skills: 'Node.js, Python, MongoDB',
          description: 'Join our team as a backend developer...',
          status: 'Open',
          postedDate: new Date(),
          applicants: ['4', '5']
        }
      ];
    }
  }

  updateStats(): void {
    this.activeJobPostsCount = this.jobPosts.filter(job => job.status === 'Open').length;
    this.totalApplicants = this.jobPosts.reduce((total, job) => total + job.applicants.length, 0);
  }

  onSubmit(): void {
    if (this.jobForm.valid) {
      const jobData: JobPost = {
        ...this.jobForm.value,
        id: Date.now().toString(),
        status: 'Open' as const,
        postedDate: new Date(),
        applicants: [],
      };
      
      this.jobPosts.unshift(jobData);
      this.updateStats();
      alert('Job posted successfully!');
      this.jobForm.reset();
    } else {
      alert('Please fill all required fields correctly.');
    }
  }

  toggleJobStatus(job: JobPost): void {
    job.status = job.status === 'Open' ? 'Closed' : 'Open';
    this.updateStats();
  }

  deleteJobPost(jobId: string): void {
    if (confirm('Are you sure you want to delete this job post?')) {
      this.jobPosts = this.jobPosts.filter((job) => job.id !== jobId);
      this.updateStats();
    }
  }
}