import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
interface Interview {
  id: string;
  candidateName: string;
  candidatePhoto: string;
  jobRole: string;
  date: Date;
  time: string;
  mode: 'Online' | 'Phone' | 'In-Person';
  interviewers: string[];
  status: 'Upcoming' | 'Completed' | 'Pending Feedback';
  aiScore: number;
  notes?: string;
  feedback?: string;
  rating?: number;
}

interface DashboardStats {
  upcomingInterviews: number;
  upcomingIncrease: number;
  completedInterviews: number;
  completedThisWeek: number;
  feedbackPending: number;
  averageRating: number;
}

@Component({
  selector: 'app-interviews',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent],
  templateUrl: './interviews.component.html',
  styleUrls: ['./interviews.component.css']
})
export class InterviewsComponent implements OnInit {
  activeTab: string = 'upcoming';
  viewMode: 'calendar' | 'list' = 'calendar';
  searchTerm: string = '';
  selectedRole: string = 'all';
  selectedStatus: string = 'all';
  selectedInterview: Interview | null = null;
  showScheduleModal: boolean = false;
  showDetailsPanel: boolean = false;
  showAIPanel: boolean = false;

  stats: DashboardStats = {
    upcomingInterviews: 12,
    upcomingIncrease: 15,
    completedInterviews: 28,
    completedThisWeek: 4,
    feedbackPending: 6,
    averageRating: 4.2
  };

  interviews: Interview[] = [
    {
      id: '1',
      candidateName: 'Emma Johnson',
      candidatePhoto: 'https://images.unsplash.com/photo-1494790108755-2616b612b27c?w=150',
      jobRole: 'Frontend Developer',
      date: new Date(2024, 7, 26, 14, 0),
      time: '2:00 PM',
      mode: 'Online',
      interviewers: ['John Smith', 'Sarah Wilson'],
      status: 'Upcoming',
      aiScore: 85
    },
    {
      id: '2',
      candidateName: 'Michael Chen',
      candidatePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      jobRole: 'Data Analyst',
      date: new Date(2024, 7, 27, 10, 30),
      time: '10:30 AM',
      mode: 'In-Person',
      interviewers: ['Alice Brown'],
      status: 'Upcoming',
      aiScore: 92
    },
    {
      id: '3',
      candidateName: 'Lisa Rodriguez',
      candidatePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      jobRole: 'UX Designer',
      date: new Date(2024, 7, 25, 15, 30),
      time: '3:30 PM',
      mode: 'Online',
      interviewers: ['Tom Davis', 'Maria Garcia'],
      status: 'Completed',
      aiScore: 78,
      rating: 4.5,
      feedback: 'Strong portfolio, excellent communication skills'
    },
    {
      id: '4',
      candidateName: 'David Park',
      candidatePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      jobRole: 'Backend Developer',
      date: new Date(2024, 7, 24, 11, 0),
      time: '11:00 AM',
      mode: 'Phone',
      interviewers: ['Kevin Lee'],
      status: 'Pending Feedback',
      aiScore: 88
    }
  ];

  jobRoles: string[] = ['Frontend Developer', 'Backend Developer', 'Data Analyst', 'UX Designer'];
  aiSuggestions: string[] = [
    'Tell me about a challenging project you worked on.',
    'How do you handle tight deadlines?',
    'Describe your experience with team collaboration.',
    'What motivates you in your work?',
    'How do you stay updated with industry trends?'
  ];

  ngOnInit() {
    // Initialize component
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'calendar' ? 'list' : 'calendar';
  }

  get filteredInterviews(): Interview[] {
    return this.interviews.filter(interview => {
      const matchesSearch = interview.candidateName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           interview.jobRole.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesRole = this.selectedRole === 'all' || interview.jobRole === this.selectedRole;
      const matchesStatus = this.selectedStatus === 'all' || interview.status === this.selectedStatus;
      const matchesTab = this.getTabFilter(interview);
      
      return matchesSearch && matchesRole && matchesStatus && matchesTab;
    });
  }

  getTabFilter(interview: Interview): boolean {
    switch (this.activeTab) {
      case 'upcoming':
        return interview.status === 'Upcoming';
      case 'feedback':
        return interview.status === 'Pending Feedback';
      case 'panel':
        return interview.interviewers.length > 1;
      case 'types':
        return true;
      default:
        return true;
    }
  }

  openScheduleModal() {
    this.showScheduleModal = true;
  }

  closeScheduleModal() {
    this.showScheduleModal = false;
  }

  openDetailsPanel(interview: Interview) {
    this.selectedInterview = interview;
    this.showDetailsPanel = true;
  }

  closeDetailsPanel() {
    this.showDetailsPanel = false;
    this.selectedInterview = null;
  }

  toggleAIPanel() {
    this.showAIPanel = !this.showAIPanel;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Upcoming':
        return '#3B82F6';
      case 'Completed':
        return '#10B981';
      case 'Pending Feedback':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  }

  getModeIcon(mode: string): string {
    switch (mode) {
      case 'Online':
        return 'fas fa-video';
      case 'Phone':
        return 'fas fa-phone';
      case 'In-Person':
        return 'fas fa-handshake';
      default:
        return 'fas fa-calendar';
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  rescheduleInterview(interview: Interview) {
    console.log('Reschedule interview:', interview.id);
    // Implement reschedule logic
  }

  cancelInterview(interview: Interview) {
    console.log('Cancel interview:', interview.id);
    // Implement cancel logic
  }

  markAsCompleted(interview: Interview) {
    interview.status = 'Completed';
    console.log('Mark as completed:', interview.id);
  }
}