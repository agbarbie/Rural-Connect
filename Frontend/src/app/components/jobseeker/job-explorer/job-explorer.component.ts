import { Component, OnInit } from '@angular/core';
import { CommonModule} from '@angular/common';
import { FormsModule } from '@angular/forms';
interface Job {
  id: number;
  title: string;
  company: string;
  companyLogo: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  location: 'Remote' | 'Hybrid' | 'On-site';
  salary: string;
  postedDays: number;
  description: string;
  matchScore: number;
  rating: number;
  skills: string[];
  benefits: string[];
}

@Component({
  selector: 'app-job-explorer',
  templateUrl: './job-explorer.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./job-explorer.component.css']
})
export class JobExplorerComponent implements OnInit {
  jobs: Job[] = [
    {
      id: 1,
      title: 'Senior UX Designer',
      company: 'Google Inc.',
      companyLogo: 'https://logo.clearbit.com/google.com',
      type: 'Full-time',
      location: 'Remote',
      salary: '$120k-165k',
      postedDays: 2,
      description: 'We are looking for a Senior UX Designer to join our team and help create exceptional user experiences for our products. You will work closely with product managers, engineers, and other designers to create user-centered designs.',
      matchScore: 92,
      rating: 4.8,
      skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
      benefits: ['Health Insurance', 'Stock Options', 'Flexible Hours']
    },
    {
      id: 2,
      title: 'Frontend Developer',
      company: 'Microsoft',
      companyLogo: 'https://logo.clearbit.com/microsoft.com',
      type: 'Full-time',
      location: 'Hybrid',
      salary: '$90k-120k',
      postedDays: 3,
      description: 'Microsoft is seeking a talented Frontend Developer to join our team. In this role, you will be responsible for building and maintaining web applications using modern JavaScript frameworks and technologies.',
      matchScore: 88,
      rating: 4.6,
      skills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
      benefits: ['Health Insurance', 'Retirement Plan', 'Learning Budget']
    },
    {
      id: 3,
      title: 'Product Manager',
      company: 'Meta',
      companyLogo: 'https://logo.clearbit.com/meta.com',
      type: 'Full-time',
      location: 'Remote',
      salary: '$140k-180k',
      postedDays: 1,
      description: 'Join Meta as a Product Manager and drive the development of innovative products that connect billions of people worldwide. You will work with cross-functional teams to define product strategy and roadmap.',
      matchScore: 85,
      rating: 4.5,
      skills: ['Product Strategy', 'Analytics', 'Agile', 'Leadership'],
      benefits: ['Stock Options', 'Health Insurance', 'Wellness Programs']
    },
    {
      id: 4,
      title: 'Data Scientist',
      company: 'Amazon',
      companyLogo: 'https://logo.clearbit.com/amazon.com',
      type: 'Full-time',
      location: 'Hybrid',
      salary: '$110k-150k',
      postedDays: 4,
      description: 'Amazon is looking for a Data Scientist to analyze large datasets and provide insights that drive business decisions. You will work with machine learning models and statistical analysis.',
      matchScore: 90,
      rating: 4.7,
      skills: ['Python', 'Machine Learning', 'SQL', 'Statistics'],
      benefits: ['Health Insurance', 'Stock Purchase Plan', 'Career Development']
    },
    {
      id: 5,
      title: 'DevOps Engineer',
      company: 'Netflix',
      companyLogo: 'https://logo.clearbit.com/netflix.com',
      type: 'Contract',
      location: 'Remote',
      salary: '$95k-130k',
      postedDays: 5,
      description: 'Netflix seeks a DevOps Engineer to help maintain and scale our infrastructure. You will work with cloud technologies and automation tools to ensure reliable service delivery.',
      matchScore: 83,
      rating: 4.4,
      skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
      benefits: ['Flexible Schedule', 'Learning Resources', 'Equipment Allowance']
    }
  ];

  filteredJobs: Job[] = [];
  selectedJobType: string = '';
  selectedLocation: string = '';
  selectedSalaryRange: string = '';
  sortBy: string = 'match-score';
  
  recommendedCount: number = 0;
  savedJobsCount: number = 0;
  appliedJobsCount: number = 0;
  
  activeTab: string = 'recommended';

  ngOnInit(): void {
    this.filteredJobs = [...this.jobs];
    this.recommendedCount = this.jobs.length;
    this.sortJobs();
  }

  filterJobs(): void {
    this.filteredJobs = this.jobs.filter(job => {
      const typeMatch = !this.selectedJobType || job.type === this.selectedJobType;
      const locationMatch = !this.selectedLocation || job.location === this.selectedLocation;
      const salaryMatch = !this.selectedSalaryRange || this.checkSalaryRange(job.salary, this.selectedSalaryRange);
      
      return typeMatch && locationMatch && salaryMatch;
    });
    
    this.sortJobs();
  }

  checkSalaryRange(jobSalary: string, selectedRange: string): boolean {
    // Simple salary range matching logic
    const salaryNum = parseInt(jobSalary.replace(/[^0-9]/g, ''));
    
    switch(selectedRange) {
      case '50k-80k':
        return salaryNum >= 50 && salaryNum < 80;
      case '80k-120k':
        return salaryNum >= 80 && salaryNum < 120;
      case '120k+':
        return salaryNum >= 120;
      default:
        return true;
    }
  }

  sortJobs(): void {
    switch(this.sortBy) {
      case 'match-score':
        this.filteredJobs.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case 'newest':
        this.filteredJobs.sort((a, b) => a.postedDays - b.postedDays);
        break;
      case 'salary':
        this.filteredJobs.sort((a, b) => {
          const aSalary = parseInt(a.salary.replace(/[^0-9]/g, ''));
          const bSalary = parseInt(b.salary.replace(/[^0-9]/g, ''));
          return bSalary - aSalary;
        });
        break;
      case 'rating':
        this.filteredJobs.sort((a, b) => b.rating - a.rating);
        break;
    }
  }

  onJobTypeChange(): void {
    this.filterJobs();
  }

  onLocationChange(): void {
    this.filterJobs();
  }

  onSalaryChange(): void {
    this.filterJobs();
  }

  onSortChange(): void {
    this.sortJobs();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  applyToJob(jobId: number): void {
    console.log(`Applying to job with ID: ${jobId}`);
    // Add your application logic here
  }

  saveJob(jobId: number): void {
    console.log(`Saving job with ID: ${jobId}`);
    // Add your save job logic here
  }

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
}