import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
interface Candidate {
  id: number;
  name: string;
  title: string;
  profilePicture: string;
  matchScore: number;
  skills: string[];
  certifications: Certification[];
  experience: string;
  location: string;
  availability: string;
  lastActive: string;
  recentWork: string;
  isShortlisted: boolean;
  isSelected: boolean;
}

interface Certification {
  name: string;
  verified: boolean;
  progress: number;
}

interface JobPost {
  id: number;
  title: string;
  matchCount: number;
}

interface AIInsight {
  reason: string;
  skillOverlap: string[];
  experienceRelevance: string;
  trainingMatch: string;
}

@Component({
  selector: 'app-candidates',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './candidates.component.html',
  styleUrls: ['./candidates.component.css']
})
export class CandidatesComponent implements OnInit {
  selectedJob: number = 1;
  jobPosts: JobPost[] = [
    { id: 1, title: 'Backend Developer', matchCount: 15 },
    { id: 2, title: 'Frontend Developer', matchCount: 8 },
    { id: 3, title: 'Full-Stack Developer', matchCount: 12 }
  ];

  viewMode: 'grid' | 'list' = 'grid';
  searchQuery = '';
  skillsMatchFilter = '';
  locationFilter = '';
  experienceFilter = '';
  trainingFilter = '';
  sortBy = 'bestMatch';

  selectedCandidates: number[] = [];
  // showComparison = false; // Removed duplicate declaration
  showBatchActions = false;

  // AI Insights
  currentInsight: AIInsight | null = null;
  
  // Chatbot
  isChatOpen = false;
  currentMessage = '';

  candidates: Candidate[] = [
    {
      id: 1,
      name: 'Jane Mwangi',
      profilePicture: 'https://images.unsplash.com/photo-1494790108755-2616b96fb53d?w=100&h=100&fit=crop&crop=face',
      matchScore: 92,
      skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs', 'JavaScript'],
      certifications: [
        { name: 'Backend Development Certification', verified: true, progress: 100 },
        { name: 'Database Management', verified: true, progress: 100 }
      ],
      experience: '4 years in Backend Development',
      location: 'Nairobi, Kenya',
      availability: 'Available immediately',
      isShortlisted: false,
      isSelected: false,
      title: 'Backend Developer',
      lastActive: '2 hours ago',
      recentWork: 'Senior Backend Developer at TechStart'
    },
    {
      id: 2,
      name: 'David Kimani',
      profilePicture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
      matchScore: 87,
      skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'AWS'],
      certifications: [
        { name: 'Python Backend Specialist', verified: true, progress: 100 },
        { name: 'Cloud Architecture', verified: false, progress: 75 }
      ],
      experience: '5 years in Full-Stack Development',
      location: 'Mombasa, Kenya',
      availability: '2 weeks notice',
      isShortlisted: true,
      isSelected: false,
      title: 'Full-Stack Developer',
      lastActive: '1 day ago',
      recentWork: 'Lead Developer at InnovateKenya'
    },
    {
      id: 3,
      name: 'Sarah Wanjiku',
      profilePicture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      matchScore: 84,
      skills: ['Java', 'Spring Boot', 'MySQL', 'Microservices', 'Git'],
      certifications: [
        { name: 'Java Enterprise Development', verified: true, progress: 100 }
      ],
      experience: '3 years in Backend Development',
      location: 'Kisumu, Kenya',
      availability: '1 month notice',
      isShortlisted: false,
      isSelected: false,
      title: 'Backend Developer',
      lastActive: '3 hours ago',
      recentWork: 'Backend Developer at DataSolutions'
    },
    {
      id: 4,
      name: 'Michael Ochieng',
      profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      matchScore: 89,
      skills: ['Node.js', 'GraphQL', 'Redis', 'Docker', 'TypeScript'],
      certifications: [
        { name: 'Advanced Backend Architecture', verified: true, progress: 100 },
        { name: 'DevOps Fundamentals', verified: true, progress: 100 }
      ],
      experience: '6 years in Backend Development',
      location: 'Eldoret, Kenya',
      availability: 'Available immediately',
      isShortlisted: false,
      isSelected: false,
      title: 'Senior Backend Developer',
      lastActive: '30 minutes ago',
      recentWork: 'Tech Lead at ScaleUp Solutions'
    },
    {
      id: 5,
      name: 'Grace Nyong',
      profilePicture: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face',
      matchScore: 76,
      skills: ['PHP', 'Laravel', 'MySQL', 'Vue.js', 'API Development'],
      certifications: [
        { name: 'Full-Stack PHP Development', verified: false, progress: 90 }
      ],
      experience: '2 years in Web Development',
      location: 'Nakuru, Kenya',
      availability: '3 weeks notice',
      isShortlisted: false,
      isSelected: false,
      title: 'PHP Developer',
      lastActive: '5 hours ago',
      recentWork: 'Junior Developer at WebCraft'
    }
  ];

  filteredCandidates: Candidate[] = [];
  // Filter and sort options
  skillFilter = '';
  certificationFilter = '';
  
  // AI Chat
  chatMessages: { type: 'user' | 'ai'; content: string }[] = [
    { type: 'ai', content: 'Hello! I can help you understand candidate matches. Ask me anything about these candidates!' }
  ];

  // Pagination
  currentPage = 1;
  itemsPerPage = 6;
  
  // Comparison modal
  showComparison = false;
Math: any;

  ngOnInit() {
    this.filteredCandidates = [...this.candidates];
    this.sortCandidates();
  }

  // Filter methods
  applyFilters() {
    this.filteredCandidates = this.candidates.filter(candidate => {
      const matchesSearch = !this.searchQuery || 
        candidate.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        candidate.skills.some(skill => skill.toLowerCase().includes(this.searchQuery.toLowerCase()));
      
      const matchesSkillsMatch = !this.skillsMatchFilter || candidate.matchScore >= parseInt(this.skillsMatchFilter);
      const matchesLocation = !this.locationFilter || candidate.location.toLowerCase().includes(this.locationFilter.toLowerCase());
      const matchesExperience = !this.experienceFilter || candidate.experience.toLowerCase().includes(this.experienceFilter.toLowerCase());
      const matchesTraining = !this.trainingFilter || candidate.certifications.some(cert => 
        cert.name.toLowerCase().includes(this.trainingFilter.toLowerCase()) && cert.verified
      );
      
      return matchesSearch && matchesSkillsMatch && matchesLocation && matchesExperience && matchesTraining;
    });
    this.sortCandidates();
    this.currentPage = 1;
  }

  clearFilters() {
    this.searchQuery = '';
    this.skillsMatchFilter = '';
    this.locationFilter = '';
    this.experienceFilter = '';
    this.trainingFilter = '';
    this.filteredCandidates = [...this.candidates];
    this.sortCandidates();
  }

  sortCandidates() {
    this.filteredCandidates.sort((a, b) => {
      switch (this.sortBy) {
        case 'bestMatch':
          return b.matchScore - a.matchScore;
        case 'mostExperienced':
          return parseInt(b.experience) - parseInt(a.experience);
        case 'recentlyActive':
          return this.compareLastActive(a.lastActive, b.lastActive);
        default:
          return 0;
      }
    });
  }

  compareLastActive(a: string, b: string): number {
    // Simple comparison - in real app, would parse actual timestamps
    if (a.includes('minutes')) return -1;
    if (b.includes('minutes')) return 1;
    if (a.includes('hours') && b.includes('day')) return -1;
    if (b.includes('hours') && a.includes('day')) return 1;
    return 0;
  }

  onJobChange() {
    // Simulate fetching candidates for different job
    this.applyFilters();
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  // Selection methods
  toggleCandidateSelection(candidateId: number) {
    const index = this.selectedCandidates.indexOf(candidateId);
    if (index > -1) {
      this.selectedCandidates.splice(index, 1);
    } else {
      this.selectedCandidates.push(candidateId);
    }
    this.showBatchActions = this.selectedCandidates.length > 0;
    
    // Update candidate selection status
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (candidate) {
      candidate.isSelected = this.selectedCandidates.includes(candidateId);
    }
  }

  selectAllVisible() {
    this.paginatedCandidates.forEach(candidate => {
      if (!this.selectedCandidates.includes(candidate.id)) {
        this.selectedCandidates.push(candidate.id);
        candidate.isSelected = true;
      }
    });
    this.showBatchActions = true;
  }

  clearSelection() {
    this.selectedCandidates = [];
    this.candidates.forEach(c => c.isSelected = false);
    this.showBatchActions = false;
  }

  // Batch actions
  shortlistSelected() {
    this.selectedCandidates.forEach(id => {
      const candidate = this.candidates.find(c => c.id === id);
      if (candidate) candidate.isShortlisted = true;
    });
    this.clearSelection();
  }

  sendBulkInvites() {
    console.log('Sending bulk invites to:', this.selectedCandidates);
    // Implement bulk invite functionality
    this.clearSelection();
  }

  // Individual actions
  viewFullProfile(candidateId: number) {
    console.log('Viewing full profile for candidate:', candidateId);
    // Navigate to candidate profile
  }

  inviteToApply(candidateId: number) {
    console.log('Inviting candidate to apply:', candidateId);
    // Send invitation
  }

  startChat(candidateId: number) {
    console.log('Starting chat with candidate:', candidateId);
    // Open chat interface
  }

  showAIInsights(candidate: Candidate) {
    this.currentInsight = {
      reason: `High match due to strong ${candidate.skills.slice(0, 2).join(' and ')} skills`,
      skillOverlap: candidate.skills.slice(0, 3),
      experienceRelevance: `${candidate.experience} aligns perfectly with job requirements`,
      trainingMatch: candidate.certifications.length > 0 ? candidate.certifications[0].name : 'No specific training match'
    };
  }

  hideAIInsights() {
    this.currentInsight = null;
  }

  // Candidate actions
  toggleShortlist(candidate: Candidate) {
    candidate.isShortlisted = !candidate.isShortlisted;
  }

  toggleSelection(candidate: Candidate) {
    candidate.isSelected = !candidate.isSelected;
    if (candidate.isSelected) {
      if (!this.selectedCandidates.includes(candidate.id)) {
        this.selectedCandidates.push(candidate.id);
      }
    } else {
      this.selectedCandidates = this.selectedCandidates.filter(id => id !== candidate.id);
    }
  }

  requestInterview(candidateId: number) {
    console.log('Requesting interview with candidate:', candidateId);
    // Open interview scheduling modal
  }

  // Comparison
  openComparison() {
    if (this.selectedCandidates.length >= 2) {
      this.showComparison = true;
    }
  }

  closeComparison() {
    this.showComparison = false;
  }

  // AI Chat
  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
  }

  sendMessage() {
    if (this.currentMessage.trim()) {
      this.chatMessages.push({ type: 'user', content: this.currentMessage });
      
      // Simulate AI response
      setTimeout(() => {
        this.generateAIResponse(this.currentMessage);
      }, 1000);
      
      this.currentMessage = '';
    }
  }

  generateAIResponse(message: string) {
    let response = '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('top 5') || lowerMessage.includes('best matches')) {
      response = `Based on the Backend Developer role, your top 5 matches are: Jane Mwangi (92%), Michael Ochieng (89%), David Kimani (87%), Sarah Wanjiku (84%), and Grace Nyong (76%). Jane and Michael have the strongest Node.js and backend architecture skills.`;
    } else if (lowerMessage.includes('completed training') || lowerMessage.includes('certified')) {
      const certifiedCandidates = this.candidates.filter(c => c.certifications.some(cert => cert.verified));
      response = `${certifiedCandidates.length} candidates have completed training: ${certifiedCandidates.map(c => c.name).join(', ')}. They have verified certifications in backend development, database management, and cloud architecture.`;
    } else if (lowerMessage.includes('70%') || lowerMessage.includes('match')) {
      const highMatches = this.candidates.filter(c => c.matchScore >= 70);
      response = `${highMatches.length} candidates have 70%+ match scores. The highest matches are Jane Mwangi (92%) and Michael Ochieng (89%) - both have strong backend skills and relevant experience.`;
    } else if (lowerMessage.includes('available') || lowerMessage.includes('immediate')) {
      const available = this.candidates.filter(c => c.availability.includes('immediately'));
      response = `${available.length} candidates are available immediately: ${available.map(c => c.name).join(', ')}. Perfect for urgent hiring needs!`;
    } else {
      response = 'I can help you find the best candidates! Try asking: "Who are the top 5 matches?" or "Show only candidates who completed training" or "Who has 80%+ match scores?"';
    }
    
    this.chatMessages.push({ type: 'ai', content: response });
  }

  // Pagination
  get paginatedCandidates() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCandidates.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredCandidates.length / this.itemsPerPage);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Export
  downloadReport() {
    console.log('Downloading candidate report...');
    // Implement export functionality
  }

  getMatchScoreClass(score: number): string {
    if (score >= 90) return 'match-excellent';
    if (score >= 80) return 'match-good';
    if (score >= 70) return 'match-fair';
    return 'match-low';
  }

  getConfidenceClass(confidence: string): string {
    return `confidence-${confidence.toLowerCase()}`;
  }
}