import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../../services/auth.service'; // Adjust path as needed
import { ProfileService, ProfileCompletionResponse } from '../../../../../services/profile.service'; // Adjust path as needed
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.component.html',
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  standalone: true,
  styleUrls: ['dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  userName: string = 'Job Seeker'; // Fallback
  
  // Dashboard stats
  stats = {
    profileViews: 127,
    applications: 8,
    interviews: 2,
    savedJobs: 15,
    trainingCompleted: 3
  };

  // Recent Activity
  recentActivity = [
    {
      company: 'TechCorp Inc.',
      action: 'applied to Frontend Developer',
      timestamp: '2 hours ago',
      icon: 'fa-briefcase',
      initial: 'TC'
    },
    {
      company: 'DesignHub',
      action: 'interview scheduled',
      timestamp: '1 day ago',
      icon: 'fa-calendar-alt',
      initial: 'DH'
    },
    {
      company: 'CodeAcademy',
      action: 'completed training module',
      timestamp: '3 days ago',
      icon: 'fa-graduation-cap',
      initial: 'CA'
    }
  ];

  // AI Recommendations
  aiRecommendations = [
    {
      title: 'Advanced React Hooks',
      provider: 'Udemy',
      relevance: 'High',
      duration: '4h 30m',
      icon: 'fa-code',
      initial: 'RH'
    },
    {
      title: 'UI/UX Design Principles',
      provider: 'Coursera',
      relevance: 'Medium',
      duration: '6h 15m',
      icon: 'fa-paint-brush',
      initial: 'UD'
    }
  ];

  // Recent Applications
  recentApplications = [
    {
      jobTitle: 'Senior Frontend Developer',
      company: 'InnovateTech',
      appliedDate: '1 day ago',
      status: 'Under Review',
      tags: ['React', 'TypeScript', 'Remote'],
      initial: 'IT'
    },
    {
      jobTitle: 'Product Designer',
      company: 'Creative Studios',
      appliedDate: '3 days ago',
      status: 'Interview Scheduled',
      tags: ['Figma', 'UX/UI', 'Full-time'],
      initial: 'CS'
    }
  ];

  // Best Job Matches
  bestJobMatches = [
    {
      title: 'Full Stack Engineer',
      company: 'Global Solutions',
      matchPercentage: 92
    },
    {
      title: 'DevOps Specialist',
      company: 'CloudNine Tech',
      matchPercentage: 88
    }
  ];

  // Skills Progress
  skillsProgress = [
    {
      name: 'React.js',
      percentage: 85
    },
    {
      name: 'Node.js',
      percentage: 72
    },
    {
      name: 'CSS3',
      percentage: 95
    }
  ];

  // Recommended Training
  recommendedTraining = [
    {
      title: 'Machine Learning Basics',
      provider: 'edX',
      relevance: 'High',
      iconColor: '#4F46E5',
      iconTextColor: '#FFFFFF',
      buttonColor: '#4F46E5',
      buttonBorder: 'none',
      initial: 'ML'
    },
    {
      title: 'Data Visualization with D3',
      provider: 'Pluralsight',
      relevance: 'Medium',
      iconColor: '#10B981',
      iconTextColor: '#FFFFFF',
      buttonColor: '#10B981',
      buttonBorder: 'none',
      initial: 'DV'
    }
  ];

  // Upcoming Interviews
  upcomingInterviews = [
    {
      id: '1',
      position: 'Frontend Developer',
      company: 'TechCorp',
      date: 'Wed, Oct 8',
      time: '2:00 PM',
      type: 'online',
      interviewers: ['Sarah Johnson', 'Mike Chen'],
      padding: '16px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      marginBottom: '12px',
      iconColor: '#3B82F6',
      iconTextColor: '#FFFFFF',
      iconBorderRadius: '50%',
      marginTop1: '8px',
      statusColor: '#10B981',
      statusTextColor: '#FFFFFF',
      statusPadding: '4px 8px',
      statusBorderRadius: '4px',
      statusFontSize: '12px',
      marginTop2: '12px',
      interviewerColor: '#374151',
      interviewerFontSize: '14px',
      marginTop3: '16px',
      actionsDisplay: 'flex',
      actionsGap: '8px',
      prepareButtonColor: '#3B82F6',
      prepareButtonTextColor: '#FFFFFF',
      prepareButtonBorder: 'none',
      prepareButtonPadding: '8px 16px',
      prepareButtonBorderRadius: '6px',
      prepareButtonFontSize: '14px',
      prepareButtonText: 'Prepare',
      rescheduleButtonColor: '#6B7280',
      rescheduleButtonTextColor: '#FFFFFF',
      rescheduleButtonBorder: 'none',
      rescheduleButtonPadding: '8px 16px',
      rescheduleButtonBorderRadius: '6px',
      rescheduleButtonFontSize: '14px',
      rescheduleButtonText: 'Reschedule',
      timeAlign: 'right',
      timeFontWeight: 'bold',
      timeColor: '#111827',
      timeSubColor: '#6B7280',
      timeFontSize: '14px',
      typeIcon: 'video'
    }
  ];

  // AI Assistant
  aiAssistant = {
    background: '#F9FAFB',
    borderRadius: '12px',
    padding: '24px',
    color: '#111827',
    marginBottom: '24px',
    headerDisplay: 'flex',
    headerAlignItems: 'center',
    headerGap: '12px',
    headerMarginBottom: '16px',
    iconWidth: '48px',
    iconHeight: '48px',
    iconBackground: '#3B82F6',
    iconBorderRadius: '50%',
    iconDisplay: 'flex',
    iconAlignItems: 'center',
    iconJustifyContent: 'center',
    titleFontWeight: 'bold',
    subtitleOpacity: '0.7',
    subtitleFontSize: '14px',
    contentBackground: '#FFFFFF',
    contentBorderRadius: '8px',
    contentPadding: '16px',
    contentMarginBottom: '16px',
    contentFontSize: '14px',
    buttonBackground: '#3B82F6',
    buttonBorder: 'none',
    buttonColor: '#FFFFFF',
    buttonPadding: '12px 24px',
    buttonBorderRadius: '8px',
    buttonFontSize: '14px'
  };

  // Quick Actions
  quickActions = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    action1: {
      background: '#F3F4F6',
      border: '1px solid #D1D5DB',
      padding: '20px',
      borderRadius: '12px',
      textAlign: 'center',
      cursor: 'pointer',
      iconColor: '#3B82F6',
      iconMarginBottom: '8px',
      titleFontWeight: 'bold',
      titleColor: '#111827',
      titleFontSize: '16px',
      subtitleColor: '#6B7280',
      subtitleFontSize: '12px',
      onMouseOver: () => console.log('Hover on Resume Review'),
      onMouseOut: () => console.log('Out from Resume Review')
    },
    action2: {
      background: '#F3F4F6',
      border: '1px solid #D1D5DB',
      padding: '20px',
      borderRadius: '12px',
      textAlign: 'center',
      cursor: 'pointer',
      iconColor: '#F59E0B',
      iconMarginBottom: '8px',
      titleFontWeight: 'bold',
      titleColor: '#111827',
      titleFontSize: '16px',
      subtitleColor: '#6B7280',
      subtitleFontSize: '12px',
      onMouseOver: () => console.log('Hover on Interview Prep'),
      onMouseOut: () => console.log('Out from Interview Prep')
    }
  };

  // Modal
  modal = {
    display: 'none',
    title: '',
    videoTextAlign: 'center',
    playIconFontSize: '48px',
    playIconMarginBottom: '16px',
    videoPlaceholder: 'Training Video Player',
    videoSubTextMarginTop: '8px',
    videoSubTextFontSize: '14px',
    videoSubTextOpacity: '0.7',
    overviewMarginTop: '24px',
    buttonsMarginTop: '16px',
    buttonsDisplay: 'flex',
    buttonsGap: '12px',
    startButtonBackground: '#3B82F6',
    startButtonColor: '#FFFFFF',
    startButtonBorder: 'none',
    startButtonPadding: '12px 24px',
    startButtonBorderRadius: '8px',
    startButtonCursor: 'pointer',
    watchlistButtonBackground: '#6B7280',
    watchlistButtonColor: '#FFFFFF',
    watchlistButtonBorder: 'none',
    watchlistButtonPadding: '12px 24px',
    watchlistButtonBorderRadius: '8px',
    watchlistButtonCursor: 'pointer',
    description: ''
  };

  // Profile Completion Modal
  showCompletionModal: boolean = false;
  profileCompletion: number = 0;

  private authSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private profileService: ProfileService
  ) { }

  ngOnInit(): void {
    // Subscribe to current user changes to update userName dynamically
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user && user.user_type === 'jobseeker') {
        // Assuming User has a 'name' field; adjust as per your User interface
        this.userName = user.name || 'Job Seeker'; // Fallback
      }
    });

    // Load profile completion for new users
    this.loadProfileCompletion();
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  private loadProfileCompletion(): void {
    this.profileService.getDetailedProfileCompletion().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.profileCompletion = response.data.completion || 0;
          // Show modal if profile is incomplete (less than 80%)
          if (this.profileCompletion < 80) {
            this.showCompletionModal = true;
          }
        }
      },
      error: (error) => {
        console.error('Error loading profile completion:', error);
      }
    });
  }

  toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('open');
  hamburger?.classList.toggle('active');
}

closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  
  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
  hamburger?.classList.remove('active');
}

  closeCompletionModal(): void {
    this.showCompletionModal = false;
  }

  goToProfile(): void {
    this.closeCompletionModal();
    this.router.navigate(['/profile']);
  }

  onSearch(event: any): void {
    console.log('Search:', event.target.value);
  }

  toggleNotifications(): void {
    console.log('Toggle notifications');
  }

  toggleMessages(): void {
    console.log('Toggle messages');
  }

  openProfile(): void {
    this.router.navigate(['/profile']);
  }

  findJobsNow(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/job-explorer']);
  }

  findTrainingNow(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/training']);
  }

  getTimeAgo(timestamp: string): string {
    return timestamp; // Placeholder; implement actual logic
  }

  getRelevanceClass(relevance: string): string {
    return `relevance-${relevance.toLowerCase()}`;
  }

  viewMoreRecommendations(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/ai-assistant']);
  }

  viewAllApplications(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/applications']);
  }

  viewAllMatches(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/job-matches']);
  }

  manageSkills(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/skills']);
  }

  browseTraining(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/training']);
  }

  viewCalendar(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/calendar']);
  }

  prepareForInterview(id: string): void {
    console.log('Prepare for interview:', id);
  }

  rescheduleInterview(id: string): void {
    console.log('Reschedule interview:', id);
  }

  openChat(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/ai-assistant']);
  }

  getCareerAdvice(event: Event): void {
    console.log('Get career advice');
  }

  openTrainingModal(title: string, event: Event): void {
    event.stopPropagation();
    this.modal.title = title;
    this.modal.description = `Description for ${title}. This is a comprehensive course covering key concepts.`;
    this.modal.display = 'block';
  }

  closeTrainingModal(): void {
    this.modal.display = 'none';
  }

  startCourse(): void {
    console.log('Start course');
    this.closeTrainingModal();
  }

  addToWatchlist(): void {
    console.log('Add to watchlist');
  }
}