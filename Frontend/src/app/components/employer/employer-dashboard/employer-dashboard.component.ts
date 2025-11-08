import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../../services/auth.service'; // Adjust path as needed
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
interface JobApplicant {
  id: string;
  name: string;
  position: string;
  matchScore: number;
  skills: string[];
  avatar: string;
  status: 'new' | 'reviewed' | 'interview' | 'hired' | 'rejected';
}

interface Interview {
  id: string;
  candidateName: string;
  position: string;
  date: string;
  time: string;
  type: 'online' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface ActivityItem {
  id: string;
  type: 'job_post' | 'training_post' | 'interview' | 'application' | 'certificate';
  message: string;
  timestamp: string;
  user?: string;
}

interface AnalyticsData {
  applications: { count: number; change: number };
  interviews: { count: number; change: number };
  hires: { count: number; change: number };
  timeToHire: { value: string; change: number };
}

@Component({
  selector: 'app-employer-dashboard',
  templateUrl: './employer-dashboard.component.html',
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  standalone: true,
  styleUrls: ['./employer-dashboard.component.css']
})
export class EmployerDashboardComponent implements OnInit, OnDestroy {
  employerName: string = 'Tech Innovators Ltd'; // Fallback
  profileCompletion = 85;
  
  // Dashboard stats
  activeJobs = 6;
  totalCandidates = 52;
  scheduledInterviews = 12;
  urgentActions = 4;
  
  // Top applicants with AI matching
  topApplicants: JobApplicant[] = [
    {
      id: '1',
      name: 'Sarah Developer',
      position: 'Frontend Developer',
      matchScore: 96,
      skills: ['React', 'TypeScript', 'Angular'],
      avatar: 'SD',
      status: 'new'
    },
    {
      id: '2',
      name: 'John Designer',
      position: 'UI/UX Designer',
      matchScore: 94,
      skills: ['Figma', 'Adobe XD', 'Prototyping'],
      avatar: 'JD',
      status: 'reviewed'
    },
    {
      id: '3',
      name: 'Mike Engineer',
      position: 'Backend Engineer',
      matchScore: 89,
      skills: ['Node.js', 'Python', 'MongoDB'],
      avatar: 'ME',
      status: 'interview'
    }
  ];

  // Upcoming interviews
  upcomingInterviews: Interview[] = [
    {
      id: '1',
      candidateName: 'Emma Wilson',
      position: 'Project Manager',
      date: 'Mon, Oct 6',
      time: '10:00 AM',
      type: 'online',
      status: 'scheduled'
    },
    {
      id: '2',
      candidateName: 'David Chen',
      position: 'Data Analyst',
      date: 'Mon, Oct 6',
      time: '02:30 PM',
      type: 'in-person',
      status: 'scheduled'
    },
    {
      id: '3',
      candidateName: 'Lisa Taylor',
      position: 'DevOps Engineer',
      date: 'Tue, Oct 7',
      time: '11:00 AM',
      type: 'online',
      status: 'scheduled'
    }
  ];

  // Recent activity
  recentActivity: ActivityItem[] = [
    {
      id: '1',
      type: 'job_post',
      message: 'Posted a new job: Senior React Developer',
      timestamp: '2 hours ago'
    },
    {
      id: '2',
      type: 'training_post',
      message: 'Created new training: Advanced JavaScript Concepts',
      timestamp: '4 hours ago'
    },
    {
      id: '3',
      type: 'interview',
      message: 'Scheduled interview with Maria Rodriguez',
      timestamp: '1 day ago',
      user: 'Jessica'
    },
    {
      id: '4',
      type: 'certificate',
      message: 'Issued 5 certificates for completed training',
      timestamp: '2 days ago'
    }
  ];

  // Analytics data
  analytics: AnalyticsData = {
    applications: { count: 156, change: 18 },
    interviews: { count: 34, change: 12 },
    hires: { count: 8, change: -2 },
    timeToHire: { value: '14d', change: 7 }
  };

  private authSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Ensure all data is initialized
    if (!this.recentActivity || this.recentActivity.length === 0) {
      console.warn('Recent activity data is empty or undefined');
    }

    // Subscribe to current user changes to update employerName dynamically
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user && user.user_type === 'employer') {
        // Assuming User has a 'name' or 'company_name' field; adjust as per your User interface
        this.employerName = user.name || user.company_name || 'Tech Innovators Ltd'; // Fallback
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // Action methods
  viewApplicant(applicantId: string): void {
    console.log('Viewing applicant:', applicantId);
  }

  contactApplicant(applicantId: string): void {
    console.log('Contacting applicant:', applicantId);
  }

  joinInterview(interviewId: string): void {
    console.log('Joining interview:', interviewId);
  }

  viewInterviewDetails(interviewId: string): void {
    console.log('Viewing interview details:', interviewId);
  }

  // UPDATED NAVIGATION METHODS - SIMPLIFIED
  createNewJobPost(): void {
    console.log('Navigating to post-jobs page...');
    
    this.router.navigate(['/employer/post-jobs']).catch(error => {
      console.log('Primary route failed, trying alternative...');
      this.router.navigate(['/post-jobs']).catch(() => {
        console.log('All navigation failed, using direct redirect');
        window.location.href = '/employer/post-jobs';
      });
    });
  }

  createNewTraining(): void {
    console.log('Navigating to training page...');
    
    this.router.navigate(['/employer/training']).catch(error => {
      console.log('Primary route failed, trying alternative...');
      this.router.navigate(['/training']).catch(() => {
        console.log('All navigation failed, using direct redirect');
        window.location.href = '/employer/training';
      });
    });
  }

  // Alternative direct navigation methods (backup)
  navigateToPostJobs(): void {
    window.location.href = '/employer/post-jobs';
  }

  navigateToTraining(): void {
    window.location.href = '/employer/training';
  }

  takeColorTest(): void {
    console.log('Taking color profiling test');
  }

  takeCareTest(): void {
    console.log('Taking care test');
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'job_post':
        return 'fas fa-briefcase';
      case 'training_post':
        return 'fas fa-graduation-cap';
      case 'interview':
        return 'fas fa-calendar-alt';
      case 'application':
        return 'fas fa-user-plus';
      case 'certificate':
        return 'fas fa-certificate';
      default:
        return 'fas fa-bell'; // Default icon
    }
  }

  getMatchScoreClass(score: number): string {
    if (score >= 95) return 'match-excellent';
    if (score >= 90) return 'match-great';
    if (score >= 80) return 'match-good';
    return 'match-fair';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'new':
        return 'status-new';
      case 'reviewed':
        return 'status-reviewed';
      case 'interview':
        return 'status-interview';
      case 'hired':
        return 'status-hired';
      case 'rejected':
        return 'status-rejected';
      default:
        return '';
    }
  }
}