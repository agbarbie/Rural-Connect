import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit, AfterViewInit {
  @ViewChild('skillsChart', { static: false }) skillsChart!: ElementRef<HTMLCanvasElement>;

  userMessage: string = '';
  isLoading: boolean = false;
  
  // User data
  userData = {
    name: 'Barbara',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face',
    topSkills: [
      { name: 'UI/UX Design', level: 'high' },
      { name: 'SQL', level: 'high' },
      { name: 'Frontend', level: 'medium' }
    ]
  };

  // Job recommendations
  jobRecommendations: JobRecommendation[] = [
    {
      id: '1',
      title: 'Data Analyst',
      company: 'Microsoft Kenya',
      logo: 'fab fa-microsoft',
      salary: 'KSh 180,000 - 250,000',
      skills: [
        { name: 'SQL', status: 'matched' },
        { name: 'Data Analysis', status: 'matched' },
        { name: 'Python', status: 'partial' },
        { name: 'R', status: 'missing' }
      ],
      applied: false,
      saved: false
    },
    {
      id: '2',
      title: 'UI/UX Designer',
      company: 'Google Africa',
      logo: 'fab fa-google',
      salary: 'KSh 200,000 - 300,000',
      skills: [
        { name: 'UI/UX Design', status: 'matched' },
        { name: 'Figma', status: 'matched' },
        { name: 'React', status: 'partial' },
        { name: 'Angular', status: 'missing' }
      ],
      applied: false,
      saved: false
    },
    {
      id: '3',
      title: 'Frontend Developer',
      company: 'Safaricom PLC',
      logo: 'fas fa-building',
      salary: 'KSh 150,000 - 220,000',
      skills: [
        { name: 'HTML/CSS', status: 'matched' },
        { name: 'JavaScript', status: 'matched' },
        { name: 'React', status: 'partial' },
        { name: 'Node.js', status: 'missing' }
      ],
      applied: false,
      saved: false
    }
  ];

  // Training recommendations
  trainingRecommendations: TrainingRecommendation[] = [
    {
      id: '1',
      title: 'Python for Data Analysis',
      provider: 'Coursera • Google',
      duration: '6 weeks',
      level: 'Intermediate',
      description: 'Complete your data analysis toolkit with Python. Perfect complement to your SQL skills.',
      icon: 'fab fa-python',
      enrolled: false
    },
    {
      id: '2',
      title: 'Angular for Frontend Developers',
      provider: 'Udemy • Internal Platform',
      duration: '4 weeks',
      level: 'Intermediate',
      description: 'Expand your frontend skills with Angular to qualify for full-stack positions.',
      icon: 'fab fa-angular',
      enrolled: false
    }
  ];

  // Skills progress
  skillsProgress: SkillProgress[] = [
    {
      name: 'SQL',
      current: 85,
      change: 20,
      note: 'Completed Advanced SQL Training'
    },
    {
      name: 'UI/UX Design',
      current: 90,
      change: 15,
      note: 'Portfolio project completed'
    },
    {
      name: 'JavaScript',
      current: 70,
      change: 5,
      note: 'Practice exercises completed'
    }
  ];

  // Upcoming deadlines
  deadlines: Deadline[] = [
    {
      id: '1',
      title: 'Data Analyst Application',
      type: 'job',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      company: 'Microsoft Kenya',
      urgent: true
    },
    {
      id: '2',
      title: 'Python Training Enrollment',
      type: 'training',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      company: 'Coursera',
      urgent: false
    },
    {
      id: '3',
      title: 'Portfolio Review Session',
      type: 'meeting',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      company: 'Career Coach',
      urgent: false
    }
  ];

  // Chart data for skills radar
  skillsChartData = {
    labels: ['UI/UX', 'SQL', 'JavaScript', 'Python', 'React', 'Angular'],
    userSkills: [90, 85, 70, 30, 45, 20],
    marketDemand: [85, 80, 95, 85, 90, 75]
  };

  constructor(private router: Router) { }

  ngOnInit(): void {
    // Initialize component
    this.loadUserData();
  }

  ngAfterViewInit(): void {
    // Initialize skills radar chart
    this.initializeSkillsChart();
  }

  loadUserData(): void {
    // In a real app, this would load from a service
    console.log('Loading user data...');
  }

  initializeSkillsChart(): void {
    if (!this.skillsChart) return;

    const canvas = this.skillsChart.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple radar chart implementation
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid circles
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw axis lines
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
      "Based on your SQL and UI/UX skills, I found some amazing opportunities! Let me show you the top matches.",
      "Great question! I've identified several roles that align perfectly with your skillset. Here are my recommendations:",
      "I'm excited to share these job opportunities with you! They're specifically tailored to your expertise."
    ],
    trainingQueries: [
      "Excellent! Continuous learning is key to career growth. Here are some training programs that would boost your profile:",
      "I've analyzed your skill gaps and found some perfect training matches. These will make you even more competitive:",
      "Smart thinking! Upskilling is the best investment. Let me recommend some courses based on market trends."
    ],
    careerAdvice: [
      "Your career path looks promising! With your UI/UX background and new SQL skills, you're positioned for some exciting transitions.",
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
      "I'm impressed by your dedication to growth. Your recent SQL completion shows real commitment! 💪",
      "Remember, every expert was once a beginner. You're building something great! ✨"
    ]
  };

  // Message handling
  sendMessage(): void {
    if (!this.userMessage.trim() || this.isLoading) return;

    const message = this.userMessage.trim();
    
    // Add user message to conversation
    this.conversationMessages.push({
      type: 'user',
      content: message,
      timestamp: new Date()
    });

    this.userMessage = '';
    this.isLoading = true;

    // Simulate AI typing and response
    setTimeout(() => {
      this.processUserMessage(message);
      this.isLoading = false;
    }, 1500);
  }

  processUserMessage(message: string): void {
    const lowerMessage = message.toLowerCase();
    let aiResponse = '';
    let cards: any[] = [];

    // Analyze message content and provide appropriate response
    if (lowerMessage.includes('job') || lowerMessage.includes('work') || lowerMessage.includes('position')) {
      aiResponse = this.getRandomResponse('jobQueries');
      cards = this.jobRecommendations.slice(0, 2); // Show top 2 jobs
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
      // Default intelligent responses
      const defaultResponses = [
        "That's an interesting question! Based on your profile, I can see several ways to approach this. Let me share some insights.",
        "I understand what you're looking for. Your current skill set gives you some great options. Here's my analysis:",
        "Good point! Let me provide you with some data-driven recommendations based on your goals.",
        "I can help with that! Your recent progress in SQL opens up many possibilities. Here are some suggestions:",
        "Absolutely! With your UI/UX background, there are several strategic moves you could make. Let me explain:"
      ];
      aiResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    // Add AI response to conversation
    this.conversationMessages.push({
      type: 'ai',
      content: aiResponse,
      timestamp: new Date(),
      cards: cards
    });

    // Scroll to bottom of conversation
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

  // Quick action handlers
  showJobs(): void {
    console.log('Showing job recommendations');
    // Scroll to jobs section or filter content
  }

  showTraining(): void {
    console.log('Showing training recommendations');
    // Scroll to training section or filter content
  }

  showInsights(): void {
    console.log('Showing career insights');
    // Navigate to insights view or show modal
  }

  showSkillPlan(): void {
    console.log('Showing skill growth plan');
    // Navigate to skill plan view or show modal
  }

  // Job actions
  applyToJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.applied = true;
      console.log('Applied to job:', job.title);
      // In real app, would call API to submit application
    }
  }

  saveJob(jobId: string): void {
    const job = this.jobRecommendations.find(j => j.id === jobId);
    if (job) {
      job.saved = !job.saved;
      console.log('Job saved:', job.title);
      // In real app, would call API to save job
    }
  }

  // Training actions
  enrollInTraining(trainingId: string): void {
    const training = this.trainingRecommendations.find(t => t.id === trainingId);
    if (training) {
      training.enrolled = true;
      console.log('Enrolled in training:', training.title);
      // In real app, would call API to enroll
    }
  }

  // Utility methods for checking card types
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

  // Navigation methods
  navigateToJobs(): void {
    this.router.navigate(['/job-explorer']);
  }

  navigateToTraining(): void {
    this.router.navigate(['/training']);
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  // Premium features
  simulateSkillAddition(skill: string): void {
    console.log('Simulating addition of skill:', skill);
    // This would show projected opportunities
  }

  // Real-time updates (would use WebSocket in real app)
  simulateRealTimeUpdate(): void {
    setInterval(() => {
      // Simulate new job recommendations
      // Update progress tracking
      // Refresh deadlines
    }, 30000); // Every 30 seconds
  }
}