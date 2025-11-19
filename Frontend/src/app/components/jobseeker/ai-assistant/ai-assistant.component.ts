import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { ProfileService, PortfolioData } from '../../../../../services/profile.service';
import { AuthService } from '../../../../../services/auth.service';
import { environment } from '../../../../environments/environments';

interface JobRecommendation {
  id: string;
  title: string;
  company: string;
  logo: string;
  salary: string;
  skills: Array<{
    name: string;
    status: 'matched' | 'partial' | 'missing';
  }>;
  applied: boolean;
  saved: boolean;
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
  showPremiumModal: boolean = false;
  portfolioData: PortfolioData | null = null;
  
  // User data - now dynamically loaded
  userData = {
    name: 'User', // Default fallback
    avatar: 'assets/images/profile-placeholder.jpg',
    topSkills: [] as Array<{ name: string; level: string }>
  };

  // Job recommendations
  jobRecommendations: JobRecommendation[] = [];

  // Training recommendations
  trainingRecommendations: TrainingRecommendation[] = [];

  // Skills progress - dynamically loaded
  skillsProgress: SkillProgress[] = [];

  // Upcoming deadlines
  deadlines: Deadline[] = [
    {
      id: '1',
      title: 'Data Analyst Application',
      type: 'job',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      company: 'Microsoft Kenya',
      urgent: true
    },
    {
      id: '2',
      title: 'Python Training Enrollment',
      type: 'training',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      company: 'Coursera',
      urgent: false
    },
    {
      id: '3',
      title: 'Portfolio Review Session',
      type: 'meeting',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      company: 'Career Coach',
      urgent: false
    }
  ];

  // Chart data for skills radar - dynamically populated
  skillsChartData = {
    labels: [] as string[],
    userSkills: [] as number[],
    marketDemand: [] as number[]
  };

  constructor(
    private router: Router,
    private profileService: ProfileService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  ngAfterViewInit(): void {
    // Initialize skills radar chart after data is loaded
    setTimeout(() => {
      this.initializeSkillsChart();
    }, 500);
  }

  loadUserProfile(): void {
    this.isLoading = true;
    
    console.log('=== LOADING USER PROFILE ===');
    
    // Try to get name from auth service first as fallback
    const currentUser = this.authService.getCurrentUser();
    console.log('Current user from auth:', currentUser);
    
    if (currentUser?.name) {
      this.userData.name = currentUser.name;
      console.log('Set name from auth service:', this.userData.name);
    }
    
    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        console.log('Portfolio API response:', response);
        
        if (response.success && response.data) {
          this.portfolioData = response.data;
          this.populateUserDataFromPortfolio(response.data);
          this.generateRecommendations();
          
          console.log('Final userData after population:', this.userData);
        } else {
          console.error('No portfolio data found');
          this.useDefaultData();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        this.useDefaultData();
        this.isLoading = false;
      }
    });
  }

  private populateUserDataFromPortfolio(portfolio: PortfolioData): void {
    const cvData = portfolio.cvData;
    const personalInfo = cvData.personal_info || cvData.personal_info;

    console.log('Portfolio data:', portfolio);
    console.log('CV data:', cvData);
    console.log('Personal info:', personalInfo);

    // Set user basic info
    if (personalInfo) {
      // Try multiple field variations
      this.userData.name = personalInfo.full_name || 
                          personalInfo.full_name || 
                          personalInfo.name || 
                          'User';
      
      console.log('Extracted name:', this.userData.name);
      
      // Handle profile image
      const profileImage = personalInfo.profile_image || 
                          personalInfo.profile_image || 
                          personalInfo.image;
      if (profileImage) {
        this.userData.avatar = this.getFullImageUrl(profileImage);
      }
    } else {
      console.warn('No personal info found in portfolio');
    }

    // Extract top skills from CV
    if (cvData.skills && cvData.skills.length > 0) {
      // Sort by proficiency and take top 3
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

      // Populate skills chart data
      const topSkillsForChart = sortedSkills.slice(0, 6);
      this.skillsChartData.labels = topSkillsForChart.map(s => s.skill_name);
      this.skillsChartData.userSkills = topSkillsForChart.map(s => this.getProficiencyNumber(s.proficiency_level));
      // Generate market demand (mock data based on skill relevance)
      this.skillsChartData.marketDemand = topSkillsForChart.map(() => Math.floor(Math.random() * 30) + 70);

      // Populate skills progress
      this.skillsProgress = sortedSkills.slice(0, 3).map(skill => ({
        name: skill.skill_name,
        current: this.getProficiencyNumber(skill.proficiency_level),
        change: Math.floor(Math.random() * 20) + 5, // Mock progress
        note: `${skill.category || 'General'} skill`
      }));
    }
  }

  private generateRecommendations(): void {
    if (!this.portfolioData) return;

    const cvData = this.portfolioData.cvData;
    const userSkills = cvData.skills?.map(s => s.skill_name.toLowerCase()) || [];

    // Generate job recommendations based on user skills
    this.jobRecommendations = this.getJobRecommendationsBasedOnSkills(userSkills);

    // Generate training recommendations based on skill gaps
    this.trainingRecommendations = this.getTrainingRecommendationsBasedOnGaps(userSkills);
  }

  private getJobRecommendationsBasedOnSkills(userSkills: string[]): JobRecommendation[] {
    // Define job database with required skills
    const jobDatabase = [
      {
        id: '1',
        title: 'Data Analyst',
        company: 'Microsoft Kenya',
        logo: 'fab fa-microsoft',
        salary: 'KSh 180,000 - 250,000',
        requiredSkills: ['sql', 'data analysis', 'python', 'r', 'statistics']
      },
      {
        id: '2',
        title: 'UI/UX Designer',
        company: 'Google Africa',
        logo: 'fab fa-google',
        salary: 'KSh 200,000 - 300,000',
        requiredSkills: ['ui/ux', 'figma', 'design', 'react', 'angular', 'user experience']
      },
      {
        id: '3',
        title: 'Frontend Developer',
        company: 'Safaricom PLC',
        logo: 'fas fa-building',
        salary: 'KSh 150,000 - 220,000',
        requiredSkills: ['html', 'css', 'javascript', 'react', 'node.js', 'frontend']
      },
      {
        id: '4',
        title: 'Full Stack Developer',
        company: 'Andela Kenya',
        logo: 'fas fa-code',
        salary: 'KSh 250,000 - 400,000',
        requiredSkills: ['javascript', 'react', 'node.js', 'mongodb', 'express', 'fullstack']
      },
      {
        id: '5',
        title: 'Software Engineer',
        company: 'Twiga Foods',
        logo: 'fas fa-laptop-code',
        salary: 'KSh 200,000 - 350,000',
        requiredSkills: ['java', 'python', 'javascript', 'git', 'agile', 'software development']
      }
    ];

    // Match jobs with user skills
    const matchedJobs = jobDatabase.map(job => {
      const skills = job.requiredSkills.map(skill => {
        const hasSkill = userSkills.some(userSkill => 
          userSkill.includes(skill) || skill.includes(userSkill)
        );
        
        return {
          name: this.capitalizeSkill(skill),
          status: hasSkill ? 'matched' as const : 'missing' as const
        };
      }).slice(0, 4); // Take first 4 skills

      const matchCount = skills.filter(s => s.status === 'matched').length;

      return {
        id: job.id,
        title: job.title,
        company: job.company,
        logo: job.logo,
        salary: job.salary,
        skills: skills,
        applied: false,
        saved: false,
        matchScore: matchCount
      };
    });

    // Sort by match score and return top 3
    return matchedJobs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }

  private getTrainingRecommendationsBasedOnGaps(userSkills: string[]): TrainingRecommendation[] {
    // Define training courses
    const trainingDatabase = [
      {
        id: '1',
        title: 'Python for Data Analysis',
        provider: 'Coursera • Google',
        duration: '6 weeks',
        level: 'Intermediate',
        description: 'Complete your data analysis toolkit with Python. Perfect complement to your SQL skills.',
        icon: 'fab fa-python',
        relatedSkills: ['python', 'data analysis']
      },
      {
        id: '2',
        title: 'Angular for Frontend Developers',
        provider: 'Udemy • Internal Platform',
        duration: '4 weeks',
        level: 'Intermediate',
        description: 'Expand your frontend skills with Angular to qualify for full-stack positions.',
        icon: 'fab fa-angular',
        relatedSkills: ['angular', 'frontend', 'typescript']
      },
      {
        id: '3',
        title: 'React Masterclass',
        provider: 'Udemy • Meta',
        duration: '8 weeks',
        level: 'Beginner to Advanced',
        description: 'Master React from fundamentals to advanced patterns and hooks.',
        icon: 'fab fa-react',
        relatedSkills: ['react', 'javascript', 'frontend']
      },
      {
        id: '4',
        title: 'Node.js Backend Development',
        provider: 'Coursera • IBM',
        duration: '6 weeks',
        level: 'Intermediate',
        description: 'Build scalable backend applications with Node.js and Express.',
        icon: 'fab fa-node-js',
        relatedSkills: ['node.js', 'backend', 'javascript']
      }
    ];

    // Find training for skills user doesn't have
    return trainingDatabase
      .filter(training => {
        const hasRelatedSkill = training.relatedSkills.some(skill =>
          userSkills.some(userSkill => userSkill.includes(skill))
        );
        return !hasRelatedSkill; // Recommend if user doesn't have the skill
      })
      .slice(0, 2)
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

  private useDefaultData(): void {
    this.userData = {
      name: 'User',
      avatar: 'assets/images/profile-placeholder.jpg',
      topSkills: [
        { name: 'General Skills', level: 'medium' }
      ]
    };
  }

  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/images/profile-placeholder.jpg';
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // If it's a relative path, construct full URL
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }
    
    return imagePath;
  }

    handleImageError(event: any): void {
    console.log('Profile image load error, using fallback');
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

  initializeSkillsChart(): void {
    if (!this.skillsChart || this.skillsChartData.labels.length === 0) return;

    const canvas = this.skillsChart.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid circles
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw axis lines and labels
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

      // Draw labels
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      const labelX = centerX + (radius + 20) * Math.cos(angle);
      const labelY = centerY + (radius + 20) * Math.sin(angle);
      ctx.fillText(this.skillsChartData.labels[i], labelX, labelY);
    }

    // Draw user skills polygon
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

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw market demand polygon
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

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Conversation messages
  conversationMessages: Array<{
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
    cards?: any[];
  }> = [];

  // Predefined AI responses
  aiResponses = {
    greetings: [
      "Hello! I'm here to help you with your career journey. What would you like to know?",
      "Hi there! Ready to explore some exciting opportunities today?",
      "Welcome back! I've been analyzing the job market for you."
    ],
    jobQueries: [
      "Based on your skills, I found some amazing opportunities! Let me show you the top matches.",
      "Great question! I've identified several roles that align perfectly with your skillset. Here are my recommendations:",
      "I'm excited to share these job opportunities with you! They're specifically tailored to your expertise."
    ],
    trainingQueries: [
      "Excellent! Continuous learning is key to career growth. Here are some training programs that would boost your profile:",
      "I've analyzed your skill gaps and found some perfect training matches. These will make you even more competitive:",
      "Smart thinking! Upskilling is the best investment. Let me recommend some courses based on market trends."
    ],
    careerAdvice: [
      "Your career path looks promising! With your background and skills, you're positioned for some exciting transitions.",
      "I see great potential in your profile. Let me outline a strategic path that could increase your earning potential significantly.",
      "You're on the right track! Your skill combination is quite valuable in today's market. Here's what I recommend:"
    ],
    skillQueries: [
      "Your skills are developing nicely! Let me break down your current strengths and areas for growth.",
      "I've been tracking your progress, and there's some great news! Your recent improvements are really paying off.",
      "Looking at your skill portfolio, you're becoming quite versatile. Here's how you compare to the market:"
    ],
    motivation: [
      "You're doing amazing! Every skill you learn opens new doors. Keep up the excellent work! 🚀",
      "I'm impressed by your dedication to growth. Your commitment shows real potential! 💪",
      "Remember, every expert was once a beginner. You're building something great! ✨"
    ]
  };

  // Rest of the methods remain the same...
  sendMessage(): void {
    if (!this.userMessage.trim() || this.isLoading) return;

    const message = this.userMessage.trim();
    
    this.conversationMessages.push({
      type: 'user',
      content: message,
      timestamp: new Date()
    });

    this.userMessage = '';
    this.isLoading = true;

    setTimeout(() => {
      this.processUserMessage(message);
      this.isLoading = false;
    }, 1500);
  }

  processUserMessage(message: string): void {
    const lowerMessage = message.toLowerCase();
    let aiResponse = '';
    let cards: any[] = [];

    if (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('position')) {
      aiResponse = this.getRandomResponse('jobQueries');
      cards = this.jobRecommendations.slice(0, 2);
    } 
    else if (lowerMessage.includes('training') || lowerMessage.includes('course') || lowerMessage.includes('learn')) {
      aiResponse = this.getRandomResponse('trainingQueries');
      cards = this.trainingRecommendations;
    }
    else if (lowerMessage.includes('career') || lowerMessage.includes('future') || lowerMessage.includes('path')) {
      aiResponse = this.getRandomResponse('careerAdvice');
    }
    else if (lowerMessage.includes('skill') || lowerMessage.includes('progress') || lowerMessage.includes('improvement')) {
      aiResponse = this.getRandomResponse('skillQueries');
    }
    else if (lowerMessage.includes('thank') || lowerMessage.includes('great') || lowerMessage.includes('awesome')) {
      aiResponse = this.getRandomResponse('motivation');
    }
    else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      aiResponse = this.getRandomResponse('greetings');
    }
    else {
      const defaultResponses = [
        "That's an interesting question! Based on your profile, I can see several ways to approach this. Let me share some insights.",
        "I understand what you're looking for. Your current skill set gives you some great options. Here's my analysis:",
        "Good point! Let me provide you with some data-driven recommendations based on your goals.",
        `I can help with that! Your skills in ${this.userData.topSkills[0]?.name || 'your area'} open up many possibilities. Here are some suggestions:`,
        "Absolutely! With your background, there are several strategic moves you could make. Let me explain:"
      ];
      aiResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    this.conversationMessages.push({
      type: 'ai',
      content: aiResponse,
      timestamp: new Date(),
      cards: cards
    });

    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  getRandomResponse(category: keyof typeof this.aiResponses): string {
    const responses = this.aiResponses[category];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  scrollToBottom(): void {
    const conversationArea = document.querySelector('.conversation-area');
    if (conversationArea) {
      conversationArea.scrollTop = conversationArea.scrollHeight;
    }
  }

  showJobs(): void {
    this.router.navigate(['/jobseeker/job-explorer']);
  }

  showTraining(): void {
    this.router.navigate(['/jobseeker/training']);
  }

  showInsights(): void {
    console.log('Showing career insights');
  }

  showSkillPlan(): void {
    console.log('Showing skill growth plan');
  }

  applyToJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.applied = true;
      console.log('Applied to job:', job.title);
    }
  }

  saveJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.saved = !job.saved;
      console.log('Job saved:', job.title);
    }
  }

  enrollInTraining(trainingId: string): void {
    const training = this.trainingRecommendations.find(t => t.id === trainingId);
    if (training) {
      training.enrolled = true;
      console.log('Enrolled in training:', training.title);
    }
  }

  isJobCards(cards: any[]): boolean {
    return cards.length > 0 && cards[0].hasOwnProperty('company');
  }

  isTrainingCards(cards: any[]): boolean {
    return cards.length > 0 && cards[0].hasOwnProperty('provider');
  }

  getSkillTagClass(status: string): string {
    return `skill-tag ${status}`;
  }

  getProgressChangeClass(change: number): string {
    if (change > 10) return 'progress-change positive';
    if (change > 0) return 'progress-change neutral';
    return 'progress-change negative';
  }

  getDeadlineClass(deadline: Deadline): string {
    return deadline.urgent ? 'deadline-item urgent' : 'deadline-item normal';
  }

  formatDeadline(date: Date): string {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays < 7) return `Due in ${diffDays} days`;
    return 'Next week';
  }

  getDeadlineIcon(type: string): string {
    switch (type) {
      case 'job': return 'fas fa-briefcase';
      case 'training': return 'fas fa-graduation-cap';
      case 'meeting': return 'fas fa-user-friends';
      default: return 'fas fa-calendar';
    }
  }

  navigateToJobs(): void {
    this.router.navigate(['/jobseeker/job-explorer']);
  }

  navigateToTraining(): void {
    this.router.navigate(['/jobseeker/training']);
  }

  navigateToProfile(): void {
    this.router.navigate(['/jobseeker/profile']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/jobseeker/dashboard']);
  }

  onSimulate(): void {
    if (this.selectedSkill) {
      this.showPremiumModal = true;
      console.log('Simulating skill addition for:', this.selectedSkill);
    }
  }

  subscribeToPremium(): void {
    this.closeModal();
    console.log('Navigating to premium subscription for skill:', this.selectedSkill);
    // Redirect to subscription page
    window.location.href = '/premium/subscribe';
    // Or use router: this.router.navigate(['/premium/subscribe']);
  }

  closeModal(): void {
    this.showPremiumModal = false;
    this.selectedSkill = '';
  }

  simulateSkillAddition(skill: string): void {
    console.log('Simulating addition of skill:', skill);
  }
}