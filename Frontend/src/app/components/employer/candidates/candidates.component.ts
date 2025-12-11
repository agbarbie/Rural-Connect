// src/app/employer/candidates/candidates.component.ts - FIXED AUTO-LOAD & FILTERS

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, interval } from 'rxjs';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { CandidatesService, Candidate, JobPost, CandidatesQuery } from '../../../../../services/candidates.service';
import { environment } from '../../../../environments/environments';

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
  selectedJob: string = 'all'; // 🔥 CHANGED: Default to 'all' to show all candidates
  viewMode: 'grid' | 'list' = 'grid';
  isLoading: boolean = false;
  lastRefreshTime: Date = new Date();
  
  // Filters
  searchQuery = '';
  skillsMatchFilter = '';
  locationFilter = '';
  experienceFilter = '';
  trainingFilter = '';
  sortBy = 'newest'; // 🔥 CHANGED: Default to newest first
  
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
  
  // Auto-refresh properties
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
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Setup auto-refresh to check for new applications
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
   * Check for new applications without disrupting user
   */
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
  
  /**
   * Show browser notification for new applications
   */
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
  
  /**
   * Refresh data when user clicks the badge
   */
  refreshCandidates(): void {
    console.log('🔄 Manual refresh triggered by user');
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates();
  }
  
  /**
   * 🔥 FIXED: Load employer's job posts and auto-load candidates
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
            console.log('✅ Job posts loaded:', this.jobPosts.length);
            
            // 🔥 AUTO-LOAD: Load candidates immediately after job posts are loaded
            this.loadCandidates();
            
            // Setup auto-refresh after initial load
            this.setupAutoRefresh();
          }
        },
        error: (error) => {
          console.error('❌ Error loading job posts:', error);
          // 🔥 Even if job posts fail, try to load candidates
          this.loadCandidates();
        }
      });
  }
  
  /**
   * 🔥 FIXED: Load candidates based on filters with proper query building
   */
  loadCandidates(): void {
    console.log('🔄 Loading candidates with filters:', {
      selectedJob: this.selectedJob,
      searchQuery: this.searchQuery,
      skillsMatchFilter: this.skillsMatchFilter,
      locationFilter: this.locationFilter,
      experienceFilter: this.experienceFilter,
      trainingFilter: this.trainingFilter,
      sortBy: this.sortBy
    });
    
    this.isLoading = true;
    this.lastRefreshTime = new Date();
    
    // 🔥 FIXED: Build query properly - only send job_id if not 'all'
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
    
    console.log('📤 Sending query to backend:', query);
    
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
            
            // Update pagination
            this.totalCandidates = response.data.pagination?.total || 0;
            this.totalPages = response.data.pagination?.total_pages || 1;
            this.currentPage = response.data.pagination?.page || 1;
            
            // 🔥 FIXED: Apply client-side filters AFTER loading from backend
            this.applyClientSideFilters();
            
            console.log('✅ Candidates loaded:', {
              count: this.candidates.length,
              filtered: this.filteredCandidates.length,
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
   * 🔥 FIXED: Apply client-side filters for search query
   */
  applyClientSideFilters(): void {
    // Start with all candidates from backend
    let filtered = [...this.candidates];
    
    // Apply search query filter
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
      console.log('🔍 Search filter applied:', {
        query,
        before: this.candidates.length,
        after: filtered.length
      });
    }
    
    this.filteredCandidates = filtered;
  }
  
  /**
   * 🔥 FIXED: Apply filters triggers backend reload
   */
  applyFilters(): void {
    console.log('🔍 Applying filters...');
    this.currentPage = 1; // Reset to first page
    this.loadCandidates(); // Reload from backend with new filters
  }

  getFullImageUrl(imagePath: string | null | undefined, candidateName: string): string {
  // If no image path, return avatar placeholder
  if (!imagePath) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }
  
  // If it's already a full URL (http/https or data URL), return as is
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // If it's a relative path, construct full URL
  if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  }
  
  // If it's an asset path
  if (imagePath.startsWith('assets/')) {
    return imagePath;
  }
  
  // Default to avatar if path doesn't match expected patterns
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
}

/**
 * Handle image load error - fallback to avatar
 */
handleImageError(event: any, candidateName: string): void {
  console.log('Profile image load error for:', candidateName);
  event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
}

/**
 * Get initials for avatar fallback
 */
getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
  
  /**
   * 🔥 FIXED: Clear filters and reload
   */
  clearFilters(): void {
    console.log('🧹 Clearing filters...');
    this.searchQuery = '';
    this.skillsMatchFilter = '';
    this.locationFilter = '';
    this.experienceFilter = '';
    this.trainingFilter = '';
    this.sortBy = 'newest';
    this.selectedJob = 'all'; // Reset to show all jobs
    this.currentPage = 1;
    this.loadCandidates();
  }
  
  /**
   * 🔥 FIXED: Job change handler
   */
  onJobChange(): void {
    console.log('🔄 Job changed to:', this.selectedJob);
    this.currentPage = 1;
    this.clearSelection();
    this.showNewApplicationsBadge = false;
    this.newApplicationsCount = 0;
    this.loadCandidates(); // Reload with new job filter
  }
  
  /**
   * 🔥 FIXED: Sort change handler
   */
  sortCandidates(): void {
    console.log('📊 Sort changed to:', this.sortBy);
    this.currentPage = 1;
    this.loadCandidates(); // Reload with new sort
  }
  
  /**
   * 🔥 NEW: Search input handler (debounced search would be better)
   */
  onSearchChange(): void {
    // Apply client-side filter immediately for search
    this.applyClientSideFilters();
  }
  
  /**
   * Handle search form submission
   */
  onSearchSubmit(): void {
    this.applyClientSideFilters();
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
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to shortlist candidates');
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
  
  // Individual candidate actions
  viewFullProfile(candidateId: string): void {
  console.log('🔍 Navigating to candidate profile:', candidateId);
  
  // ✅ Route is defined as: 'employer/candidate-profile/:id'
  // So navigate to: ['/employer/candidate-profile', candidateId]
  // This will make candidateId available as params['id']

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
  
  requestInterview(candidateId: string): void {
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: { 
        candidateId, 
        jobId: this.selectedJob === 'all' ? undefined : this.selectedJob 
      }
    });
  }
  
  // Helper methods
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
      const topCandidates = this.filteredCandidates
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 5);
      response = `Top candidates: ${topCandidates.map(c => `${c.name} (${c.match_score}%)`).join(', ')}`;
    } else if (lowerMessage.includes('certified') || lowerMessage.includes('training')) {
      const certified = this.filteredCandidates.filter(c =>
        c.certifications.some(cert => cert.verified)
      );
      response = `${certified.length} candidates have verified certifications: ${certified.map(c => c.name).join(', ')}`;
    } else if (lowerMessage.includes('available')) {
      const available = this.filteredCandidates.filter(c =>
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
}