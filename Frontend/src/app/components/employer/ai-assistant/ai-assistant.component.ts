// ai-assistant.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Candidate {
  id: string;
  name: string;
  title: string;
  profilePhoto: string;
  matchScore: number;
  skills: string[];
  certifications: string[];
  experience: string;
  industry: string;
}

interface Training {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  employabilityBoost: number;
  description: string;
  category: string;
}

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

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit {
  activeTab: 'candidates' | 'training' | 'insights' = 'candidates';
  
  // Filter properties
  selectedJobRole: string = '';
  selectedSkills: string = '';
  selectedExperience: string = '';
  selectedIndustry: string = '';

  // Data properties
  candidates: Candidate[] = [];
  trainings: Training[] = [];
  skillGaps: SkillGap[] = [];
  chatMessages: ChatMessage[] = [];
  
  // UI state
  isChatOpen: boolean = false;
  currentChatMessage: string = '';
  isLoading: boolean = false;
  
  // Filter options
  jobRoles: string[] = ['Software Engineer', 'Marketing Manager', 'Data Analyst', 'Product Manager', 'UX Designer'];
  skillOptions: string[] = ['JavaScript', 'Python', 'React', 'Angular', 'Node.js', 'Digital Marketing', 'Data Science'];
  experienceLevels: string[] = ['Entry Level', 'Mid Level', 'Senior Level', 'Executive'];
  industries: string[] = ['Technology', 'Healthcare', 'Finance', 'Education', 'E-commerce'];

  ngOnInit(): void {
    this.loadMockData();
    this.initializeChat();
  }

  loadMockData(): void {
    // Mock candidates data
    this.candidates = [
      {
        id: '1',
        name: 'Sarah Johnson',
        title: 'Frontend Developer',
        profilePhoto: 'assets/images/profile1.jpg',
        matchScore: 94,
        skills: ['React', 'TypeScript', 'CSS', 'JavaScript'],
        certifications: ['AWS Certified Developer', 'Google Analytics Certified'],
        experience: '3 years',
        industry: 'Technology'
      },
      {
        id: '2',
        name: 'Michael Chen',
        title: 'Full Stack Developer',
        profilePhoto: 'assets/images/profile2.jpg',
        matchScore: 87,
        skills: ['Angular', 'Node.js', 'MongoDB', 'Python'],
        certifications: ['Microsoft Azure Certified', 'Scrum Master Certified'],
        experience: '5 years',
        industry: 'Technology'
      },
      {
        id: '3',
        name: 'Emily Rodriguez',
        title: 'Digital Marketing Specialist',
        profilePhoto: 'assets/images/profile3.jpg',
        matchScore: 82,
        skills: ['SEO', 'Google Ads', 'Social Media Marketing', 'Analytics'],
        certifications: ['Google Ads Certified', 'HubSpot Certified'],
        experience: '2 years',
        industry: 'Marketing'
      }
    ];

    // Mock trainings data
    this.trainings = [
      {
        id: '1',
        title: 'Advanced React Development',
        provider: 'Meta',
        duration: '6 weeks',
        level: 'Advanced',
        employabilityBoost: 15,
        description: 'Master advanced React concepts and build production-ready applications',
        category: 'Frontend Development'
      },
      {
        id: '2',
        title: 'Digital Marketing Fundamentals',
        provider: 'Google',
        duration: '4 weeks',
        level: 'Beginner',
        employabilityBoost: 12,
        description: 'Learn the basics of digital marketing and online advertising',
        category: 'Marketing'
      },
      {
        id: '3',
        title: 'Data Science with Python',
        provider: 'IBM',
        duration: '8 weeks',
        level: 'Intermediate',
        employabilityBoost: 20,
        description: 'Comprehensive course on data science techniques and Python programming',
        category: 'Data Science'
      }
    ];

    // Mock skill gaps data
    this.skillGaps = [
      { skill: 'React', demandPercentage: 85, candidatesWithSkill: 45, totalCandidates: 100 },
      { skill: 'Python', demandPercentage: 78, candidatesWithSkill: 38, totalCandidates: 100 },
      { skill: 'AWS', demandPercentage: 70, candidatesWithSkill: 25, totalCandidates: 100 },
      { skill: 'Machine Learning', demandPercentage: 65, candidatesWithSkill: 20, totalCandidates: 100 },
      { skill: 'Digital Marketing', demandPercentage: 60, candidatesWithSkill: 35, totalCandidates: 100 }
    ];
  }

  initializeChat(): void {
    this.chatMessages = [
      {
        id: '1',
        message: 'Hello! I\'m your AI assistant. I can help you find the best candidates, recommend training programs, and provide insights about your talent pipeline. What would you like to know?',
        isUser: false,
        timestamp: new Date()
      }
    ];
  }

  setActiveTab(tab: 'candidates' | 'training' | 'insights'): void {
    this.activeTab = tab;
  }

  applyFilters(): void {
    this.isLoading = true;
    // Simulate API call
    setTimeout(() => {
      // Filter logic would go here
      this.isLoading = false;
    }, 1000);
  }

  clearFilters(): void {
    this.selectedJobRole = '';
    this.selectedSkills = '';
    this.selectedExperience = '';
    this.selectedIndustry = '';
    this.applyFilters();
  }

  viewProfile(candidateId: string): void {
    console.log('Viewing profile for candidate:', candidateId);
    // Navigate to candidate profile
  }

  inviteToApply(candidateId: string): void {
    console.log('Inviting candidate to apply:', candidateId);
    // Send invitation logic
  }

  messageCandidate(candidateId: string): void {
    console.log('Messaging candidate:', candidateId);
    // Open messaging interface
  }

  assignTraining(trainingId: string): void {
    console.log('Assigning training:', trainingId);
    // Open training assignment interface
  }

  explainRecommendation(type: string, id: string): void {
    const explanation = this.generateExplanation(type, id);
    this.addChatMessage(explanation, false);
    this.isChatOpen = true;
  }

  generateExplanation(type: string, id: string): string {
    if (type === 'candidate') {
      return `This candidate was recommended based on their skill match (94%), relevant experience, and validated certifications. They have strong proficiency in React and TypeScript, which align perfectly with your job requirements.`;
    } else if (type === 'training') {
      return `This training was recommended because 65% of your candidate pool lacks advanced React skills, which are required for 85% of your job postings. Completing this training would increase candidate employability by 15%.`;
    }
    return 'Recommendation explanation not available.';
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
  }

  sendChatMessage(): void {
    if (this.currentChatMessage.trim()) {
      this.addChatMessage(this.currentChatMessage, true);
      const userMessage = this.currentChatMessage;
      this.currentChatMessage = '';
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse = this.generateAIResponse(userMessage);
        this.addChatMessage(aiResponse, false);
      }, 1000);
    }
  }

  addChatMessage(message: string, isUser: boolean): void {
    this.chatMessages.push({
      id: Date.now().toString(),
      message,
      isUser,
      timestamp: new Date()
    });
  }

  generateAIResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('marketing manager') || lowerMessage.includes('marketing')) {
      return 'For Marketing Manager roles, I recommend focusing on candidates with digital marketing experience, Google Ads certification, and analytics skills. Would you like me to show you the top 3 candidates?';
    } else if (lowerMessage.includes('data analyst') || lowerMessage.includes('data')) {
      return 'For Data Analyst positions, Python and SQL skills are critical. I recommend the "Data Science with Python" course which could boost your candidate pool by 20%. Should I show you candidates who would benefit from this training?';
    } else if (lowerMessage.includes('training') || lowerMessage.includes('upskill')) {
      return 'Based on your job postings, I recommend focusing on React, Python, and AWS training programs. These address the biggest skill gaps in your candidate pipeline. Would you like specific course recommendations?';
    } else {
      return 'I can help you with candidate recommendations, training suggestions, and talent insights. Try asking about specific roles like "Show me candidates for Software Engineer" or "What training should I recommend for my pipeline?"';
    }
  }

  onChatKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

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
    return Math.round((skillGap.candidatesWithSkill / skillGap.totalCandidates) * 100);
  }

  getGapSeverity(percentage: number): string {
    if (percentage < 30) return 'severe';
    if (percentage < 60) return 'moderate';
    return 'low';
  }
}