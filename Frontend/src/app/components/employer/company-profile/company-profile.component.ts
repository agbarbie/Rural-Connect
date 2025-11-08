import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
interface CompanyInfo {
  name: string;
  about: string;
  mission: string;
  vision: string;
  founded: string;
  size: string;
  industry: string;
  headquarters: string;
  logo?: string;
}

interface Benefit {
  title: string;
  description: string;
  icon: string;
}

interface CSRInitiative {
  title: string;
  description: string;
  icon: string;
  impact: string;
}

interface JobOpening {
  id: string;
  title: string;
  location: string;
  mode: 'Remote' | 'Hybrid' | 'On-site';
  postedDate: Date;
  skills: string[];
  department: string;
}

interface AIInsights {
  skillMatch: number;
  companyFitScore: number;
  recommendedTraining: string[];
}

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './company-profile.component.html',
  styleUrls: ['./company-profile.component.css']
})
  export class CompanyProfileComponent implements OnInit {
  activeTab = signal<string>('overview');
  
  companyInfo = signal<CompanyInfo>({
    name: 'TechInnovate Solutions',
    about: 'TechInnovate Solutions is a leading technology company specializing in AI-driven solutions for enterprise clients. We create innovative software that transforms how businesses operate.',
    mission: 'Our mission is to democratize artificial intelligence and make it accessible to businesses of all sizes.',
    vision: 'We envision a world where technology enhances human potential and creates sustainable solutions for global challenges.',
    founded: '2018',
    size: '500+',
    industry: 'Technology',
    headquarters: 'San Francisco, CA'
  });

  workEnvironmentImages = signal([
    {
      url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop',
      alt: 'Modern Office Space',
      label: 'Open Collaborative Workspace'
    },
    {
      url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=200&fit=crop',
      alt: 'Meeting Room',
      label: 'Executive Conference Room'
    },
    {
      url: 'https://images.unsplash.com/photo-1571624436279-b272aff752b5?w=400&h=200&fit=crop',
      alt: 'Recreation Area',
      label: 'Employee Recreation Space'
    }
  ]);

  benefits = signal<Benefit[]>([
    {
      title: 'Health & Wellness',
      description: 'Comprehensive health insurance, dental, vision, and mental health support',
      icon: 'fas fa-heart'
    },
    {
      title: 'Flexible Work',
      description: 'Remote work options, flexible hours, and work-life balance support',
      icon: 'fas fa-clock'
    },
    {
      title: 'Professional Development',
      description: 'Learning stipend, conference attendance, and skill development programs',
      icon: 'fas fa-graduation-cap'
    },
    {
      title: 'Financial Benefits',
      description: 'Competitive salary, stock options, 401(k) matching, and performance bonuses',
      icon: 'fas fa-dollar-sign'
    },
    {
      title: 'Time Off',
      description: 'Generous PTO, sabbatical options, and paid volunteer days',
      icon: 'fas fa-calendar-alt'
    },
    {
      title: 'Perks & Amenities',
      description: 'Free meals, gym membership, commuter benefits, and team events',
      icon: 'fas fa-gift'
    }
  ]);

  csrInitiatives = signal<CSRInitiative[]>([
    {
      title: 'Digital Education for All',
      description: 'Providing free coding bootcamps and digital literacy programs to underserved communities worldwide.',
      icon: 'fas fa-laptop',
      impact: '10,000+ students trained'
    },
    {
      title: 'Climate Action Tech',
      description: 'Developing AI solutions to help companies reduce their carbon footprint and achieve sustainability goals.',
      icon: 'fas fa-leaf',
      impact: '50% reduction in client emissions'
    },
    {
      title: 'Open Source Contributions',
      description: 'Contributing to open source projects and maintaining developer tools used by millions worldwide.',
      icon: 'fas fa-code',
      impact: '100+ open source projects'
    }
  ]);

  jobOpenings = signal<JobOpening[]>([
    {
      id: '1',
      title: 'Senior Full Stack Developer',
      location: 'San Francisco, CA',
      mode: 'Hybrid',
      postedDate: new Date('2024-08-20'),
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      department: 'Engineering'
    },
    {
      id: '2',
      title: 'AI/ML Engineer',
      location: 'Remote',
      mode: 'Remote',
      postedDate: new Date('2024-08-18'),
      skills: ['Python', 'TensorFlow', 'PyTorch', 'AWS'],
      department: 'AI Research'
    },
    {
      id: '3',
      title: 'Product Manager',
      location: 'New York, NY',
      mode: 'On-site',
      postedDate: new Date('2024-08-15'),
      skills: ['Product Strategy', 'Agile', 'Data Analysis', 'User Research'],
      department: 'Product'
    }
  ]);

  aiInsights = signal<AIInsights>({
    skillMatch: 85,
    companyFitScore: 92,
    recommendedTraining: [
      'Advanced React Patterns',
      'Cloud Architecture',
      'Leadership Skills',
      'Data Science Fundamentals'
    ]
  });

  ngOnInit() {
    // Initialize component
  }

  setActiveTab(tab: string) {
    this.activeTab.set(tab);
  }

  editProfile() {
    console.log('Edit profile clicked');
  }

  onSearchChange(event: any) {
    const searchTerm = event.target.value;
    console.log('Search:', searchTerm);
  }

  applyToJob(jobId: string) {
    console.log('Apply to job:', jobId);
  }

  getJobModeClass(mode: string): string {
    return mode.toLowerCase().replace('-', '');
  }

  getDaysAgo(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  handleImageError(event: any) {
    event.target.style.display = 'none';
  }
}