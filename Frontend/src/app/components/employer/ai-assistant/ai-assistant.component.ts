// ai-assistant.component.ts - COMPLETE WITH MOBILE SIDEBAR TOGGLE
import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { CandidatesService, Candidate, JobPost } from '../../../../../services/candidates.service';
import { TrainingService, Training } from '../../../../../services/training.service';
import { GeminiChatService, GeminiResponse } from '../../../../../services/gemini-chat.service';
import { environment } from '../../../../environments/environments';

interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

interface SkillGap {
  skill: string;
  demandPercentage: number;
  candidatesWithSkill: number;
  totalCandidates: number;
}

interface CandidateProfile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  profile_image: string;
  bio: string;
  title: string;
  years_of_experience: number;
  current_position: string;
  availability_status: string;
  skills: string[];
  social_links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    website?: string;
  };
  application?: {
    id: string;
    status: string;
    cover_letter: string;
    expected_salary: number;
    availability_date: string;
    applied_at: string;
  };
  preferences: {
    job_types: string[];
    locations: string[];
    salary_min: number;
    salary_max: number;
  };
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Sidebar toggle methods for mobile - EXACT SAME AS OTHER COMPONENTS
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
  
  activeTab: 'candidates' | 'training' | 'insights' = 'candidates';
  
  // Real data from services
  candidates: Candidate[] = [];
  trainings: Training[] = [];
  jobPosts: JobPost[] = [];
  skillGaps: SkillGap[] = [];
  
  // Filter properties
  selectedJobRole: string = '';
  selectedSkills: string = '';
  selectedExperience: string = '';
  selectedIndustry: string = '';

  // UI state
  isChatOpen: boolean = false;
  currentChatMessage: string = '';
  isLoading: boolean = false;
  chatMessages: ChatMessage[] = [];
  
  // Profile modal state
  showProfileModal: boolean = false;
  currentProfileData: CandidateProfile | null = null;
  isLoadingProfile: boolean = false;
  
  // Chat history for Gemini
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  
  // Filter options (will be populated from real data)
  jobRoles: string[] = [];
  skillOptions: string[] = [];
  experienceLevels: string[] = ['Entry Level', 'Mid Level', 'Senior Level', 'Executive'];
  industries: string[] = [];
  
  // Assignment modal
  showAssignmentModal: boolean = false;
  selectedTraining: Training | null = null;
  selectedCandidatesForAssignment: Set<string> = new Set();

  constructor(
    private candidatesService: CandidatesService,
    @Inject(TrainingService) private trainingService: TrainingService,
    private geminiService: GeminiChatService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log('🚀 AI Assistant initialized');
    this.loadRealData();
    this.initializeChat();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // PROFILE MODAL FUNCTIONS
  // ============================================
  
  viewProfile(candidateId: string): void {
    console.log('📋 Loading full profile for candidate:', candidateId);
    
    this.showProfileModal = true;
    this.isLoadingProfile = true;
    this.currentProfileData = null;
    
    const jobId = this.selectedJobRole ? 
      this.jobPosts.find(j => j.title === this.selectedJobRole)?.id : 
      undefined;
    
    this.candidatesService.getCandidateProfile(candidateId, jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.currentProfileData = response.data;
            console.log('✅ Profile loaded:', this.currentProfileData);
          } else {
            console.error('❌ No profile data received');
            alert('Failed to load candidate profile');
            this.closeProfileModal();
          }
          this.isLoadingProfile = false;
        },
        error: (error) => {
          console.error('❌ Error loading profile:', error);
          alert('Failed to load candidate profile');
          this.closeProfileModal();
          this.isLoadingProfile = false;
        }
      });
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.currentProfileData = null;
    this.isLoadingProfile = false;
  }

  hasSocialLinks(profile: CandidateProfile | null): boolean {
    if (!profile) return false;
    const links = profile.social_links;
    return !!(links.linkedin || links.github || links.portfolio || links.website);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  scheduleInterviewFromModal(): void {
    if (!this.currentProfileData) return;
    
    const jobId = this.selectedJobRole ? 
      this.jobPosts.find(j => j.title === this.selectedJobRole)?.id : 
      undefined;
    
    this.closeProfileModal();
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: {
        candidateId: this.currentProfileData.user_id,
        jobId: jobId
      }
    });
  }

  // ============================================
  // DATA LOADING
  // ============================================
  
  loadRealData(): void {
    this.isLoading = true;
    
    this.candidatesService.getJobPosts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobPosts = response.data;
            this.jobRoles = [...new Set(this.jobPosts.map(j => j.title))];
            console.log('✅ Loaded job posts:', this.jobPosts.length);
            this.loadCandidates();
          }
        },
        error: (error) => {
          console.error('❌ Error loading job posts:', error);
          this.isLoading = false;
        }
      });
    
    const employerId = localStorage.getItem('userId') || '';
    this.trainingService.getMyTrainings({ 
      status: 'published',
      limit: 100 
    }, employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.trainings) {
            this.trainings = response.data.trainings;
            console.log('✅ Loaded trainings:', this.trainings.length);
          }
        },
        error: (error) => {
          console.error('❌ Error loading trainings:', error);
        }
      });
  }

  loadCandidates(): void {
    this.candidatesService.getCandidates({ page: 1, limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.candidates = Array.isArray(response.data.data) ? response.data.data : [];
            
            const allSkills = new Set<string>();
            const allIndustries = new Set<string>();
            
            this.candidates.forEach(candidate => {
              candidate.skills?.forEach(skill => allSkills.add(skill));
              if (candidate.location) {
                allIndustries.add(candidate.location);
              }
            });
            
            this.skillOptions = Array.from(allSkills);
            this.industries = Array.from(allIndustries);
            
            this.calculateSkillGaps();
            
            console.log('✅ Loaded candidates:', this.candidates.length);
            console.log('✅ Unique skills:', this.skillOptions.length);
            
            this.isLoading = false;
          }
        },
        error: (error) => {
          console.error('❌ Error loading candidates:', error);
          this.isLoading = false;
        }
      });
  }

  calculateSkillGaps(): void {
    const skillDemand = new Map<string, number>();
    const skillCount = new Map<string, number>();
    
    this.jobPosts.forEach(job => {
      job.skills_required?.forEach((skill: string) => {
        skillDemand.set(skill, (skillDemand.get(skill) || 0) + 1);
      });
    });
    
    this.candidates.forEach(candidate => {
      candidate.skills?.forEach(skill => {
        skillCount.set(skill, (skillCount.get(skill) || 0) + 1);
      });
    });
    
    this.skillGaps = Array.from(skillDemand.entries())
      .map(([skill, demand]) => ({
        skill,
        demandPercentage: Math.round((demand / this.jobPosts.length) * 100),
        candidatesWithSkill: skillCount.get(skill) || 0,
        totalCandidates: this.candidates.length
      }))
      .sort((a, b) => b.demandPercentage - a.demandPercentage)
      .slice(0, 10);
  }

  // ============================================
  // TAB MANAGEMENT
  // ============================================
  
  setActiveTab(tab: 'candidates' | 'training' | 'insights'): void {
    this.activeTab = tab;
  }

  // ============================================
  // FILTERS
  // ============================================
  
  applyFilters(): void {
    this.isLoading = true;
    
    let filtered = [...this.candidates];
    
    if (this.selectedJobRole) {
      const job = this.jobPosts.find(j => j.title === this.selectedJobRole);
      if (job && job.skills_required) {
        filtered = filtered.filter(candidate => 
          candidate.skills?.some(skill => 
            job.skills_required?.includes(skill)
          )
        );
      }
    }
    
    if (this.selectedSkills) {
      filtered = filtered.filter(candidate =>
        candidate.skills?.includes(this.selectedSkills)
      );
    }
    
    if (this.selectedExperience) {
      filtered = filtered.filter(candidate =>
        candidate.experience?.toLowerCase().includes(this.selectedExperience.toLowerCase())
      );
    }
    
    if (this.selectedIndustry) {
      filtered = filtered.filter(candidate =>
        candidate.location?.includes(this.selectedIndustry)
      );
    }
    
    this.candidates = filtered;
    this.isLoading = false;
  }

  clearFilters(): void {
    this.selectedJobRole = '';
    this.selectedSkills = '';
    this.selectedExperience = '';
    this.selectedIndustry = '';
    this.loadCandidates();
  }

  // ============================================
  // CANDIDATE ACTIONS
  // ============================================
  
  inviteToApply(candidateId: string): void {
    console.log('Inviting candidate to apply:', candidateId);
    
    if (!this.selectedJobRole) {
      alert('Please select a job role first');
      return;
    }
    
    const job = this.jobPosts.find(j => j.title === this.selectedJobRole);
    if (job) {
      const message = `You have been identified as a strong match for our ${job.title} position. We invite you to apply!`;
      
      this.candidatesService.inviteCandidate(candidateId, job.id, message)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            alert('Invitation sent successfully!');
          },
          error: (error) => {
            console.error('Error sending invitation:', error);
            alert('Failed to send invitation');
          }
        });
    }
  }

  messageCandidate(candidateId: string): void {
    console.log('Messaging candidate:', candidateId);
    this.router.navigate(['/employer/messages'], {
      queryParams: { userId: candidateId }
    });
  }

  // ============================================
  // TRAINING ACTIONS
  // ============================================
  
  assignTraining(training: Training): void {
    console.log('Opening assignment modal for training:', training.title);
    this.selectedTraining = training;
    this.selectedCandidatesForAssignment.clear();
    this.showAssignmentModal = true;
  }

  closeAssignmentModal(): void {
    this.showAssignmentModal = false;
    this.selectedTraining = null;
    this.selectedCandidatesForAssignment.clear();
  }

  toggleCandidateForAssignment(candidateId: string): void {
    if (this.selectedCandidatesForAssignment.has(candidateId)) {
      this.selectedCandidatesForAssignment.delete(candidateId);
    } else {
      this.selectedCandidatesForAssignment.add(candidateId);
    }
  }

  isCandidateSelectedForAssignment(candidateId: string): boolean {
    return this.selectedCandidatesForAssignment.has(candidateId);
  }

  confirmAssignment(): void {
    if (this.selectedCandidatesForAssignment.size === 0) {
      alert('Please select at least one candidate');
      return;
    }
    
    if (!this.selectedTraining) {
      alert('No training selected');
      return;
    }
    
    const candidateCount = this.selectedCandidatesForAssignment.size;
    const trainingTitle = this.selectedTraining.title;
    
    if (confirm(`Assign "${trainingTitle}" to ${candidateCount} candidate(s)?`)) {
      console.log('Assigning training to candidates:', {
        training: this.selectedTraining,
        candidates: Array.from(this.selectedCandidatesForAssignment)
      });
      
      alert(`Training "${trainingTitle}" assigned to ${candidateCount} candidate(s)!`);
      this.closeAssignmentModal();
    }
  }

  explainRecommendation(type: string, id: string): void {
    let question = '';
    
    if (type === 'candidate') {
      const candidate = this.candidates.find(c => c.id === id);
      if (candidate) {
        question = `Why is ${candidate.name} recommended for ${this.selectedJobRole || 'our positions'}?`;
      }
    } else if (type === 'training') {
      const training = this.trainings.find(t => t.id === id);
      if (training) {
        question = `Why is "${training.title}" training recommended for our candidates?`;
      }
    }
    
    if (question) {
      this.currentChatMessage = question;
      this.sendChatMessage();
      this.isChatOpen = true;
    }
  }

  // ============================================
  // AI CHAT
  // ============================================
  
  initializeChat(): void {
    this.chatMessages = [{
      id: '1',
      message: '👋 Hello! I\'m your AI hiring assistant. I can help you:\n\n' +
               '• Analyze candidate qualifications\n' +
               '• Find top matches for your jobs\n' +
               '• Recommend training for candidates\n' +
               '• Identify skill gaps in your pipeline\n\n' +
               'What would you like to know?',
      isUser: false,
      timestamp: new Date()
    }];
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
  }

  sendChatMessage(): void {
    if (!this.currentChatMessage.trim() || this.isLoading) return;

    const userMessage = this.currentChatMessage.trim();
    this.addChatMessage(userMessage, true);
    this.currentChatMessage = '';
    this.isLoading = true;
    
    this.chatHistory.push({
      role: 'user',
      content: userMessage
    });

    const context = {
      jobs: this.jobPosts.map(j => ({
        id: j.id,
        title: j.title,
        skills_required: j.skills_required,
        applications_count: j.applications_count,
        status: j.status
      })),
      trainings: this.trainings.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        level: t.level,
        duration_hours: t.duration_hours,
        cost_type: t.cost_type,
        total_students: t.total_students
      })),
      candidates: this.candidates.slice(0, 20).map(c => ({
        id: c.id,
        name: c.name,
        title: c.title,
        skills: c.skills,
        experience: c.experience,
        match_score: c.match_score
      })),
      selectedJob: this.selectedJobRole ? 
        this.jobPosts.find(j => j.title === this.selectedJobRole) : null
    };
    
    console.log('🚀 Sending to Gemini:', {
      userMessage,
      contextJobs: context.jobs.length,
      contextTrainings: context.trainings.length,
      contextCandidates: context.candidates.length
    });

    this.geminiService.sendEmployerMessage(userMessage, this.chatHistory, context)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GeminiResponse) => {
          console.log('✅ Gemini response:', response);
          
          const aiMessage = response.message || 
            'I apologize, but I couldn\'t process that request. Please try rephrasing.';
          
          this.addChatMessage(aiMessage, false);
          
          this.chatHistory.push({
            role: 'assistant',
            content: aiMessage
          });
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Gemini error:', error);
          
          this.addChatMessage(
            '❌ I encountered an error. Please try again or rephrase your question.',
            false
          );
          
          this.isLoading = false;
        }
      });
  }

  addChatMessage(message: string, isUser: boolean): void {
    this.chatMessages.push({
      id: Date.now().toString(),
      message,
      isUser,
      timestamp: new Date()
    });
    
    setTimeout(() => this.scrollChatToBottom(), 100);
  }

  scrollChatToBottom(): void {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  onChatKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
  getMatchScoreClass(score: number): string {
    if (score >= 90) return 'match-excellent';
    if (score >= 80) return 'match-good';
    if (score >= 70) return 'match-fair';
    return 'match-poor';
  }

  getLevelBadgeClass(level: string): string {
    switch (level) {
      case 'Beginner': return 'level-beginner';
      case 'Intermediate': return 'level-intermediate';
      case 'Advanced': return 'level-advanced';
      default: return 'level-beginner';
    }
  }

  getSkillGapPercentage(skillGap: SkillGap): number {
    if (skillGap.totalCandidates === 0) return 0;
    return Math.round((skillGap.candidatesWithSkill / skillGap.totalCandidates) * 100);
  }

  getGapSeverity(percentage: number): string {
    if (percentage < 30) return 'severe';
    if (percentage < 60) return 'moderate';
    return 'low';
  }

  getFullImageUrl(imagePath: string | null | undefined, candidateName: string): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
    }
    
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath}`;
    }
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }

  handleImageError(event: any, candidateName: string): void {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }
}