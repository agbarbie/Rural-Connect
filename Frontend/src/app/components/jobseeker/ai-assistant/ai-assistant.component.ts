import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { ProfileService, PortfolioData } from '../../../../../services/profile.service';
import { AuthService } from '../../../../../services/auth.service';
import { GeminiChatService } from '../../../../../services/gemini-chat.service';
import { environment } from '../../../../environments/environments';

interface JobRecommendation {
  id: string;
  title: string;
  company: string;
  logo: string;
  salary: string;
  location?: string;
  description?: string;
  skills: Array<{
    name: string;
    status: 'matched' | 'partial' | 'missing';
  }>;
  applied: boolean;
  saved: boolean;
  matchScore?: number;
}

interface TrainingRecommendation {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: string;
  description: string;
  icon: string;
  enrolled: boolean;
}

interface SkillProgress {
  name: string;
  current: number;
  change: number;
  note: string;
}

interface Deadline {
  id: string;
  title: string;
  type: 'job' | 'training' | 'meeting';
  dueDate: Date;
  company: string;
  urgent: boolean;
}

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  cards?: any[];
  recommendations?: any;
}

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.component.html',
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit, AfterViewInit {
  @ViewChild('skillsChart', { static: false }) skillsChart!: ElementRef<HTMLCanvasElement>;
  userMessage: string = '';
  selectedSkill: string = '';
  isLoading: boolean = false;
  isInitializing: boolean = true;
  isLoadingInsights: boolean = false;
  showPremiumModal: boolean = false;
  portfolioData: PortfolioData | null = null;
  lastInitTime: string | null = null;
  
  userData = {
    name: 'User',
    avatar: 'assets/images/profile-placeholder.jpg',
    topSkills: [] as Array<{ name: string; level: string }>
  };
  jobRecommendations: JobRecommendation[] = [];
  trainingRecommendations: TrainingRecommendation[] = [];
  skillsProgress: SkillProgress[] = [];
  conversationMessages: ChatMessage[] = [];
  deadlines: Deadline[] = [];
  skillsChartData = {
    labels: [] as string[],
    userSkills: [] as number[],
    marketDemand: [] as number[]
  };

  constructor(
    private router: Router,
    private profileService: ProfileService,
    private authService: AuthService,
    private geminiService: GeminiChatService
  ) { }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeSkillsChart();
    }, 500);
  }

  loadUserProfile(): void {
    this.isInitializing = true;
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.name) {
      this.userData.name = currentUser.name;
    }
    
    // Optionally cache profile in localStorage for faster subsequent loads
    const cachedProfile = localStorage.getItem('cached_portfolio');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        this.portfolioData = parsed;
        this.populateUserDataFromPortfolio(parsed);
        // Proceed to check for updates
        this.checkForProfileUpdates();
        return;
      } catch (e) {
        console.warn('Cached profile invalid, loading fresh');
      }
    }
    
    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.portfolioData = response.data;
          // Cache the profile
          localStorage.setItem('cached_portfolio', JSON.stringify(response.data));
          this.populateUserDataFromPortfolio(response.data);
          this.checkForProfileUpdates();
        } else {
          this.useDefaultData();
          this.finishInitialization();
        }
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        this.useDefaultData();
        this.finishInitialization();
      }
    });
  }

  private checkForProfileUpdates(): void {
    // Assume portfolio.cvData.updated_at exists; adjust if different
    const profileUpdatedAt = this.portfolioData?.cvData?.updated_at || this.portfolioData?.updatedAt || new Date().toISOString();
    this.lastInitTime = localStorage.getItem('ai_assistant_last_init');

    if (!this.lastInitTime || new Date(profileUpdatedAt) > new Date(this.lastInitTime)) {
      // Profile updated or first time, load insights in background
      this.loadInsightsInBackground(profileUpdatedAt);
    } else {
      // Use cached insights if available, or skip
      this.loadCachedInsights();
    }
    
    this.finishInitialization();
  }

  private async loadInsightsInBackground(updatedAt?: string): Promise<void> {
    this.isLoadingInsights = true;
    try {
      // Get initial career recommendations from Gemini
      const response = await this.geminiService.getInitialRecommendations().toPromise();
      
      if (response?.success) {
        // Clear previous recommendations
        this.jobRecommendations = [];
        this.trainingRecommendations = [];
        this.conversationMessages = [];

        // Map Gemini job recommendations to frontend format
        if (response.recommendations?.matchedJobs) {
          this.jobRecommendations = response.recommendations.matchedJobs.map(job =>
            this.mapGeminiJobToFrontend(job)
          );
        }
        // Generate training recommendations based on skill gaps
        if (response.recommendations?.skillGaps) {
          this.trainingRecommendations = this.generateTrainingFromSkillGaps(
            response.recommendations.skillGaps,
            response.recommendations.learningPaths || []
          );
        }
        // Add initial AI message with recommendations - Updated text for better engagement
        if (response.message) {
          this.conversationMessages.push({
            type: 'ai',
            content: response.message + '<br><br><strong>Ready to dive deeper?</strong> Ask me about specific roles, salary insights, or skill upgrades!',
            timestamp: new Date(),
            recommendations: response.recommendations
          });
        }

        // Update last init time
        if (updatedAt) {
          localStorage.setItem('ai_assistant_last_init', updatedAt);
        }

        // Cache insights
        localStorage.setItem('cached_insights', JSON.stringify({
          jobRecommendations: this.jobRecommendations,
          trainingRecommendations: this.trainingRecommendations,
          conversationMessages: this.conversationMessages
        }));
      }
    } catch (error) {
      console.error('Error getting Gemini recommendations:', error);
      // Fallback to static recommendations if Gemini fails
      this.generateStaticRecommendations();
    } finally {
      this.isLoadingInsights = false;
    }
  }

  private loadCachedInsights(): void {
    const cachedInsights = localStorage.getItem('cached_insights');
    if (cachedInsights) {
      try {
        const parsed = JSON.parse(cachedInsights);
        this.jobRecommendations = parsed.jobRecommendations || [];
        this.trainingRecommendations = parsed.trainingRecommendations || [];
        this.conversationMessages = parsed.conversationMessages || [];
      } catch (e) {
        console.warn('Cached insights invalid, skipping');
      }
    }
  }

  private finishInitialization(): void {
    this.isInitializing = false;
  }

  refreshInsights(): void {
    if (this.isLoading || this.isLoadingInsights) return;
    // Force refresh by clearing cache and reloading
    localStorage.removeItem('ai_assistant_last_init');
    localStorage.removeItem('cached_insights');
    this.conversationMessages = [];
    this.jobRecommendations = [];
    this.trainingRecommendations = [];
    this.loadInsightsInBackground(new Date().toISOString());
  }

  private mapGeminiJobToFrontend(geminiJob: any): JobRecommendation {
    const userSkills = this.userData.topSkills.map(s => s.name.toLowerCase());
    const requiredSkills = geminiJob.required_skills || [];
    
    return {
      id: geminiJob.id,
      title: geminiJob.title,
      company: geminiJob.company,
      logo: this.getCompanyIcon(geminiJob.company),
      salary: this.formatSalary(geminiJob.salary_min, geminiJob.salary_max),
      location: geminiJob.location || 'Nairobi, KE',
      description: geminiJob.description || 'A dynamic role where you can apply your skills to real-world challenges.',
      skills: requiredSkills.slice(0, 4).map((skill: string) => ({
        name: this.capitalizeSkill(skill),
        status: this.getSkillMatchStatus(skill, userSkills)
      })),
      applied: false,
      saved: false,
      matchScore: geminiJob.matchScore
    };
  }

  private getSkillMatchStatus(skill: string, userSkills: string[]): 'matched' | 'partial' | 'missing' {
    const skillLower = skill.toLowerCase();
    const hasExactMatch = userSkills.some(us => us === skillLower);
    const hasPartialMatch = userSkills.some(us =>
      us.includes(skillLower) || skillLower.includes(us)
    );
    
    if (hasExactMatch) return 'matched';
    if (hasPartialMatch) return 'partial';
    return 'missing';
  }

  private formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return 'Competitive Salary';
    if (min && max) return `KSh ${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `KSh ${min.toLocaleString()}+`;
    return `Up to KSh ${max?.toLocaleString()}`;
  }

  private getCompanyIcon(companyName: string): string {
    const iconMap: { [key: string]: string } = {
      'microsoft': 'fab fa-microsoft',
      'google': 'fab fa-google',
      'amazon': 'fab fa-amazon',
      'safaricom': 'fas fa-building',
      'andela': 'fas fa-code',
      'twiga': 'fas fa-laptop-code'
    };
    
    const key = companyName.toLowerCase();
    for (const [name, icon] of Object.entries(iconMap)) {
      if (key.includes(name)) return icon;
    }
    return 'fas fa-building';
  }

  private generateTrainingFromSkillGaps(
    skillGaps: string[],
    learningPaths: string[]
  ): TrainingRecommendation[] {
    return skillGaps.slice(0, 3).map((skill, idx) => ({
      id: `training-${idx}`,
      title: `Master ${this.capitalizeSkill(skill)} Fundamentals`,
      provider: this.getTrainingProvider(skill),
      duration: '4-8 weeks',
      level: 'Intermediate',
      description: `${learningPaths[idx] || 'Hands-on projects and expert guidance to bridge your skill gap and unlock senior roles.'} Ideal for advancing your career in tech.`,
      icon: this.getSkillIcon(skill),
      enrolled: false
    }));
  }

  private getTrainingProvider(skill: string): string {
    const providers = [
      'Coursera • Google',
      'Udemy • Industry Experts',
      'LinkedIn Learning',
      'Pluralsight',
      'edX • MIT'
    ];
    return providers[Math.floor(Math.random() * providers.length)];
  }

  private getSkillIcon(skill: string): string {
    const iconMap: { [key: string]: string } = {
      'python': 'fab fa-python',
      'javascript': 'fab fa-js',
      'react': 'fab fa-react',
      'angular': 'fab fa-angular',
      'node': 'fab fa-node-js',
      'docker': 'fab fa-docker',
      'aws': 'fab fa-aws'
    };
    
    const skillLower = skill.toLowerCase();
    for (const [name, icon] of Object.entries(iconMap)) {
      if (skillLower.includes(name)) return icon;
    }
    return 'fas fa-graduation-cap';
  }

  private generateStaticRecommendations(): void {
    const cvData = this.portfolioData?.cvData;
    const userSkills = cvData?.skills?.map(s => s.skill_name.toLowerCase()) || [];
    this.jobRecommendations = this.getJobRecommendationsBasedOnSkills(userSkills);
    this.trainingRecommendations = this.getTrainingRecommendationsBasedOnGaps(userSkills);
  }

  private populateUserDataFromPortfolio(portfolio: PortfolioData): void {
    const cvData = portfolio.cvData;
    const personalInfo = cvData.personal_info || cvData.personal_info;
    if (personalInfo) {
      this.userData.name = personalInfo.full_name ||
                          personalInfo.full_name ||
                          personalInfo.name ||
                          'User';
      
      const profileImage = personalInfo.profile_image ||
                          personalInfo.profile_image ||
                          personalInfo.image;
      if (profileImage) {
        this.userData.avatar = this.getFullImageUrl(profileImage);
      }
    }
    if (cvData.skills && cvData.skills.length > 0) {
      const sortedSkills = [...cvData.skills].sort((a, b) => {
        const levelOrder = { 'Expert': 4, 'Advanced': 3, 'Intermediate': 2, 'Beginner': 1 };
        const aLevel = levelOrder[a.proficiency_level as keyof typeof levelOrder] || 0;
        const bLevel = levelOrder[b.proficiency_level as keyof typeof levelOrder] || 0;
        return bLevel - aLevel;
      });
      this.userData.topSkills = sortedSkills.slice(0, 3).map(skill => ({
        name: skill.skill_name,
        level: this.mapSkillLevel(skill.proficiency_level)
      }));
      const topSkillsForChart = sortedSkills.slice(0, 6);
      this.skillsChartData.labels = topSkillsForChart.map(s => s.skill_name);
      this.skillsChartData.userSkills = topSkillsForChart.map(s => this.getProficiencyNumber(s.proficiency_level));
      this.skillsChartData.marketDemand = topSkillsForChart.map(() => Math.floor(Math.random() * 30) + 70);
      this.skillsProgress = sortedSkills.slice(0, 3).map(skill => ({
        name: skill.skill_name,
        current: this.getProficiencyNumber(skill.proficiency_level),
        change: Math.floor(Math.random() * 20) + 5,
        note: `${skill.category || 'Core'} skill - Keep building!`
      }));
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.userMessage.trim() || this.isLoading) return;
    const message = this.userMessage.trim();
    
    this.conversationMessages.push({
      type: 'user',
      content: message,
      timestamp: new Date()
    });
    this.userMessage = '';
    this.isLoading = true;
    try {
      // Send message to Gemini service
      const response = await this.geminiService.sendMessage(
        message,
        this.conversationMessages.filter(m => m.type !== 'user' || m.content)
          .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }))
      ).toPromise();
      if (response?.success) {
        const aiMessage: ChatMessage = {
          type: 'ai',
          content: response.message + '<br><br><em>Pro Tip:</em> Refine your query for even better results, like adding location or salary preferences!',
          timestamp: new Date()
        };
        // Add job cards if recommendations include matched jobs
        if (response.recommendations?.matchedJobs && response.recommendations.matchedJobs.length > 0) {
          aiMessage.cards = response.recommendations.matchedJobs
            .slice(0, 3)  // Show up to 3 for explorer-like feel
            .map(job => this.mapGeminiJobToFrontend(job));
        }
        // Add training cards if skill gaps are mentioned
        if (response.recommendations?.skillGaps && response.recommendations.skillGaps.length > 0) {
          const trainingCards = this.generateTrainingFromSkillGaps(
            response.recommendations.skillGaps.slice(0, 2),
            response.recommendations.learningPaths || []
          );
          
          if (!aiMessage.cards) {
            aiMessage.cards = trainingCards;
          } else if (aiMessage.cards.length < 3) {
            // Append if space
            aiMessage.cards = [...aiMessage.cards, ...trainingCards.slice(0, 3 - aiMessage.cards.length)];
          }
        }
        this.conversationMessages.push(aiMessage);
        
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      
      // Fallback response with better text
      this.conversationMessages.push({
        type: 'ai',
        content: "Oops, a momentary glitch! I'm back online. Try rephrasing your question or ask about 'top Python jobs in Nairobi' for quick wins.",
        timestamp: new Date()
      });
    } finally {
      this.isLoading = false;
    }
  }

  scrollToBottom(): void {
    const conversationArea = document.querySelector('.conversation-area');
    if (conversationArea) {
      conversationArea.scrollTop = conversationArea.scrollHeight;
    }
  }

  // Helper methods
  private useDefaultData(): void {
    this.userData = {
      name: 'User',
      avatar: 'assets/images/profile-placeholder.jpg',
      topSkills: [{ name: 'General Skills', level: 'medium' }]
    };
  }

  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/images/profile-placeholder.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }
    
    return imagePath;
  }

  handleImageError(event: any): void {
    event.target.src = 'assets/images/profile-placeholder.jpg';
  }

  private mapSkillLevel(proficiency?: string): string {
    if (!proficiency) return 'medium';
    
    switch(proficiency.toLowerCase()) {
      case 'expert':
      case 'advanced': return 'high';
      case 'intermediate': return 'medium';
      case 'beginner':
      case 'basic': return 'low';
      default: return 'medium';
    }
  }

  private getProficiencyNumber(proficiency?: string): number {
    if (!proficiency) return 50;
    
    switch(proficiency.toLowerCase()) {
      case 'expert': return 95;
      case 'advanced': return 80;
      case 'intermediate': return 60;
      case 'beginner': return 30;
      case 'basic': return 20;
      default: return 50;
    }
  }

  private capitalizeSkill(skill: string): string {
    return skill.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Legacy methods for fallback
  private getJobRecommendationsBasedOnSkills(userSkills: string[]): JobRecommendation[] {
    const jobDatabase = [
      {
        id: '1',
        title: 'Senior Data Analyst',
        company: 'Microsoft Kenya',
        logo: 'fab fa-microsoft',
        salary: 'KSh 180,000 - 250,000',
        location: 'Nairobi',
        description: 'Analyze complex datasets to drive business decisions.',
        requiredSkills: ['sql', 'data analysis', 'python', 'r', 'statistics']
      },
      {
        id: '2',
        title: 'UI/UX Designer',
        company: 'Google Africa',
        logo: 'fab fa-google',
        salary: 'KSh 200,000 - 300,000',
        location: 'Nairobi',
        description: 'Design intuitive interfaces for global users.',
        requiredSkills: ['ui/ux', 'figma', 'design', 'react', 'angular']
      },
      {
        id: '3',
        title: 'Frontend Developer',
        company: 'Safaricom PLC',
        logo: 'fas fa-building',
        salary: 'KSh 150,000 - 220,000',
        location: 'Nairobi',
        description: 'Build responsive web apps with modern frameworks.',
        requiredSkills: ['html', 'css', 'javascript', 'react', 'node.js']
      }
    ];
    return jobDatabase.map(job => {
      const skills = job.requiredSkills.map(skill => {
        const hasSkill = userSkills.some(userSkill =>
          userSkill.includes(skill) || skill.includes(userSkill)
        );
        
        return {
          name: this.capitalizeSkill(skill),
          status: hasSkill ? 'matched' as const : 'missing' as const
        };
      }).slice(0, 4);
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        logo: job.logo,
        salary: job.salary,
        location: job.location,
        description: job.description,
        skills: skills,
        applied: false,
        saved: false
      };
    });
  }

  private getTrainingRecommendationsBasedOnGaps(userSkills: string[]): TrainingRecommendation[] {
    const trainingDatabase = [
      {
        id: '1',
        title: 'Python for Data Analysis',
        provider: 'Coursera • Google',
        duration: '6 weeks',
        level: 'Intermediate',
        description: 'Master Python libraries like Pandas and NumPy for data manipulation.',
        icon: 'fab fa-python',
        relatedSkills: ['python', 'data analysis']
      },
      {
        id: '2',
        title: 'Angular for Frontend Developers',
        provider: 'Udemy',
        duration: '4 weeks',
        level: 'Intermediate',
        description: 'Build scalable apps with Angular\'s component-based architecture.',
        icon: 'fab fa-angular',
        relatedSkills: ['angular', 'frontend']
      }
    ];
    return trainingDatabase
      .filter(training => {
        const hasRelatedSkill = training.relatedSkills.some(skill =>
          userSkills.some(userSkill => userSkill.includes(skill))
        );
        return !hasRelatedSkill;
      })
      .map(training => ({
        id: training.id,
        title: training.title,
        provider: training.provider,
        duration: training.duration,
        level: training.level,
        description: training.description,
        icon: training.icon,
        enrolled: false
      }));
  }

  initializeSkillsChart(): void {
    if (!this.skillsChart || this.skillsChartData.labels.length === 0) return;
    const canvas = this.skillsChart.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }
    const numPoints = this.skillsChartData.labels.length;
    const angleStep = (2 * Math.PI) / numPoints;
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      const labelX = centerX + (radius + 20) * Math.cos(angle);
      const labelY = centerY + (radius + 20) * Math.sin(angle);
      ctx.fillText(this.skillsChartData.labels[i], labelX, labelY);
    }
    ctx.beginPath();
    ctx.strokeStyle = '#667eea';
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = this.skillsChartData.userSkills[i];
      const distance = (value / 100) * radius;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 0; i < numPoints; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const value = this.skillsChartData.marketDemand[i];
      const distance = (value / 100) * radius;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // UI interaction methods
  showJobs(): void {
    this.router.navigate(['/jobseeker/job-explorer']);
  }

  showTraining(): void {
    this.router.navigate(['/jobseeker/training']);
  }

  showInsights(): void {
    this.sendMessage();
    this.userMessage = 'Provide detailed career insights and market trends for my profile';
  }

  showSkillPlan(): void {
    this.sendMessage();
    this.userMessage = 'Generate a 6-month skill development plan with milestones';
  }

  applyToJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.applied = true;
    }
  }

  saveJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.saved = !job.saved;
    }
  }

  enrollInTraining(trainingId: string): void {
    const training = this.trainingRecommendations.find(t => t.id === trainingId);
    if (training) {
      training.enrolled = true;
    }
  }

  isJobCards(cards: any[]): boolean {
    return cards.length > 0 && cards[0].hasOwnProperty('company');
  }

  isTrainingCards(cards: any[]): boolean {
    return cards.length > 0 && cards[0].hasOwnProperty('provider');
  }

  getProgressChangeClass(change: number): string {
    if (change > 10) return 'progress-change positive';
    if (change > 0) return 'progress-change neutral';
    return 'progress-change negative';
  }

  onSimulate(): void {
    if (this.selectedSkill) {
      this.showPremiumModal = true;
    }
  }

  subscribeToPremium(): void {
    this.closeModal();
    window.location.href = '/premium/subscribe';
  }

  closeModal(): void {
    this.showPremiumModal = false;
    this.selectedSkill = '';
  }
}