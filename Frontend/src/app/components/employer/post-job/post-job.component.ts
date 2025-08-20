import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

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
  selector: 'app-post-job',
  templateUrl: './post-job.component.html',
  styleUrls: ['./post-job.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class PostJobComponent implements OnInit {
  employerName: string = 'TechCorp Solutions'; // Added employerName
  jobForm: FormGroup;
  jobPosts: JobPost[] = [];
sum: ((previousValue: JobPost, currentValue: JobPost, currentIndex: number, array: JobPost[]) => JobPost) | undefined;
activeJobPostsCount: any;
totalApplicants: any;

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
  }

  loadJobPosts(): void {
    const savedJobs = localStorage.getItem('jobPosts');
    this.jobPosts = savedJobs ? JSON.parse(savedJobs) : [];
  }

  saveJobPosts(): void {
    localStorage.setItem('jobPosts', JSON.stringify(this.jobPosts));
  }

  onSubmit(): void {
    if (this.jobForm.valid) {
      const jobData: JobPost = {
        ...this.jobForm.value,
        id: Date.now().toString(),
        status: 'Open',
        postedDate: new Date(),
        applicants: [],
      };
      this.jobPosts.unshift(jobData);
      this.saveJobPosts();
      alert('Job posted successfully!');
      this.jobForm.reset();
    } else {
      alert('Please fill all required fields correctly.');
    }
  }

  toggleJobStatus(job: JobPost): void {
    job.status = job.status === 'Open' ? 'Closed' : 'Open';
    this.saveJobPosts();
  }

  deleteJobPost(jobId: string): void {
    if (confirm('Are you sure you want to delete this job post?')) {
      this.jobPosts = this.jobPosts.filter((job) => job.id !== jobId);
      this.saveJobPosts();
    }
  }
}