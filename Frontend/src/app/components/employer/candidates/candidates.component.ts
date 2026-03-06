// src/app/employer/candidates/candidates.component.ts

import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import {
  CandidatesService,
  Candidate,
  JobPost,
  CandidatesQuery,
  CandidateProfile,
  RatingStats,
  Rating
} from '../../../../../services/candidates.service';
import { environment } from '../../../../environments/environments';
import {
  GeminiChatService,
  GeminiResponse,
} from '../../../../../services/gemini-chat.service';
import {
  TrainingService,
  Training,
} from '../../../../../services/training.service';
import { RatingComponent } from '../rating/rating.component';
import { RatingService } from '../../../../../services/rating.service';

// ✅ Toast notification interface
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  candidateName?: string;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, RatingComponent],
  templateUrl: './candidates.component.html',
  styleUrls: ['./candidates.component.css'],
})
export class CandidatesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
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
  showProfileModal = false;
  currentProfileData: CandidateProfile | null = null;
  isLoadingProfile = false;

  // Chat
  isChatOpen = false;
  currentMessage = '';
  chatMessages: any[] = [];
  isChatLoading = false;
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  // Rating
  showRatingModal = false;
  candidateToRate: any = null;

  // ✅ Toast notifications for employer feedback
  toasts: Toast[] = [];

  // Shortlist loading state — tracks which candidate is being shortlisted
  shortlistingId: string | null = null;

  Math = Math;

  constructor(
    private candidatesService: CandidatesService,
    private geminiService: GeminiChatService,
    @Inject(TrainingService) private trainingService: TrainingService,
    private ratingService: RatingService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadJobPosts();
    this.loadEmployerTrainings();
    this.initializeChat();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // TOAST NOTIFICATION SYSTEM (employer feedback)
  // ============================================================

  /**
   * Show a toast to the employer.
   * type: 'success' | 'error' | 'info' | 'warning'
   * Auto-dismisses after 4 seconds.
   */
  showToast(
    message: string,
    type: Toast['type'] = 'success',
    candidateName?: string
  ): void {
    const id = Date.now().toString();
    this.toasts.push({ id, message, type, candidateName });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getToastIcon(type: Toast['type']): string {
    const icons: Record<Toast['type'], string> = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      info: 'fa-info-circle',
      warning: 'fa-exclamation-triangle',
    };
    return icons[type];
  }

  // ============================================================
  // RATING HELPER METHODS
  // ============================================================

  getStarArray(rating: number): number[] {
    const stars: number[] = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    for (let i = 0; i < fullStars; i++) stars.push(1);
    if (hasHalfStar && fullStars < 5) stars.push(0.5);
    while (stars.length < 5) stars.push(0);
    return stars;
  }

  formatRatingDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) { const w = Math.floor(diffDays / 7); return `${w} ${w === 1 ? 'week' : 'weeks'} ago`; }
    if (diffDays < 365) { const m = Math.floor(diffDays / 30); return `${m} ${m === 1 ? 'month' : 'months'} ago`; }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  getRatingPercentage(count: number, total: number): number {
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }

  hasRatings(candidate: Candidate): boolean {
    return (candidate.total_ratings ?? 0) > 0;
  }

  getRatingBadgeClass(rating: number): string {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 4.0) return 'rating-good';
    if (rating >= 3.0) return 'rating-fair';
    return 'rating-poor';
  }

  hasSkillRatings(profile: CandidateProfile | null): boolean {
    if (!profile?.rating_stats?.skill_ratings) return false;
    const s = profile.rating_stats.skill_ratings;
    return !!((s.technical ?? 0) > 0 || (s.communication ?? 0) > 0 ||
      (s.professionalism ?? 0) > 0 || (s.quality ?? 0) > 0 || (s.timeliness ?? 0) > 0);
  }

  getRatingDistributionValue(
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } | undefined,
    rating: number
  ): number {
    if (!distribution) return 0;
    return (distribution as { [key: number]: number })[rating] || 0;
  }

  // ============================================================
  // PROFILE MODAL
  // ============================================================

  viewFullProfile(candidateId: string): void {
    this.showProfileModal = true;
    this.isLoadingProfile = true;
    this.currentProfileData = null;
    const jobId = this.selectedJob === 'all' ? undefined : this.selectedJob;

    this.candidatesService
      .getCandidateProfile(candidateId, jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.currentProfileData = response.data;
          } else {
            this.showToast('Failed to load candidate profile.', 'error');
            this.closeProfileModal();
          }
          this.isLoadingProfile = false;
        },
        error: () => {
          this.showToast('Failed to load candidate profile.', 'error');
          this.closeProfileModal();
          this.isLoadingProfile = false;
        },
      });
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.currentProfileData = null;
    this.isLoadingProfile = false;
  }

  toggleShortlistFromModal(): void {
    if (!this.currentProfileData || !this.selectedJob || this.selectedJob === 'all') {
      this.showToast('Please select a specific job to shortlist candidates.', 'warning');
      return;
    }

    const candidateName = this.currentProfileData.name;
    this.shortlistingId = this.currentProfileData.user_id;

    this.candidatesService
      .toggleShortlist(this.currentProfileData.user_id, this.selectedJob)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.shortlistingId = null; })
      )
      .subscribe({
        next: (response) => {
          if (response.success && this.currentProfileData?.application) {
            const isNowShortlisted = response.data.is_shortlisted;
            this.currentProfileData.application.status = isNowShortlisted
              ? 'shortlisted'
              : 'reviewed';

            // Sync in the candidates list
            const candidate = this.candidates.find(c => c.id === this.currentProfileData!.user_id);
            if (candidate) candidate.is_shortlisted = isNowShortlisted;

            // ✅ Show employer success toast
            if (isNowShortlisted) {
              this.showToast(
                `Successfully shortlisted ${candidateName}! They have been notified.`,
                'success',
                candidateName
              );
            } else {
              this.showToast(`${candidateName} removed from shortlist.`, 'info', candidateName);
            }
          }
        },
        error: () => {
          this.showToast('Failed to update shortlist status. Please try again.', 'error');
        },
      });
  }

  hasSocialLinks(profile: CandidateProfile | null): boolean {
    if (!profile) return false;
    const l = profile.social_links;
    return !!(l.linkedin || l.github || l.portfolio || l.website);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  // ============================================================
  // RATING MODAL
  // ============================================================

  openRatingModal(candidate: any): void {
    this.candidateToRate = {
      user_id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      profile_image: candidate.profile_picture,
      job_id: this.selectedJob !== 'all' ? this.selectedJob : candidate.job_id,
      job_title: this.getJobTitleForCandidate(candidate),
      application_id: candidate.application_id,
    };
    this.showRatingModal = true;
  }

  private getJobTitleForCandidate(candidate: any): string | undefined {
    if (this.selectedJob !== 'all') {
      return this.jobPosts.find(j => j.id === this.selectedJob)?.title;
    }
    return candidate.job_title;
  }

  closeRatingModal(): void {
    this.showRatingModal = false;
    this.candidateToRate = null;
  }

  onRatingSubmitted(rating: any): void {
    this.showToast(`Successfully rated ${this.candidateToRate.name}!`, 'success');
    this.closeRatingModal();
    this.loadCandidates();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadEmployerTrainings(): void {
    const employerId = localStorage.getItem('userId');
    if (!employerId) return;

    this.trainingService
      .getMyTrainings({ status: 'published', limit: 100 }, employerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.trainings) {
            this.availableTrainings = response.data.trainings;
          }
        },
        error: (error) => console.error('❌ Error loading trainings:', error),
      });
  }

  loadJobPosts(): void {
    this.candidatesService
      .getJobPosts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobPosts = response.data;
          }
          this.loadCandidates();
        },
        error: () => this.loadCandidates(),
      });
  }

  loadCandidates(): void {
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
      limit: this.itemsPerPage,
    };

    this.candidatesService
      .getCandidates(query)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; }))
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
        error: () => this.resetCandidatesState(),
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
    if (this.searchQuery?.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.skills?.some(s => s.toLowerCase().includes(q)) ||
        c.location?.toLowerCase().includes(q)
      );
    }
    this.filteredCandidates = filtered;
  }

  // ============================================================
  // FILTER & SORT
  // ============================================================

  applyFilters(): void { this.currentPage = 1; this.loadCandidates(); }

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

  onJobChange(): void { this.currentPage = 1; this.clearSelection(); this.loadCandidates(); }
  sortCandidates(): void { this.currentPage = 1; this.loadCandidates(); }
  onSearchChange(): void { this.applyClientSideFilters(); }
  onSearchSubmit(): void { this.applyClientSideFilters(); }
  toggleViewMode(): void { this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid'; }

  // ============================================================
  // SELECTION
  // ============================================================

  toggleCandidateSelection(candidateId: string): void {
    const index = this.selectedCandidates.indexOf(candidateId);
    if (index > -1) {
      this.selectedCandidates.splice(index, 1);
    } else {
      this.selectedCandidates.push(candidateId);
    }
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (candidate) candidate.is_selected = this.selectedCandidates.includes(candidateId);
    this.showBatchActions = this.selectedCandidates.length > 0;
  }

  selectAllVisible(): void {
    this.filteredCandidates.forEach(c => {
      if (!this.selectedCandidates.includes(c.id)) {
        this.selectedCandidates.push(c.id);
        c.is_selected = true;
      }
    });
    this.showBatchActions = true;
  }

  clearSelection(): void {
    this.selectedCandidates = [];
    this.candidates.forEach(c => c.is_selected = false);
    this.showBatchActions = false;
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * ✅ Single-candidate shortlist toggle with toast feedback.
   * Called from the card's "Shortlist" button.
   */
  toggleShortlist(candidate: Candidate): void {
    if (this.selectedJob === 'all') {
      this.showToast('Please select a specific job to shortlist candidates.', 'warning');
      return;
    }

    // Prevent double-click
    if (this.shortlistingId === candidate.id) return;
    this.shortlistingId = candidate.id;

    const candidateName = candidate.name;
    const wasShortlisted = candidate.is_shortlisted;

    this.candidatesService
      .toggleShortlist(candidate.id, this.selectedJob)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.shortlistingId = null; })
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            candidate.is_shortlisted = response.data.is_shortlisted;

            // ✅ Employer toast — confirms shortlist AND mentions notification sent
            if (response.data.is_shortlisted) {
              this.showToast(
                `✅ ${candidateName} has been shortlisted successfully! They have been notified.`,
                'success',
                candidateName
              );
            } else {
              this.showToast(
                `${candidateName} has been removed from the shortlist.`,
                'info',
                candidateName
              );
            }
          }
        },
        error: () => {
          // Revert optimistic UI if we had changed anything
          this.showToast(`Failed to update shortlist for ${candidateName}. Please try again.`, 'error');
        },
      });
  }

  shortlistSelected(): void {
    if (this.selectedJob === 'all') {
      this.showToast('Please select a specific job to shortlist candidates.', 'warning');
      return;
    }

    const promises = this.selectedCandidates.map(candidateId =>
      this.candidatesService.toggleShortlist(candidateId, this.selectedJob).toPromise()
    );

    Promise.all(promises)
      .then(() => {
        this.showToast(`${this.selectedCandidates.length} candidate(s) shortlisted successfully!`, 'success');
        this.loadCandidates();
        this.clearSelection();
      })
      .catch(() => {
        this.showToast('Failed to shortlist some candidates. Please try again.', 'error');
      });
  }

  sendBulkInvites(): void {
    if (this.selectedJob === 'all') {
      this.showToast('Please select a specific job to send invitations.', 'warning');
      return;
    }

    const message =
      prompt('Enter invitation message:') ||
      'You have been invited to apply for this position.';

    this.candidatesService
      .sendBulkInvitations(this.selectedCandidates, this.selectedJob, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showToast('Invitations sent successfully!', 'success');
          this.clearSelection();
        },
        error: () => this.showToast('Failed to send invitations.', 'error'),
      });
  }

  inviteToApply(candidateId: string): void {
    if (this.selectedJob === 'all') {
      this.showToast('Please select a specific job.', 'warning');
      return;
    }

    const message = prompt('Enter invitation message:') || 'You have been invited to apply.';

    this.candidatesService
      .inviteCandidate(candidateId, this.selectedJob, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.showToast('Invitation sent!', 'success'),
        error: () => this.showToast('Failed to send invitation.', 'error'),
      });
  }

  startChat(candidateId: string): void {
    this.router.navigate(['/employer/messages'], { queryParams: { userId: candidateId } });
  }

  requestInterview(candidateId: string | undefined): void {
    if (!candidateId) return;
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: {
        candidateId,
        jobId: this.selectedJob === 'all' ? undefined : this.selectedJob,
      },
    });
  }

  // ============================================================
  // UTILITY
  // ============================================================

  getFullImageUrl(imagePath: string | null | undefined, candidateName: string): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
    }
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) return imagePath;
    if (imagePath.startsWith('/uploads')) {
      return `${environment.apiUrl.replace('/api', '')}${imagePath}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
  }

  handleImageError(event: any, candidateName: string): void {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateName)}&background=4285f4&color=fff&size=128`;
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

  openComparison(): void { if (this.selectedCandidates.length >= 2) this.showComparison = true; }
  closeComparison(): void { this.showComparison = false; }

  getMatchScoreClass(score: number): string {
    if (score >= 90) return 'match-excellent';
    if (score >= 80) return 'match-good';
    if (score >= 70) return 'match-fair';
    return 'match-low';
  }

  downloadReport(): void { console.log('📥 Downloading report...'); }
  toggleSelection(candidate: Candidate): void { this.toggleCandidateSelection(candidate.id); }
  promoteJob(): void { console.log('📢 Promoting job...'); }
  refreshCandidates(): void { this.loadCandidates(); }

  toggleSidebar(): void {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('open');
    document.querySelector('.hamburger')?.classList.toggle('active');
  }

  closeSidebar(): void {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('open');
    document.querySelector('.hamburger')?.classList.remove('active');
  }

  // ============================================================
  // CHAT
  // ============================================================

  initializeChat(): void {
    this.chatMessages = [{
      type: 'ai',
      content: "👋 Hello! I'm your AI hiring assistant. How can I help you today?",
      timestamp: new Date(),
    }];
  }

  toggleChat(): void { this.isChatOpen = !this.isChatOpen; }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isChatLoading) return;

    const userMessage = this.currentMessage.trim();
    this.chatMessages.push({ type: 'user', content: userMessage, timestamp: new Date() });
    this.currentMessage = '';
    this.isChatLoading = true;
    this.chatHistory.push({ role: 'user', content: userMessage });

    const job = this.jobPosts.find(j => j.id === this.selectedJob);
    const context = {
      jobs: this.jobPosts,
      trainings: this.availableTrainings,
      candidates: this.filteredCandidates.slice(0, 10),
      selectedJob: job || null,
    };

    this.geminiService
      .sendEmployerMessage(userMessage, this.chatHistory, context)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GeminiResponse) => {
          const aiMessage = response.message || "I couldn't process that request.";
          this.chatMessages.push({ type: 'ai', content: aiMessage, timestamp: new Date() });
          this.chatHistory.push({ role: 'assistant', content: aiMessage });
          this.isChatLoading = false;
        },
        error: () => {
          this.chatMessages.push({ type: 'ai', content: '❌ Error occurred. Please try again.', timestamp: new Date() });
          this.isChatLoading = false;
        },
      });
  }

  askQuickQuestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }
}