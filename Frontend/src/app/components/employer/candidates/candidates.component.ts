// src/app/employer/candidates/candidates.component.ts - WITH AUTO-REFRESH

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, interval } from 'rxjs';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { CandidatesService, Candidate, JobPost, CandidatesQuery } from '../../../../../services/candidates.service';

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
  
  // UI state
  selectedJob: string = '';
  viewMode: 'grid' | 'list' = 'grid';
  isLoading: boolean = false;
  lastRefreshTime: Date = new Date();
  
  // Filters
  searchQuery = '';
  skillsMatchFilter = '';
  locationFilter = '';
  experienceFilter = '';
  trainingFilter = '';
  sortBy = 'match_score';
  
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
  currentInsight: any = null;
  
  // AI Chat
  isChatOpen = false;
  currentMessage = '';
  chatMessages: { type: 'user' | 'ai'; content: string }[] = [
    { type: 'ai', content: 'Hello! I can help you understand candidate matches. Ask me anything about these candidates!' }
  ];
  
  // 🔥 NEW: Auto-refresh properties
  private autoRefreshInterval = 30000; // 30 seconds
  showNewApplicationsBadge = false;
  newApplicationsCount = 0;
  
  Math = Math;
  
  constructor(
    private candidatesService: CandidatesService,
    private router: Router
  ) {}
  
  ngOnInit() {
    console.log('🚀 Candidates Component initialized');
    this.loadJobPosts();
    
    // 🔥 Setup auto-refresh for new applications
    this.setupAutoRefresh();
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * 🔥 NEW: Setup auto-refresh to check for new applications
   */
  private setupAutoRefresh(): void {
    console.log('⏱️ Setting up auto-refresh every', this.autoRefreshInterval / 1000, 'seconds');
    
    interval(this.autoRefreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auto-refresh triggered at', new Date().toLocaleTimeString());
        this.checkForNewApplications();
      });
  }
  
  /**
   * 🔥 NEW: Check for new applications without disrupting user
   */
  private checkForNewApplications(): void {
    if (!this.selectedJob) return;
    
    const query: CandidatesQuery = {
      job_id: this.selectedJob,
      page: 1,
      limit: 100 // Get more to detect new ones
    };
    
    this.candidatesService.getCandidates(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const currentTotal = response.data.pagination?.total || 0;
            
            // Check if there are new applications
            if (currentTotal > this.totalCandidates) {
              this.newApplicationsCount = currentTotal - this.totalCandidates;
              this.showNewApplicationsBadge = true;
              
              console.log('🔔 New applications detected:', this.newApplicationsCount);
              
              // Show browser notification if permitted
              this.showBrowserNotification(this.newApplicationsCount);
            }
          }
        },
        error: (error) => {
          console.error('❌ Auto-refresh error:', error);
        }
      });
  }
  
  /**
   * 🔥 NEW: Show browser notification for new applications
   */
  private showBrowserNotification(count: number): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const jobTitle = this.jobPosts.find(j => j.id === this.selectedJob)?.title || 'your job';
      
      new Notification('New Job Applications!', {
        body: `${count} new ${count === 1 ? 'application' : 'applications'} received for ${jobTitle}`,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Request permission for future notifications
      Notification.requestPermission();
    }
  }
  
  /**
   * 🔥 NEW: Refresh data when user clicks the badge
   */
  refreshCandidates(): void {
    console.log('🔄 Manual refresh triggered by user');
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates();
  }
  
  /**
   * Load employer's job posts
   */
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
            
            // Auto-select first job if available
            if (this.jobPosts.length > 0 && !this.selectedJob) {
              this.selectedJob = this.jobPosts[0].id;
              this.loadCandidates();
            }
            
            console.log('✅ Job posts loaded:', this.jobPosts.length);
          }
        },
        error: (error) => {
          console.error('❌ Error loading job posts:', error);
        }
      });
  }
  
  /**
   * Load candidates based on filters
   */
  loadCandidates(): void {
    console.log('🔄 Loading candidates...');
    
    this.isLoading = true;
    this.lastRefreshTime = new Date();
    
    const query: CandidatesQuery = {
      job_id: this.selectedJob || undefined,
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
          console.log('✅ Candidates load completed');
        })
      )
      .subscribe({
        next: (response) => {
          console.log('📦 Raw API response:', response);
          
          if (response.success && response.data) {
            this.candidates = Array.isArray(response.data.data) ? response.data.data : [];
            this.filteredCandidates = [...this.candidates];
            
            // Update pagination
            this.totalCandidates = response.data.pagination?.total || 0;
            this.totalPages = response.data.pagination?.total_pages || 1;
            this.currentPage = response.data.pagination?.page || 1;
            
            // Apply client-side search filter if present
            if (this.searchQuery) {
              this.applyClientSideSearch();
            }
            
            console.log('✅ Candidates loaded:', {
              count: this.candidates.length,
              total: this.totalCandidates,
              page: this.currentPage,
              totalPages: this.totalPages
            });
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
  
  /**
   * Reset candidates state to empty
   */
  private resetCandidatesState(): void {
    this.candidates = [];
    this.filteredCandidates = [];
    this.totalCandidates = 0;
    this.totalPages = 1;
    this.currentPage = 1;
  }
  
  /**
   * Apply client-side search filter
   */
  applyClientSideSearch(): void {
    if (!this.searchQuery) {
      this.filteredCandidates = [...this.candidates];
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredCandidates = this.candidates.filter(candidate =>
      candidate.name.toLowerCase().includes(query) ||
      candidate.title.toLowerCase().includes(query) ||
      (candidate.skills && candidate.skills.some(skill => skill.toLowerCase().includes(query)))
    );
  }
  
  // Filter change handlers
  onJobChange(): void {
    console.log('🔄 Job changed to:', this.selectedJob);
    this.currentPage = 1;
    this.clearSelection();
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates();
  }
  
  applyFilters(): void {
    console.log('🔍 Applying filters...');
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  clearFilters(): void {
    this.searchQuery = '';
    this.skillsMatchFilter = '';
    this.locationFilter = '';
    this.experienceFilter = '';
    this.trainingFilter = '';
    this.sortBy = 'match_score';
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  sortCandidates(): void {
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }
  
  // Selection methods
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
  
  // Batch actions
  shortlistSelected(): void {
    if (!this.selectedJob) {
      alert('Please select a job first');
      return;
    }
    
    const promises = this.selectedCandidates.map(candidateId =>
      this.candidatesService.toggleShortlist(candidateId, this.selectedJob).toPromise()
    );
    
    Promise.all(promises).then(() => {
      console.log('✅ Batch shortlist completed');
      this.loadCandidates();
      this.clearSelection();
    }).catch(error => {
      console.error('❌ Error in batch shortlist:', error);
      alert('Failed to shortlist some candidates. Please try again.');
    });
  }
  
  sendBulkInvites(): void {
    if (!this.selectedJob) {
      alert('Please select a job first');
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
  
  // Individual candidate actions
  viewFullProfile(candidateId: string): void {
    this.router.navigate(['/employer/candidate-profile', candidateId], {
      queryParams: { jobId: this.selectedJob }
    });
  }
  
  toggleShortlist(candidate: Candidate): void {
    if (!this.selectedJob) {
      alert('Please select a job first');
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
    if (!this.selectedJob) {
      alert('Please select a job first');
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
  
  requestInterview(candidateId: string): void {
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: { candidateId, jobId: this.selectedJob }
    });
  }
  
  // Helper methods remain the same...
  showAIInsights(candidate: Candidate): void {
    this.currentInsight = {
      reason: `High match (${candidate.match_score}%) due to strong ${candidate.skills.slice(0, 2).join(' and ')} skills`,
      skillOverlap: candidate.skills.slice(0, 3),
      experienceRelevance: candidate.experience,
      trainingMatch: candidate.certifications.length > 0 ?
        candidate.certifications[0].name : 'No specific training match'
    };
  }
  
  hideAIInsights(): void {
    this.currentInsight = null;
  }
  
  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
  }
  
  sendMessage(): void {
    if (this.currentMessage.trim()) {
      this.chatMessages.push({ type: 'user', content: this.currentMessage });
      
      setTimeout(() => {
        this.generateAIResponse(this.currentMessage);
      }, 1000);
      
      this.currentMessage = '';
    }
  }
  
  generateAIResponse(message: string): void {
    let response = '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('top') || lowerMessage.includes('best')) {
      const topCandidates = this.candidates
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 5);
      response = `Top candidates: ${topCandidates.map(c => `${c.name} (${c.match_score}%)`).join(', ')}`;
    } else if (lowerMessage.includes('certified') || lowerMessage.includes('training')) {
      const certified = this.candidates.filter(c =>
        c.certifications.some(cert => cert.verified)
      );
      response = `${certified.length} candidates have verified certifications: ${certified.map(c => c.name).join(', ')}`;
    } else if (lowerMessage.includes('available')) {
      const available = this.candidates.filter(c =>
        c.availability.includes('immediately')
      );
      response = `${available.length} candidates are available immediately: ${available.map(c => c.name).join(', ')}`;
    } else {
      response = 'I can help you find the best candidates! Try asking: "Who are the top candidates?" or "Show certified candidates"';
    }
    
    this.chatMessages.push({ type: 'ai', content: response });
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
  
  onSearchSubmit() {
    this.applyFilters();
  }
}