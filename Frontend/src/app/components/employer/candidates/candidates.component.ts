// src/app/employer/candidates/candidates.component.ts - COMPLETE FIXED VERSION

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, interval } from 'rxjs';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { CandidatesService, Candidate, JobPost, CandidatesQuery } from '../../../../../services/candidates.service';
import { environment } from '../../../../environments/environments';
import { GeminiChatService, GeminiResponse } from '../../../../../services/gemini-chat.service';
import { TrainingService, Training } from '../../../../../services/training.service';

interface AIInsight {
  reason: string;
  skillOverlap: string[];
  experienceRelevance: string;
  trainingMatch: string;
  isLoading: boolean;
  isQualified: boolean;
  recommendedTrainings?: Training[];
  hiringSuggestion?: 'hire' | 'interview' | 'train' | 'reject';
  confidenceScore?: number;
}

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './candidates.component.html',
  styleUrls: ['./candidates.component.css']
})
export class CandidatesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data properties
  candidates: Candidate[] = [];
  filteredCandidates: Candidate[] = [];
  jobPosts: JobPost[] = [];
  availableTrainings: Training[] = [];
  
  // UI state
  selectedJob: string = 'all';
  viewMode: 'grid' | 'list' = 'grid';
  isLoading: boolean = false;
  lastRefreshTime: Date = new Date();
  
  // Filters
  searchQuery = '';
  skillsMatchFilter = '';
  locationFilter = '';
  experienceFilter = '';
  trainingFilter = '';
  sortBy = 'newest';
  
  // Selection
  selectedCandidates: string[] = [];
  showBatchActions = false;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 6;
  totalPages = 1;
  totalCandidates = 0;
  
  // Modals
  showComparison = false;
  currentInsight: AIInsight | null = null;
  selectedCandidate: Candidate | null = null;
  
  // AI Chat
  isChatOpen = false;
  currentMessage = '';
  chatMessages: ChatMessage[] = [];
  isChatLoading = false;
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  
  // Auto-refresh
  private autoRefreshInterval = 30000;
  showNewApplicationsBadge = false;
  newApplicationsCount = 0;
  
  Math = Math;
  
  constructor(
    private candidatesService: CandidatesService,
    private geminiService: GeminiChatService,
    private trainingService: TrainingService,
    private router: Router
  ) {}
  
  ngOnInit() {
    console.log('🚀 Candidates Component initialized');
    this.loadJobPosts();
    this.loadEmployerTrainings();
    this.initializeChat();
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // LOAD EMPLOYER'S TRAININGS
  // ============================================
  
  loadEmployerTrainings(): void {
    const employerId = localStorage.getItem('userId');
    if (!employerId) {
      console.warn('⚠️ No employer ID found');
      return;
    }

    console.log('📚 Loading employer trainings for recommendations...');
    
    this.trainingService.getMyTrainings({ 
      status: 'published',
      limit: 100 
    }, employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.trainings) {
            this.availableTrainings = response.data.trainings;
            console.log(`✅ Loaded ${this.availableTrainings.length} trainings for recommendations`);
          }
        },
        error: (error) => {
          console.error('❌ Error loading trainings:', error);
        }
      });
  }

  // ============================================
  // AI INSIGHTS WITH TRAINING RECOMMENDATIONS
  // ============================================
  
  showAIInsights(candidate: Candidate): void {
    this.selectedCandidate = candidate;
    console.log('🤖 Generating AI insights for:', candidate.name);
    
    this.currentInsight = {
      reason: '🤖 AI is analyzing this candidate...',
      skillOverlap: [],
      experienceRelevance: 'Analyzing...',
      trainingMatch: 'Analyzing...',
      isLoading: true,
      isQualified: false,
      hiringSuggestion: undefined,
      confidenceScore: 0
    };

    const job = this.jobPosts.find(j => j.id === this.selectedJob);
    
    if (!job) {
      this.currentInsight = {
        reason: 'Please select a specific job to get AI insights',
        skillOverlap: candidate.skills.slice(0, 3),
        experienceRelevance: candidate.experience,
        trainingMatch: 'Select a job to see training recommendations',
        isLoading: false,
        isQualified: false
      };
      return;
    }

    const prompt = this.buildAIInsightPrompt(candidate, job);
    
    this.geminiService.sendMessage(prompt, [])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GeminiResponse) => {
          console.log('✅ AI response received:', response);
          this.currentInsight = this.parseAIInsightResponse(response, candidate, job);
        },
        error: (error) => {
          console.error('❌ AI insight error:', error);
          this.currentInsight = this.generateFallbackInsight(candidate, job);
        }
      });
  }

  private buildAIInsightPrompt(candidate: Candidate, job: JobPost): string {
    const trainingList = this.availableTrainings
      .map(t => `- ${t.title} (${t.category}, ${t.level})`)
      .join('\n');

    return `You are an expert HR consultant analyzing a job candidate. Provide a detailed, structured assessment.

**JOB POSTING:**
Title: ${job.title}
Required Skills: ${job.skills_required?.join(', ') || 'Not specified'}
Experience Level: ${job.experience_level || 'Not specified'}

**CANDIDATE:**
Name: ${candidate.name}
Title: ${candidate.title}
Experience: ${candidate.experience}
Skills: ${candidate.skills.join(', ')}
Location: ${candidate.location}
Match Score: ${candidate.match_score}%
Cover Letter: ${candidate.cover_letter?.substring(0, 200) || 'Not provided'}

**AVAILABLE TRAINING PROGRAMS:**
${trainingList || 'No training programs currently available'}

**INSTRUCTIONS:**
Analyze this candidate and respond in this EXACT format:

QUALIFIED: [Yes/No]
CONFIDENCE: [0-100]
HIRING_SUGGESTION: [HIRE/INTERVIEW/TRAIN/REJECT]

REASON: [One clear sentence explaining your decision]

SKILL_MATCHES: [List 2-4 matching skills, comma-separated]

SKILL_GAPS: [List missing critical skills, comma-separated, or "None"]

EXPERIENCE_ASSESSMENT: [One sentence about their experience relevance]

RECOMMENDED_TRAININGS: [If underqualified, suggest 1-3 specific training programs from the list above, comma-separated, or "None needed"]

ACTION_PLAN: [One sentence recommendation for the employer]

**EVALUATION CRITERIA:**
- Match score ≥80% + strong skill overlap = HIRE
- Match score 65-79% + relevant experience = INTERVIEW  
- Match score 50-64% + trainable gaps = TRAIN
- Match score <50% or critical gaps = REJECT`;
  }

  private parseAIInsightResponse(response: GeminiResponse, candidate: Candidate, job: JobPost): AIInsight {
    if (!response.success || !response.message) {
      return this.generateFallbackInsight(candidate, job);
    }

    const text = response.message;
    
    const qualified = text.match(/QUALIFIED:\s*(Yes|No)/i)?.[1]?.toLowerCase() === 'yes';
    const confidence = parseInt(text.match(/CONFIDENCE:\s*(\d+)/i)?.[1] || '0');
    const suggestion = text.match(/HIRING_SUGGESTION:\s*(HIRE|INTERVIEW|TRAIN|REJECT)/i)?.[1]?.toLowerCase() as 'hire' | 'interview' | 'train' | 'reject' || 'interview';
    
    const reason = text.match(/REASON:\s*(.+?)(?=\n|$)/i)?.[1]?.trim() || 
                   `${candidate.match_score}% match with relevant experience`;
    
    const skillMatches = text.match(/SKILL_MATCHES:\s*(.+?)(?=\n|$)/i)?.[1]
      ?.split(',')
      .map(s => s.trim())
      .filter(s => s && s !== 'None') || 
      candidate.skills.slice(0, 3);
    
    const skillGaps = text.match(/SKILL_GAPS:\s*(.+?)(?=\n|$)/i)?.[1]
      ?.split(',')
      .map(s => s.trim())
      .filter(s => s && s !== 'None') || [];
    
    const experienceAssessment = text.match(/EXPERIENCE_ASSESSMENT:\s*(.+?)(?=\n|$)/i)?.[1]?.trim() || 
                                 candidate.experience;
    
    const recommendedTrainingText = text.match(/RECOMMENDED_TRAININGS:\s*(.+?)(?=\n|$)/i)?.[1]?.trim() || '';
    const recommendedTrainings = this.matchTrainingsFromText(recommendedTrainingText);
    
    const actionPlan = text.match(/ACTION_PLAN:\s*(.+?)$/is)?.[1]?.trim() || 
                       'Review candidate profile and make hiring decision';

    let trainingMatch = actionPlan;
    if (recommendedTrainings.length > 0) {
      trainingMatch = `${actionPlan}\n\n📚 Recommended Training:\n${recommendedTrainings.map(t => `• ${t.title}`).join('\n')}`;
    } else if (!qualified && skillGaps.length > 0) {
      trainingMatch = `${actionPlan}\n\n⚠️ Skill gaps: ${skillGaps.join(', ')}`;
    }

    return {
      reason,
      skillOverlap: skillMatches,
      experienceRelevance: experienceAssessment,
      trainingMatch,
      isLoading: false,
      isQualified: qualified,
      recommendedTrainings,
      hiringSuggestion: suggestion,
      confidenceScore: confidence
    };
  }

  private matchTrainingsFromText(text: string): Training[] {
    if (!text || text.toLowerCase() === 'none needed' || text.toLowerCase() === 'none') {
      return [];
    }

    const matches: Training[] = [];
    const searchText = text.toLowerCase();

    this.availableTrainings.forEach(training => {
      const titleMatch = searchText.includes(training.title.toLowerCase());
      const categoryMatch = searchText.includes(training.category.toLowerCase());
      
      if (titleMatch || categoryMatch) {
        matches.push(training);
      }
    });

    return matches.slice(0, 3);
  }

  private generateFallbackInsight(candidate: Candidate, job: JobPost): AIInsight {
    const qualified = candidate.match_score >= 70;
    const hasTrainings = this.availableTrainings.length > 0;
    
    let suggestion: 'hire' | 'interview' | 'train' | 'reject';
    let trainingMatch: string;

    if (candidate.match_score >= 80) {
      suggestion = 'hire';
      trainingMatch = '✅ Strong candidate - Ready for hiring process';
    } else if (candidate.match_score >= 65) {
      suggestion = 'interview';
      trainingMatch = '📞 Good fit - Schedule interview to assess further';
    } else if (candidate.match_score >= 50 && hasTrainings) {
      suggestion = 'train';
      const relevantTrainings = this.findRelevantTrainings(candidate, job);
      trainingMatch = relevantTrainings.length > 0
        ? `🎓 Potential candidate - Consider these training programs:\n${relevantTrainings.map(t => `• ${t.title}`).join('\n')}`
        : '🎓 Potential with training - Check available programs';
    } else {
      suggestion = 'reject';
      trainingMatch = '❌ Not a strong fit for this position';
    }

    return {
      reason: `${candidate.match_score}% match - ${qualified ? 'Meets requirements' : 'Below threshold'}`,
      skillOverlap: candidate.skills.slice(0, 3),
      experienceRelevance: candidate.experience,
      trainingMatch,
      isLoading: false,
      isQualified: qualified,
      hiringSuggestion: suggestion,
      confidenceScore: candidate.match_score
    };
  }

  private findRelevantTrainings(candidate: Candidate, job: JobPost): Training[] {
    if (this.availableTrainings.length === 0) return [];

    const requiredSkills = job.skills_required || [];
    const candidateSkills = candidate.skills.map(s => s.toLowerCase());
    
    const missingSkills = requiredSkills.filter(
      (      skill: string) => !candidateSkills.includes(skill.toLowerCase())
    );

    return this.availableTrainings
      .filter(training => {
        const titleLower = training.title.toLowerCase();
        const categoryLower = training.category.toLowerCase();
        
        return missingSkills.some((skill: string) => 
          titleLower.includes(skill.toLowerCase()) ||
          categoryLower.includes(skill.toLowerCase())
        );
      })
      .slice(0, 3);
  }

  hideAIInsights(): void {
    this.currentInsight = null;
    this.selectedCandidate = null;
  }

  viewTrainingDetails(training: Training): void {
    console.log('📚 Viewing training:', training.title);
    window.open(`/employer/training/${training.id}`, '_blank');
  }

  inviteToTraining(candidate: Candidate | null): void {
    if (!candidate || !this.currentInsight?.recommendedTrainings?.length) {
      return;
    }

    const trainingTitles = this.currentInsight.recommendedTrainings
      .map(t => t.title)
      .join(', ');

    const jobTitle = this.jobPosts.find(j => j.id === this.selectedJob)?.title || 'this position';
    const message = `Based on our review, we'd like to invite you to participate in the following training program(s): ${trainingTitles}. This will help strengthen your skills for the ${jobTitle} position.`;

    if (confirm(`Send training invitation to ${candidate.name}?\n\n${message}`)) {
      alert('Training invitation feature coming soon!');
    }
  }

  // ============================================
  // AI CHAT ASSISTANT
  // ============================================
  
  initializeChat(): void {
    console.log('🤖 Initializing AI Chat Assistant...');
    
    this.chatMessages = [{
      type: 'ai',
      content: '👋 Hello! I\'m your AI hiring assistant. I can help you:\n\n' +
               '• Analyze candidate qualifications\n' +
               '• Find top matches for your jobs\n' +
               '• Recommend training for underqualified candidates\n' +
               '• Compare candidates side-by-side\n\n' +
               'What would you like to know?',
      timestamp: new Date()
    }];
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    
    if (this.isChatOpen && this.chatMessages.length === 0) {
      this.initializeChat();
    }
  }

  // REPLACE the sendMessage() method in candidates.component.ts with this:

sendMessage(): void {
  if (!this.currentMessage.trim() || this.isChatLoading) return;

  const userMessage = this.currentMessage.trim();
  console.log('💬 User message:', userMessage);
  
  // Add user message to chat
  this.chatMessages.push({
    type: 'user',
    content: userMessage,
    timestamp: new Date()
  });
  
  this.currentMessage = '';
  this.isChatLoading = true;

  // Add to chat history
  this.chatHistory.push({
    role: 'user',
    content: userMessage
  });

  const job = this.jobPosts.find(j => j.id === this.selectedJob);

  // CRITICAL: Build context object to send to backend
  const context = {
    jobs: this.jobPosts.map(j => ({
      id: j.id,
      title: j.title,
      skills_required: j.skills_required,
      applications_count: j.applications_count,
      status: j.status
    })),
    trainings: this.availableTrainings.map(t => ({
      id: t.id,
      title: t.title,
      category: t.category,
      level: t.level,
      duration_hours: t.duration_hours,
      cost_type: t.cost_type
    })),
    candidates: this.filteredCandidates.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      title: c.title,
      skills: c.skills,
      match_score: c.match_score
    })),
    selectedJob: job ? {
      id: job.id,
      title: job.title,
      skills_required: job.skills_required
    } : null
  };
  
  console.log('🚀 Calling sendEmployerMessage with:', {
    userMessage,
    historyLength: this.chatHistory.length,
    contextJobs: context.jobs.length,
    contextTrainings: context.trainings.length,
    contextCandidates: context.candidates.length,
    trainingTitles: context.trainings.map(t => t.title)
  });
  
  // CRITICAL: Use sendEmployerMessage (not sendMessage!)
  this.geminiService.sendEmployerMessage(userMessage, this.chatHistory, context)
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isChatLoading = false)
    )
    .subscribe({
      next: (response: GeminiResponse) => {
        console.log('✅ AI chat response:', response);
        
        const aiMessage = response.message || 
          'I apologize, but I couldn\'t process that request. Please try rephrasing.';
        
        this.chatMessages.push({
          type: 'ai',
          content: aiMessage,
          timestamp: new Date()
        });
        
        this.chatHistory.push({
          role: 'assistant',
          content: aiMessage
        });

        setTimeout(() => this.scrollChatToBottom(), 100);
      },
      error: (error) => {
        console.error('❌ AI chat error:', error);
        
        this.chatMessages.push({
          type: 'ai',
          content: '❌ I encountered an error. Please try again or rephrase your question.',
          timestamp: new Date()
        });
        
        this.isChatLoading = false;
      }
    });
}


  private scrollChatToBottom(): void {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  askQuickQuestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }

  // ============================================
  // DATA LOADING & REFRESH
  // ============================================
  
  private setupAutoRefresh(): void {
    console.log('⏱️ Setting up auto-refresh every', this.autoRefreshInterval / 1000, 'seconds');
    
    interval(this.autoRefreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auto-refresh triggered at', new Date().toLocaleTimeString());
        this.checkForNewApplications();
      });
  }
  
  private checkForNewApplications(): void {
    const query: CandidatesQuery = {
      job_id: this.selectedJob === 'all' ? undefined : this.selectedJob,
      page: 1,
      limit: 100
    };
    
    this.candidatesService.getCandidates(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const currentTotal = response.data.pagination?.total || 0;
            
            if (currentTotal > this.totalCandidates) {
              this.newApplicationsCount = currentTotal - this.totalCandidates;
              this.showNewApplicationsBadge = true;
              console.log('🔔 New applications detected:', this.newApplicationsCount);
              this.showBrowserNotification(this.newApplicationsCount);
            }
          }
        },
        error: (error) => {
          console.error('❌ Auto-refresh error:', error);
        }
      });
  }
  
  private showBrowserNotification(count: number): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const jobTitle = this.selectedJob === 'all' 
        ? 'all jobs' 
        : this.jobPosts.find(j => j.id === this.selectedJob)?.title || 'your job';
      
      new Notification('New Job Applications!', {
        body: `${count} new ${count === 1 ? 'application' : 'applications'} received for ${jobTitle}`,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
  
  refreshCandidates(): void {
    console.log('🔄 Manual refresh triggered by user');
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates();
  }
  
  loadJobPosts(): void {
    console.log('📋 Loading job posts...');
    
    this.candidatesService.getJobPosts()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => console.log('✅ Job posts load completed'))
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobPosts = response.data;
            console.log('✅ Job posts loaded:', this.jobPosts.length);
            
            this.loadCandidates();
            this.setupAutoRefresh();
          }
        },
        error: (error) => {
          console.error('❌ Error loading job posts:', error);
          this.loadCandidates();
        }
      });
  }
  
  loadCandidates(): void {
    console.log('🔄 Loading candidates with filters');
    
    this.isLoading = true;
    this.lastRefreshTime = new Date();
    
    const query: CandidatesQuery = {
      job_id: this.selectedJob === 'all' ? undefined : this.selectedJob,
      match_score_min: this.skillsMatchFilter ? parseInt(this.skillsMatchFilter) : undefined,
      location: this.locationFilter || undefined,
      experience: this.experienceFilter || undefined,
      training: this.trainingFilter || undefined,
      sort_by: this.sortBy as any,
      page: this.currentPage,
      limit: this.itemsPerPage
    };
    
    this.candidatesService.getCandidates(query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.candidates = Array.isArray(response.data.data) ? response.data.data : [];
            
            this.totalCandidates = response.data.pagination?.total || 0;
            this.totalPages = response.data.pagination?.total_pages || 1;
            this.currentPage = response.data.pagination?.page || 1;
            
            this.applyClientSideFilters();
          } else {
            this.resetCandidatesState();
          }
        },
        error: (error) => {
          console.error('❌ Error loading candidates:', error);
          this.resetCandidatesState();
        }
      });
  }
  
  private resetCandidatesState(): void {
    this.candidates = [];
    this.filteredCandidates = [];
    this.totalCandidates = 0;
    this.totalPages = 1;
    this.currentPage = 1;
  }
  
  applyClientSideFilters(): void {
    let filtered = [...this.candidates];
    
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(candidate =>
        candidate.name.toLowerCase().includes(query) ||
        candidate.title.toLowerCase().includes(query) ||
        candidate.email?.toLowerCase().includes(query) ||
        (candidate.skills && candidate.skills.some(skill => 
          skill.toLowerCase().includes(query)
        )) ||
        (candidate.location && candidate.location.toLowerCase().includes(query))
      );
    }
    
    this.filteredCandidates = filtered;
  }
  
  // ============================================
  // FILTER & SEARCH ACTIONS
  // ============================================
  
  applyFilters(): void {
    this.currentPage = 1;
    this.loadCandidates();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.skillsMatchFilter = '';
    this.locationFilter = '';
    this.experienceFilter = '';
    this.trainingFilter = '';
    this.sortBy = 'newest';
    this.selectedJob = 'all';
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  onJobChange(): void {
    this.currentPage = 1;
    this.clearSelection();
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates();
  }
  
  sortCandidates(): void {
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  onSearchChange(): void {
    this.applyClientSideFilters();
  }
  
  onSearchSubmit(): void {
    this.applyClientSideFilters();
  }
  
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }
  
  // ============================================
  // CANDIDATE SELECTION & BATCH ACTIONS
  // ============================================
  
  toggleCandidateSelection(candidateId: string): void {
    const index = this.selectedCandidates.indexOf(candidateId);
    if (index > -1) {
      this.selectedCandidates.splice(index, 1);
    } else {
      this.selectedCandidates.push(candidateId);
    }
    
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (candidate) {
      candidate.is_selected = this.selectedCandidates.includes(candidateId);
    }
    
    this.showBatchActions = this.selectedCandidates.length > 0;
  }
  
  selectAllVisible(): void {
    this.filteredCandidates.forEach(candidate => {
      if (!this.selectedCandidates.includes(candidate.id)) {
        this.selectedCandidates.push(candidate.id);
        candidate.is_selected = true;
      }
    });
    this.showBatchActions = true;
  }
  
  clearSelection(): void {
    this.selectedCandidates = [];
    this.candidates.forEach(c => c.is_selected = false);
    this.showBatchActions = false;
  }
  
  shortlistSelected(): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to shortlist candidates');
      return;
    }
    
    const promises = this.selectedCandidates.map(candidateId =>
      this.candidatesService.toggleShortlist(candidateId, this.selectedJob).toPromise()
    );
    
    Promise.all(promises).then(() => {
      this.loadCandidates();
      this.clearSelection();
    }).catch(error => {
      console.error('❌ Error in batch shortlist:', error);
      alert('Failed to shortlist some candidates. Please try again.');
    });
  }
  
  sendBulkInvites(): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to send invitations');
      return;
    }
    
    const message = prompt('Enter invitation message (optional):') ||
      'You have been invited to apply for this position based on your profile.';
    
    this.candidatesService.sendBulkInvitations(this.selectedCandidates, this.selectedJob, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Invitations sent successfully!');
          this.clearSelection();
        },
        error: (error) => {
          console.error('❌ Error sending invites:', error);
          alert('Failed to send invitations. Please try again.');
        }
      });
  }
  
  // ============================================
  // INDIVIDUAL CANDIDATE ACTIONS
  // ============================================
  
  viewFullProfile(candidateId: string): void {
    this.router.navigate(['../candidate-profile', candidateId], {
      queryParams: { jobId: this.selectedJob === 'all' ? undefined : this.selectedJob }
    });
  }
  
  toggleShortlist(candidate: Candidate): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to shortlist candidates');
      return;
    }
    
    this.candidatesService.toggleShortlist(candidate.id, this.selectedJob)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            candidate.is_shortlisted = response.data.is_shortlisted;
          }
        },
        error: (error) => {
          console.error('❌ Error toggling shortlist:', error);
        }
      });
  }
  
  inviteToApply(candidateId: string): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to send invitation');
      return;
    }
    
    const message = prompt('Enter invitation message (optional):') ||
      'You have been invited to apply for this position based on your profile.';
    
    this.candidatesService.inviteCandidate(candidateId, this.selectedJob, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Invitation sent successfully!');
        },
        error: (error) => {
          console.error('❌ Error sending invitation:', error);
          alert('Failed to send invitation. Please try again.');
        }
      });
  }
  
  startChat(candidateId: string): void {
    this.router.navigate(['/employer/messages'], {
      queryParams: { userId: candidateId }
    });
  }
  
  requestInterview(candidateId: string | undefined): void {
    if (!candidateId) return;
    
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: { 
        candidateId, 
        jobId: this.selectedJob === 'all' ? undefined : this.selectedJob 
      }
    });
  }
  
  // ============================================
  // UTILITY METHODS
  // ============================================
  
  getFullImageUrl(imagePath: string | null | undefined, candidateName: string): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
    }
    
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }
    
    if (imagePath.startsWith('assets/')) {
      return imagePath;
    }
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }

  handleImageError(event: any, candidateName: string): void {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  get paginatedCandidates(): Candidate[] {
    return this.filteredCandidates;
  }
  
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCandidates();
    }
  }
  
  openComparison(): void {
    if (this.selectedCandidates.length >= 2) {
      this.showComparison = true;
    }
  }
  
  closeComparison(): void {
    this.showComparison = false;
  }
  
  getMatchScoreClass(score: number): string {
    if (score >= 90) return 'match-excellent';
    if (score >= 80) return 'match-good';
    if (score >= 70) return 'match-fair';
    return 'match-low';
  }
  
  downloadReport(): void {
    console.log('📥 Downloading candidate report...');
  }
  
  toggleSelection(candidate: Candidate): void {
    this.toggleCandidateSelection(candidate.id);
  }
  
  promoteJob() {
    console.log('📢 Promoting job...');
  }
}