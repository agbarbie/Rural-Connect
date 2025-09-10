import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  userName = 'Sarah';
  stats = {
    profileViews: 1240,
    applications: 45,
    interviews: 12,
    savedJobs: 28,
    trainingCompleted: 8
  };

  recentActivity = [
    { company: 'Google', action: 'view', icon: 'google', initial: 'G', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { company: 'Microsoft', action: 'application', icon: 'microsoft', initial: 'M', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    { company: 'Apple', action: 'interview', icon: 'apple', initial: 'A', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000) }
  ];

  aiRecommendations = [
    { title: 'UI Animation Fundamentals', provider: 'Coursera', icon: 'coursera', initial: 'C', relevance: 'High', duration: '4 weeks' },
    { title: 'Figma Prototyping', provider: 'Advanced interactive prototyping techniques', icon: 'figma', initial: 'F', relevance: 'Very High', duration: '6 weeks' },
    { title: 'UX Design Professional Certificate', provider: 'Google', icon: 'google-cert', initial: 'G', relevance: 'Medium', duration: '6 months' }
  ];

  recentApplications = [
    { jobTitle: 'Senior Product Designer', company: 'Dropbox', tags: ['Full-time', 'Remote'], status: 'In Review', appliedDate: new Date(Date.now() - 48 * 60 * 60 * 1000), initial: 'D' },
    { jobTitle: 'UX Researcher', company: 'Custom', tags: ['Full-time'], status: 'Applied', appliedDate: new Date(Date.now() - 48 * 60 * 60 * 1000), initial: 'C' }
  ];

  bestJobMatches = [
    { title: 'Senior UX Designer', company: 'Figma', matchPercentage: 95 },
    { title: 'Product Designer', company: 'Spotify', matchPercentage: 88 },
    { title: 'UI/UX Designer', company: 'Adobe', matchPercentage: 82 }
  ];

  skillsProgress = [
    { name: 'UI Design', percentage: 85 },
    { name: 'UX Research', percentage: 70 },
    { name: 'Prototyping', percentage: 90 },
    { name: 'User Testing', percentage: 65 },
    { name: 'JavaScript', percentage: 55 }
  ];

  recommendedTraining = [
    { title: 'Advanced React Development', provider: 'Modern React patterns and hooks', relevance: 'Recommended for you', iconColor: '#ff6b6b', iconTextColor: 'white', buttonColor: '#10b981', buttonBorder: 'none' },
    { title: 'Data Science Fundamentals', provider: 'Python, Statistics, and Machine Learning', relevance: 'High Demand', iconColor: '#4ecdc4', iconTextColor: 'white', buttonColor: '#10b981', buttonBorder: 'none' },
    { title: 'Digital Marketing Mastery', provider: 'SEO, Social Media, and Analytics', relevance: 'Growing Field', iconColor: '#45b7d1', iconTextColor: 'white', buttonColor: '#10b981', buttonBorder: 'none' }
  ];

  upcomingInterviews = [
    {
      id: 1, position: 'Product Designer', company: 'Adobe', date: 'Tomorrow', time: '10:00 AM', type: 'Video Call', typeIcon: 'video', icon: 'video',
      iconColor: '#10b981', iconTextColor: 'white', iconBorderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '16px',
      statusColor: '#6366f1', statusTextColor: 'white', statusPadding: '4px 8px', statusBorderRadius: '12px', statusFontSize: '11px',
      marginTop1: '8px', marginTop2: '12px', marginTop3: '12px', interviewerColor: '#64748b', interviewerFontSize: '14px',
      actionsDisplay: 'flex', actionsGap: '12px', prepareButtonColor: '#6366f1', prepareButtonTextColor: 'white', prepareButtonBorder: 'none',
      prepareButtonPadding: '8px 16px', prepareButtonBorderRadius: '8px', prepareButtonFontSize: '12px', prepareButtonText: 'Prepare',
      rescheduleButtonColor: 'transparent', rescheduleButtonTextColor: '#64748b', rescheduleButtonBorder: '1px solid #e2e8f0',
      rescheduleButtonPadding: '8px 16px', rescheduleButtonBorderRadius: '8px', rescheduleButtonFontSize: '12px', rescheduleButtonText: 'Reschedule',
      timeAlign: 'right', timeFontWeight: '600', timeColor: '#1e293b', timeSubColor: '#64748b', timeFontSize: '14px'
    },
    {
      id: 2, position: 'UI Designer', company: 'Spotify', date: 'April 12, 2025', time: '2:30 PM', type: 'On-site', typeIcon: 'map-marker-alt', icon: 'building',
      iconColor: '#8b5cf6', iconTextColor: 'white', iconBorderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '0',
      statusColor: '#10b981', statusTextColor: 'white', statusPadding: '4px 8px', statusBorderRadius: '12px', statusFontSize: '11px',
      marginTop1: '8px', marginTop2: '12px', marginTop3: '12px', interviewerColor: '#64748b', interviewerFontSize: '14px',
      actionsDisplay: 'flex', actionsGap: '12px', prepareButtonColor: '#6366f1', prepareButtonTextColor: 'white', prepareButtonBorder: 'none',
      prepareButtonPadding: '8px 16px', prepareButtonBorderRadius: '8px', prepareButtonFontSize: '12px', prepareButtonText: 'Get Directions',
      rescheduleButtonColor: 'transparent', rescheduleButtonTextColor: '#64748b', rescheduleButtonBorder: '1px solid #e2e8f0',
      rescheduleButtonPadding: '8px 16px', rescheduleButtonBorderRadius: '8px', rescheduleButtonFontSize: '12px', rescheduleButtonText: 'Reschedule',
      timeAlign: 'right', timeFontWeight: '600', timeColor: '#1e293b', timeSubColor: '#64748b', timeFontSize: '14px',
      interviewers: ['Jessica White (Head of Design)', 'Robert Davis (Senior Designer)']
    }
  ];

  aiAssistant = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '24px',
    color: 'white',
    marginBottom: '16px',
    headerDisplay: 'flex',
    headerAlignItems: 'center',
    headerGap: '12px',
    headerMarginBottom: '16px',
    iconWidth: '40px',
    iconHeight: '40px',
    iconBackground: 'rgba(255,255,255,0.2)',
    iconBorderRadius: '50%',
    iconDisplay: 'flex',
    iconAlignItems: 'center',
    iconJustifyContent: 'center',
    titleFontWeight: '600',
    subtitleOpacity: '0.9',
    subtitleFontSize: '14px',
    contentBackground: 'rgba(255,255,255,0.1)',
    contentBorderRadius: '8px',
    contentPadding: '12px',
    contentMarginBottom: '12px',
    contentFontSize: '14px',
    buttonBackground: 'rgba(255,255,255,0.2)',
    buttonBorder: '1px solid rgba(255,255,255,0.3)',
    buttonColor: 'white',
    buttonPadding: '8px 16px',
    buttonBorderRadius: '8px',
    buttonFontSize: '12px'
  };

  quickActions = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    action1: {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      padding: '16px',
      borderRadius: '12px',
      textAlign: 'left',
      cursor: 'pointer',
      onMouseOver: () => this.quickActions.action1.background = '#f1f5f9',
      onMouseOut: () => this.quickActions.action1.background = '#f8fafc',
      iconColor: '#10b981',
      iconMarginBottom: '8px',
      titleFontWeight: '600',
      titleColor: '#1e293b',
      titleFontSize: '14px',
      subtitleColor: '#64748b',
      subtitleFontSize: '12px'
    },
    action2: {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      padding: '16px',
      borderRadius: '12px',
      textAlign: 'left',
      cursor: 'pointer',
      onMouseOver: () => this.quickActions.action2.background = '#f1f5f9',
      onMouseOut: () => this.quickActions.action2.background = '#f8fafc',
      iconColor: '#6366f1',
      iconMarginBottom: '8px',
      titleFontWeight: '600',
      titleColor: '#1e293b',
      titleFontSize: '14px',
      subtitleColor: '#64748b',
      subtitleFontSize: '12px'
    }
  };

  modal = {
    display: 'none',
    title: 'Training Course',
    videoTextAlign: 'center',
    playIconFontSize: '48px',
    playIconMarginBottom: '16px',
    videoPlaceholder: 'Video content would be displayed here',
    videoSubTextMarginTop: '8px',
    videoSubTextFontSize: '14px',
    videoSubTextOpacity: '0.7',
    overviewMarginTop: '16px',
    buttonsMarginTop: '16px',
    buttonsDisplay: 'flex',
    buttonsGap: '12px',
    startButtonBackground: '#10b981',
    startButtonColor: 'white',
    startButtonBorder: 'none',
    startButtonPadding: '12px 24px',
    startButtonBorderRadius: '8px',
    startButtonCursor: 'pointer',
    watchlistButtonBackground: 'transparent',
    watchlistButtonColor: '#64748b',
    watchlistButtonBorder: '1px solid #e2e8f0',
    watchlistButtonPadding: '12px 24px',
    watchlistButtonBorderRadius: '8px',
    watchlistButtonCursor: 'pointer',
    description: 'This comprehensive course will help you advance your skills and career prospects.'
  };

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffDays > 0 ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  getRelevanceClass(relevance: string): string {
    return relevance.toLowerCase().replace(' ', '-');
  }

  onSearch(event: Event): void {
    console.log('Search input:', (event.target as HTMLInputElement).value);
  }

  toggleNotifications(): void {
    console.log('Notifications toggled');
  }

  toggleMessages(): void {
    console.log('Messages toggled');
  }

  openProfile(): void {
    console.log('Profile opened');
  }

  findJobsNow(event: Event): void {
    event.preventDefault();
    console.log('Finding jobs...');
  }
  findTrainingNow(event: Event): void {
    event.preventDefault();
    console.log('Finding training...');
  }

  viewMoreRecommendations(event: Event): void {
    event.preventDefault();
    console.log('Viewing more recommendations...');
  }

  viewAllApplications(event: Event): void {
    event.preventDefault();
    console.log('Viewing all applications...');
  }

  viewAllMatches(event: Event): void {
    event.preventDefault();
    console.log('Viewing all matches...');
  }

  manageSkills(event: Event): void {
    event.preventDefault();
    console.log('Managing skills...');
  }

  browseTraining(event: Event): void {
    event.preventDefault();
    console.log('Browsing training...');
  }

  openTrainingModal(courseTitle: string, event: Event): void {
    event.preventDefault();
    this.modal.display = 'block';
    this.modal.title = courseTitle;
    const descriptions = {
      'Advanced React Development': 'Master modern React development with hooks, context, and advanced patterns. Build scalable applications and learn best practices used in top tech companies.',
      'Data Science Fundamentals': 'Learn the essentials of data science including Python programming, statistical analysis, and machine learning algorithms. Perfect for career transition into tech.',
      'Digital Marketing Mastery': 'Comprehensive digital marketing course covering SEO, social media marketing, content strategy, and analytics. Ideal for marketing professionals and entrepreneurs.'
    };
    this.modal.description = descriptions[courseTitle as keyof typeof descriptions] || 'This comprehensive course will help you advance your skills and career prospects.';
  }

  closeTrainingModal(): void {
    this.modal.display = 'none';
  }

  startCourse(): void {
    console.log('Starting course...');
  }

  addToWatchlist(): void {
    console.log('Added to watchlist...');
  }

  viewCalendar(event: Event): void {
    event.preventDefault();
    console.log('Viewing calendar...');
  }

  openChat(event: Event): void {
    event.preventDefault();
    console.log('Opening chat...');
  }

  getCareerAdvice(event: Event): void {
    event.preventDefault();
    console.log('Getting career advice...');
  }

  prepareForInterview(id: number): void {
    console.log(`Preparing for interview with ID: ${id}`);
  }

  rescheduleInterview(id: number): void {
    console.log(`Rescheduling interview with ID: ${id}`);
  }
}