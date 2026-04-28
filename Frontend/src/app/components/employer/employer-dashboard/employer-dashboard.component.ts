import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TrainingService } from '../../../../../services/training.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../../services/auth.service';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

// ============================================
// INTERFACES
// ============================================

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

interface EnrollmentNotification {
  id: string;
  notification_type: 'new' | 'completed' | 'in_progress';
  jobseeker_id: string;
  jobseeker_name?: string;
  student_name?: string;
  training_id: string;
  training_title: string;
  enrollment_id: string;
  enrolled_at: string;
  progress_percentage?: number;
  certificate_issued: boolean;
  read?: boolean;
}

// ============================================
// COMPONENT
// ============================================

@Component({
  selector: 'app-employer-dashboard',
  templateUrl: './employer-dashboard.component.html',
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  standalone: true,
  styleUrls: ['./employer-dashboard.component.css']
})
export class EmployerDashboardComponent implements OnInit, OnDestroy {
  
  // ============================================
  // PROPERTIES
  // ============================================
  
  // Sidebar state
  sidebarOpen = false;
  
  // User info
  employerName: string = 'Tech Innovators Ltd';
  profileCompletion = 85;
  
  // Dashboard stats
  activeJobs = 6;
  totalCandidates = 52;
  scheduledInterviews = 12;
  urgentActions = 4;
  
  // Notifications
  showNotifications = false;
  enrollmentNotifications: EnrollmentNotification[] = [];
  hasMoreEnrollmentNotifications = false;

  // Enrollments modal
  showEnrollmentsModal: boolean = false;
  selectedTrainingId: string | null = null;
  selectedTrainingTitle: string | null = null;
  enrollments: any[] = [];
  
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

  // ============================================
  // CONSTRUCTOR
  // ============================================

  constructor(
    private router: Router,
  private authService: AuthService,
  private trainingService: TrainingService
  ) { }

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  ngOnInit(): void {
    // Initialize data validation
    if (!this.recentActivity || this.recentActivity.length === 0) {
      console.warn('Recent activity data is empty or undefined');
    }

    // Subscribe to current user changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user && user.user_type === 'employer') {
        this.employerName = user.name || user.company_name || 'Tech Innovators Ltd';
      }
    });

    // Load initial notifications
    this.loadEnrollmentNotifications();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // ============================================
  // SIDEBAR TOGGLE METHODS (Mobile Responsive)
  // ============================================

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

  // ============================================
  // NAVIGATION METHODS
  // ============================================

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

  // ============================================
  // APPLICANT MANAGEMENT
  // ============================================

  viewApplicant(applicantId: string): void {
    console.log('Viewing applicant:', applicantId);
    this.router.navigate(['/employer/applicants', applicantId]).catch(() => {
      console.log('Navigation to applicant failed');
    });
  }

  contactApplicant(applicantId: string): void {
    console.log('Contacting applicant:', applicantId);
    // Open contact modal or navigate to messaging
    alert(`Contact feature coming soon for applicant ${applicantId}`);
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

  // ============================================
  // INTERVIEW MANAGEMENT
  // ============================================

  joinInterview(interviewId: string): void {
    console.log('Joining interview:', interviewId);
    // Open video call or navigate to interview page
    this.router.navigate(['/employer/interviews', interviewId, 'join']).catch(() => {
      console.log('Navigation to interview failed');
    });
  }

  viewInterviewDetails(interviewId: string): void {
    console.log('Viewing interview details:', interviewId);
    this.router.navigate(['/employer/interviews', interviewId]).catch(() => {
      console.log('Navigation to interview details failed');
    });
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    
    if (this.showNotifications) {
      console.log('Notifications panel opened');
      this.loadEnrollmentNotifications();
    }
  }

  // ============================================
  // ENROLLMENTS MODAL (Employer)
  // ============================================

  openEnrollmentsModal(trainingId: string, trainingTitle: string): void {
    this.selectedTrainingId = trainingId;
    this.selectedTrainingTitle = trainingTitle;
    this.showEnrollmentsModal = true;
    this.loadEnrollments(trainingId);
  }

  closeEnrollmentsModal(): void {
    this.showEnrollmentsModal = false;
    this.selectedTrainingId = null;
    this.selectedTrainingTitle = null;
    this.enrollments = [];
  }

  loadEnrollments(trainingId: string): void {
    this.trainingService.getTrainingEnrollments(trainingId, { page: 1, limit: 100 })
      .subscribe({
        next: (res: any) => {
          if (res.success && res.data) {
            this.enrollments = res.data.enrollments || res.data;
          }
        },
        error: (err: any) => {
          console.error('Failed to load enrollments', err);
          this.enrollments = [];
        }
      });
  }

  markEnrollmentCompletion(enrollment: any, completed: boolean): void {
    if (!this.selectedTrainingId) return;
    if (!confirm(`Mark ${enrollment.user_name || enrollment.user?.first_name || 'trainee'} as ${completed ? 'completed' : 'not completed'}?`)) return;
    this.trainingService.markCompletion(this.selectedTrainingId, enrollment.id, completed)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            enrollment.completed = completed;
            alert('Completion updated');
          }
        },
        error: (err: any) => {
          console.error('Failed to update completion', err);
          alert('Failed to update completion status');
        }
      });
  }

  issueCertificateForEnrollment(enrollment: any): void {
    if (!this.selectedTrainingId) return;
    if (!confirm('Issue certificate for this trainee?')) return;
    this.trainingService.issueCertificate(this.selectedTrainingId, enrollment.id)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            enrollment.certificate_issued = true;
            alert('Certificate issued successfully');
          }
        },
        error: (err: any) => {
          console.error('Failed to issue certificate', err);
          alert('Failed to issue certificate');
        }
      });
  }

  loadEnrollmentNotifications(): void {
    console.log('Loading enrollment notifications...');
    
    // Mock data - replace with actual service call
    this.enrollmentNotifications = [
      {
        id: '1',
        notification_type: 'completed',
        jobseeker_id: 'js1',
        jobseeker_name: 'John Doe',
        training_id: 't1',
        training_title: 'JavaScript Fundamentals',
        enrollment_id: 'enr1',
        enrolled_at: new Date().toISOString(),
        progress_percentage: 100,
        certificate_issued: false,
        read: false
      },
      {
        id: '2',
        notification_type: 'new',
        jobseeker_id: 'js2',
        student_name: 'Jane Smith',
        training_id: 't2',
        training_title: 'React Advanced Patterns',
        enrollment_id: 'enr2',
        enrolled_at: new Date().toISOString(),
        progress_percentage: 0,
        certificate_issued: false,
        read: false
      }
    ];
    
    // Example implementation with actual service:
    // this.notificationService.getEnrollmentNotifications().subscribe({
    //   next: (response) => {
    //     if (response.success && response.data) {
    //       this.enrollmentNotifications = response.data;
    //     }
    //   },
    //   error: (error) => {
    //     console.error('Error loading notifications:', error);
    //   }
    // });
  }

  getNotificationColor(type: string): string {
    const colorMap: Record<string, string> = {
      'new': '#3b82f6',
      'completed': '#10b981',
      'in_progress': '#f59e0b'
    };
    return colorMap[type] || '#6b7280';
  }

  getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'new': 'fa-user-plus',
      'completed': 'fa-check-circle',
      'in_progress': 'fa-spinner'
    };
    return iconMap[type] || 'fa-bell';
  }

  getJobseekerDisplayName(notification: EnrollmentNotification): string {
    return notification.jobseeker_name || notification.student_name || 'Student';
  }

  viewStudentProfile(notification: EnrollmentNotification): void {
    console.log('Viewing student profile:', notification);
    this.router.navigate(['/employer/students', notification.jobseeker_id]).catch(() => {
      console.log('Navigation to student profile failed');
    });
  }

  // ============================================
  // CERTIFICATE MANAGEMENT
  // ============================================

  issueCertificateFromNotification(notification: EnrollmentNotification): void {
    console.log('Issuing certificate for:', notification);
    
    const studentName = this.getJobseekerDisplayName(notification);
    if (confirm(`Issue certificate for ${studentName}?`)) {
      this.issueCertificate(notification.enrollment_id);
    }
  }

  issueCertificate(enrollmentId: string): void {
    console.log('Issuing certificate for enrollment:', enrollmentId);
    
    // Mock implementation - replace with actual service call
    alert('Certificate issued successfully!');
    
    // Update notification status
    const notification = this.enrollmentNotifications.find(n => n.enrollment_id === enrollmentId);
    if (notification) {
      notification.certificate_issued = true;
    }
    
    // Example implementation with actual service:
    // this.certificateService.issueCertificate(enrollmentId).subscribe({
    //   next: (response) => {
    //     if (response.success) {
    //       alert('Certificate issued successfully!');
    //       this.loadEnrollmentNotifications();
    //     }
    //   },
    //   error: (error) => {
    //     console.error('Error issuing certificate:', error);
    //     alert('Failed to issue certificate. Please try again.');
    //   }
    // });
  }

  downloadEmployerCertificate(enrollmentId: string): void {
    console.log('Downloading certificate for enrollment:', enrollmentId);
    
    // Mock implementation - replace with actual service call
    alert(`Downloading certificate for enrollment ${enrollmentId}`);
    
    // Example implementation with actual service:
    // this.certificateService.downloadCertificate(enrollmentId).subscribe({
    //   next: (blob: Blob) => {
    //     const url = window.URL.createObjectURL(blob);
    //     const link = document.createElement('a');
    //     link.href = url;
    //     link.download = `certificate_${enrollmentId}.pdf`;
    //     document.body.appendChild(link);
    //     link.click();
    //     document.body.removeChild(link);
    //     window.URL.revokeObjectURL(url);
    //   },
    //   error: (error) => {
    //     console.error('Error downloading certificate:', error);
    //     alert('Failed to download certificate.');
    //   }
    // });
  }

  markAllEnrollmentNotificationsRead(): void {
    console.log('Marking all notifications as read...');
    
    this.enrollmentNotifications.forEach(n => n.read = true);
    alert('All notifications marked as read');
    
    // Example implementation with actual service:
    // this.notificationService.markAllRead().subscribe({
    //   next: () => {
    //     this.enrollmentNotifications.forEach(n => n.read = true);
    //     alert('All notifications marked as read');
    //   },
    //   error: (error) => {
    //     console.error('Error marking notifications as read:', error);
    //   }
    // });
  }

  loadMoreEnrollmentNotifications(): void {
    console.log('Loading more notifications...');
    // Implement pagination logic
    this.hasMoreEnrollmentNotifications = false;
  }

  confirmClearEnrollmentNotifications(): void {
    if (confirm('Are you sure you want to clear all read notifications?')) {
      this.clearEnrollmentNotifications();
    }
  }

  clearEnrollmentNotifications(): void {
    console.log('Clearing read notifications...');
    this.enrollmentNotifications = this.enrollmentNotifications.filter(n => !n.read);
    alert('Read notifications cleared');
  }

  // ============================================
  // ACTIVITY TRACKING
  // ============================================

  getActivityIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'job_post': 'fas fa-briefcase',
      'training_post': 'fas fa-graduation-cap',
      'interview': 'fas fa-calendar-check',
      'application': 'fas fa-file-alt',
      'certificate': 'fas fa-certificate'
    };
    return iconMap[type] || 'fas fa-circle';
  }

  // ============================================
  // ADDITIONAL UTILITY METHODS
  // ============================================

  takeColorTest(): void {
    console.log('Taking color profiling test');
    this.router.navigate(['/employer/assessments/color-test']).catch(() => {
      alert('Color profiling test coming soon!');
    });
  }

  takeCareTest(): void {
    console.log('Taking care test');
    this.router.navigate(['/employer/assessments/care-test']).catch(() => {
      alert('Care assessment test coming soon!');
    });
  }

  refreshDashboard(): void {
    console.log('Refreshing dashboard data...');
    this.loadEnrollmentNotifications();
    // Add other data refresh calls as needed
  }
}