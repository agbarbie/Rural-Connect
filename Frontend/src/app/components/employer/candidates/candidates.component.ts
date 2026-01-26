// candidates.component.ts - COMPLETE WITH MOBILE SIDEBAR, CHAT TOGGLE & RATING METHODS
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, RatingComponent],
  templateUrl: './candidates.component.html',
  styleUrls: ['./candidates.component.css'],
})
export class CandidatesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Mobile state
  isMobile = false;
  isChatOpenMobile = false;

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

  // Math utility for templates
  Math = Math;

  constructor(
    private candidatesService: CandidatesService,
    private geminiService: GeminiChatService,
    private trainingService: TrainingService,
    private ratingService: RatingService,
    private router: Router
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkIfMobile();
  }

  ngOnInit() {
    console.log('🚀 Candidates Component initialized');
    this.checkIfMobile();
    this.loadJobPosts();
    this.loadEmployerTrainings();
    this.initializeChat();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // MOBILE DETECTION & CHAT TOGGLE
  // ============================================

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  toggleMobileChat(): void {
    this.isChatOpenMobile = !this.isChatOpenMobile;
    const rightSidebar = document.querySelector('.right-sidebar');
    if (rightSidebar) {
      if (this.isChatOpenMobile) {
        rightSidebar.classList.add('chat-open');
      } else {
        rightSidebar.classList.remove('chat-open');
      }
    }
  }

  // ============================================
  // PROFILE MODAL FUNCTIONS
  // ============================================

  viewFullProfile(candidateId: string): void {
    console.log('📋 Loading full profile for candidate:', candidateId);

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
        },
      });
  }

  openRatingModal(candidate: any): void {
    console.log('📝 Opening rating modal for candidate:', candidate.name);
    
    this.candidateToRate = {
      user_id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      profile_image: candidate.profile_picture,
      job_id: this.selectedJob !== 'all' ? this.selectedJob : candidate.job_id,
      job_title: this.getJobTitleForCandidate(candidate),
      application_id: candidate.application_id
    };
    
    this.showRatingModal = true;
  }

  private getJobTitleForCandidate(candidate: any): string | undefined {
    if (this.selectedJob !== 'all') {
      const selectedJobPost = this.jobPosts.find(j => j.id === this.selectedJob);
      return selectedJobPost?.title;
    }
    return candidate.job_title;
  }

  closeRatingModal(): void {
    this.showRatingModal = false;
    this.candidateToRate = null;
  }

  onRatingSubmitted(rating: any): void {
    alert(`✅ Successfully rated ${this.candidateToRate.name}!`);
    this.closeRatingModal();
    this.loadCandidates();
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.currentProfileData = null;
    this.isLoadingProfile = false;
  }

  toggleShortlistFromModal(): void {
    if (
      !this.currentProfileData ||
      !this.selectedJob ||
      this.selectedJob === 'all'
    ) {
      alert('Please select a specific job to shortlist candidates');
      return;
    }

    this.candidatesService
      .toggleShortlist(this.currentProfileData.user_id, this.selectedJob)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && this.currentProfileData?.application) {
            this.currentProfileData.application.status = response.data
              .is_shortlisted
              ? 'shortlisted'
              : 'reviewed';

            const candidate = this.candidates.find(
              (c) => c.id === this.currentProfileData?.user_id
            );
            if (candidate) {
              candidate.is_shortlisted = response.data.is_shortlisted;
            }

            console.log('✅ Shortlist status updated');
          }
        },
        error: (error) => {
          console.error('❌ Error toggling shortlist:', error);
          alert('Failed to update shortlist status');
        },
      });
  }

  scheduleInterviewFromModal(): void {
    if (!this.currentProfileData) return;

    this.closeProfileModal();
    this.router.navigate(['/employer/schedule-interview'], {
      queryParams: {
        candidateId: this.currentProfileData.user_id,
        jobId: this.selectedJob === 'all' ? undefined : this.selectedJob,
      },
    });
  }

  hasSocialLinks(profile: CandidateProfile | null): boolean {
    if (!profile) return false;
    const links = profile.social_links;
    return !!(
      links.linkedin ||
      links.github ||
      links.portfolio ||
      links.website
    );
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ============================================
  // RATING HELPER METHODS
  // ============================================

  /**
   * Get star array for rating display (full, half, empty stars)
   */
  getStarArray(rating: number): number[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) stars.push(1);
    if (hasHalfStar && fullStars < 5) stars.push(0.5);
    
    const remaining = 5 - stars.length;
    for (let i = 0; i < remaining; i++) stars.push(0);
    
    return stars;
  }

  /**
   * Format rating date (e.g., "2 days ago", "3 weeks ago")
   */
  formatRatingDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  /**
   * Calculate rating percentage for distribution bar
   */
  getRatingPercentage(count: number, total: number): number {
    if (total === 0) return 0;
    return (count / total) * 100;
  }

  /**
   * Get initials from name (for avatars)
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
   * Check if candidate has ratings
   */
  hasRatings(candidate: Candidate): boolean {
    return (candidate.total_ratings ?? 0) > 0;
  }

  /**
   * Get rating badge class based on average rating
   */
  getRatingBadgeClass(rating: number): string {
    if (rating >= 4.5) return 'rating-excellent';
    if (rating >= 4.0) return 'rating-good';
    if (rating >= 3.0) return 'rating-fair';
    return 'rating-poor';
  }

  /**
   * Check if profile has skill ratings
   */
  hasSkillRatings(profile: CandidateProfile): boolean {
    if (!profile.rating_stats?.skill_ratings) return false;
    
    const skills = profile.rating_stats.skill_ratings;
    return !!(
      (skills.technical ?? 0) > 0 ||
      (skills.communication ?? 0) > 0 ||
      (skills.professionalism ?? 0) > 0 ||
      (skills.quality ?? 0) > 0 ||
      (skills.timeliness ?? 0) > 0
    );
  }

  // ============================================
  // DATA LOADING
  // ============================================

  loadEmployerTrainings(): void {
    const employerId = localStorage.getItem('userId');
    if (!employerId) {
      console.warn('⚠️ No employer ID found');
      return;
    }

    console.log('📚 Loading employer trainings...');

    this.trainingService
      .getMyTrainings(
        {
          status: 'published',
          limit: 100,
        },
        employerId
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.trainings) {
            this.availableTrainings = response.data.trainings;
            console.log(
              `✅ Loaded ${this.availableTrainings.length} trainings`
            );
          }
        },
        error: (error) => {
          console.error('❌ Error loading trainings:', error);
        },
      });
  }

  loadJobPosts(): void {
    console.log('📋 Loading job posts...');

    this.candidatesService
      .getJobPosts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.jobPosts = response.data;
            console.log('✅ Job posts loaded:', this.jobPosts.length);
            this.loadCandidates();
          }
        },
        error: (error) => {
          console.error('❌ Error loading job posts:', error);
          this.loadCandidates();
        },
      });
  }

  loadCandidates(): void {
    console.log('🔄 Loading candidates...');

    this.isLoading = true;
    this.lastRefreshTime = new Date();

    const query: CandidatesQuery = {
      job_id: this.selectedJob === 'all' ? undefined : this.selectedJob,
      match_score_min: this.skillsMatchFilter
        ? parseInt(this.skillsMatchFilter)
        : undefined,
      location: this.locationFilter || undefined,
      experience: this.experienceFilter || undefined,
      training: this.trainingFilter || undefined,
      sort_by: this.sortBy as any,
      page: this.currentPage,
      limit: this.itemsPerPage,
    };

    this.candidatesService
      .getCandidates(query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.candidates = Array.isArray(response.data.data)
              ? response.data.data
              : [];

            this.totalCandidates = response.data.pagination?.total || 0;
            this.totalPages = response.data.pagination?.total_pages || 1;
            this.currentPage = response.data.pagination?.page || 1;

            this.applyClientSideFilters();

            console.log('✅ Candidates loaded:', this.candidates.length);
          } else {
            this.resetCandidatesState();
          }
        },
        error: (error) => {
          console.error('❌ Error loading candidates:', error);
          this.resetCandidatesState();
        },
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
      filtered = filtered.filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(query) ||
          candidate.title.toLowerCase().includes(query) ||
          candidate.email?.toLowerCase().includes(query) ||
          (candidate.skills &&
            candidate.skills.some((skill) =>
              skill.toLowerCase().includes(query)
            )) ||
          (candidate.location &&
            candidate.location.toLowerCase().includes(query))
      );
    }

    this.filteredCandidates = filtered;
  }

  // ============================================
  // FILTER ACTIONS
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
  // SELECTION
  // ============================================

  toggleCandidateSelection(candidateId: string): void {
    const index = this.selectedCandidates.indexOf(candidateId);
    if (index > -1) {
      this.selectedCandidates.splice(index, 1);
    } else {
      this.selectedCandidates.push(candidateId);
    }

    const candidate = this.candidates.find((c) => c.id === candidateId);
    if (candidate) {
      candidate.is_selected = this.selectedCandidates.includes(candidateId);
    }

    this.showBatchActions = this.selectedCandidates.length > 0;
  }

  selectAllVisible(): void {
    this.filteredCandidates.forEach((candidate) => {
      if (!this.selectedCandidates.includes(candidate.id)) {
        this.selectedCandidates.push(candidate.id);
        candidate.is_selected = true;
      }
    });
    this.showBatchActions = true;
  }

  clearSelection(): void {
    this.selectedCandidates = [];
    this.candidates.forEach((c) => (c.is_selected = false));
    this.showBatchActions = false;
  }

  shortlistSelected(): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to shortlist candidates');
      return;
    }

    const promises = this.selectedCandidates.map((candidateId) =>
      this.candidatesService
        .toggleShortlist(candidateId, this.selectedJob)
        .toPromise()
    );

    Promise.all(promises)
      .then(() => {
        this.loadCandidates();
        this.clearSelection();
      })
      .catch((error) => {
        console.error('❌ Error in batch shortlist:', error);
        alert('Failed to shortlist some candidates');
      });
  }

  sendBulkInvites(): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to send invitations');
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
          alert('Invitations sent successfully!');
          this.clearSelection();
        },
        error: (error) => {
          console.error('❌ Error sending invites:', error);
          alert('Failed to send invitations');
        },
      });
  }

  // ============================================
  // CANDIDATE ACTIONS
  // ============================================

  toggleShortlist(candidate: Candidate): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job to shortlist candidates');
      return;
    }

    this.candidatesService
      .toggleShortlist(candidate.id, this.selectedJob)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            candidate.is_shortlisted = response.data.is_shortlisted;
          }
        },
        error: (error) => {
          console.error('❌ Error toggling shortlist:', error);
        },
      });
  }

  inviteToApply(candidateId: string): void {
    if (this.selectedJob === 'all') {
      alert('Please select a specific job');
      return;
    }

    const message =
      prompt('Enter invitation message:') || 'You have been invited to apply.';

    this.candidatesService
      .inviteCandidate(candidateId, this.selectedJob, message)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Invitation sent!');
        },
        error: (error) => {
          console.error('❌ Error sending invitation:', error);
          alert('Failed to send invitation');
        },
      });
  }

  startChat(candidateId: string): void {
    this.router.navigate(['/employer/messages'], {
      queryParams: { userId: candidateId },
    });
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

  // ============================================
  // UTILITY
  // ============================================

  getFullImageUrl(
    imagePath: string | null | undefined,
    candidateName: string
  ): string {
    if (!imagePath) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        candidateName
      )}&background=4285f4&color=fff&size=128`;
    }

    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }

    if (imagePath.startsWith('/uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath}`;
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      candidateName
    )}&background=4285f4&color=fff&size=128`;
  }

  handleImageError(event: any, candidateName: string): void {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      candidateName
    )}&background=4285f4&color=fff&size=128`;
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
    console.log('📥 Downloading report...');
  }

  toggleSelection(candidate: Candidate): void {
    this.toggleCandidateSelection(candidate.id);
  }

  promoteJob() {
    console.log('📢 Promoting job...');
  }

  refreshCandidates(): void {
    this.loadCandidates();
  }

  // ============================================
  // CHAT FUNCTIONS (Updated for mobile)
  // ============================================

  initializeChat(): void {
    this.chatMessages = [
      {
        type: 'ai',
        content:
          "👋 Hello! I'm your AI hiring assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ];
  }

  toggleChat(): void {
    if (this.isMobile) {
      this.toggleMobileChat();
    }
    this.isChatOpen = !this.isChatOpen;
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isChatLoading) return;

    const userMessage = this.currentMessage.trim();
    this.chatMessages.push({
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    this.currentMessage = '';
    this.isChatLoading = true;

    this.chatHistory.push({
      role: 'user',
      content: userMessage,
    });

    const job = this.jobPosts.find((j) => j.id === this.selectedJob);
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
          const aiMessage =
            response.message || "I couldn't process that request.";

          this.chatMessages.push({
            type: 'ai',
            content: aiMessage,
            timestamp: new Date(),
          });

          this.chatHistory.push({
            role: 'assistant',
            content: aiMessage,
          });

          this.isChatLoading = false;
        },
        error: (error) => {
          console.error('❌ Chat error:', error);
          this.chatMessages.push({
            type: 'ai',
            content: '❌ Error occurred. Please try again.',
            timestamp: new Date(),
          });
          this.isChatLoading = false;
        },
      });
  }

  askQuickQuestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }
}