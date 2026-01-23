import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Candidate {
  name: string;
  role: string;
  experience: string;
  location?: string;
  skills?: string[];
  image: string;
  matchScore?: number;
}

interface Story {
  name: string;
  role: string;
  content: string;
  avatar: string;
  rating?: number;
}

interface JobOpportunity {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  skills: string[];
  matchScore: number;
  posted: string;
  logo: string;
  rating?: number; 
}

interface TrainingProgram {
  id: number;
  title: string;
  provider: string;
  duration: string;
  level: string;
  skills: string[];
  matchScore: number;
  category: string;
  logo: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {
  activeTab: string = 'jobs';
  isMenuOpen: boolean = false;
  currentTestimonial: number = 0;
  simulatedSkills: string[] = [];

  candidates: Candidate[] = [
    {
      name: 'Anjali Sharma',
      role: 'Data Analyst',
      experience: '3 Years',
      location: 'Rajasthan, India',
      skills: ['Python', 'Excel', 'SQL'],
      image: 'https://live-production.wcms.abc-cdn.net.au/d4f3618bcdb80ac73fd219fced7809f3?impolicy=wcms_crop_resize&cropH=2813&cropW=5000&xPos=0&yPos=210&width=862&height=485',
      matchScore: 95
    },
    {
      name: 'Ravi Kumar',
      role: 'Digital Marketer',
      experience: '2 Years',
      location: 'Punjab, India',
      skills: ['SEO', 'Social Media', 'Content'],
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      matchScore: 92
    },
    {
      name: 'Priya Patel',
      role: 'Web Developer',
      experience: '4 Years',
      location: 'Gujarat, India',
      skills: ['React', 'Node.js', 'MongoDB'],
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      matchScore: 88
    },
    {
      name: 'Arjun Singh',
      role: 'Content Writer',
      experience: '1 Year',
      location: 'Uttar Pradesh, India',
      skills: ['Writing', 'Research', 'SEO'],
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      matchScore: 85
    }
  ];

  stories: Story[] = [
    {
      name: 'Anjali Devi',
      role: 'Data Entry Specialist',
      content: 'Thanks to RuralConnect, I found a remote data entry job from my village in Rajasthan. The AI matching system guided me perfectly, and I now earn ₹25,000 monthly while staying close to my family.',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b332c7ff?w=50&h=50&fit=crop&crop=face',
      rating: 5
    },
    {
      name: 'Ravi Jha',
      role: 'HR Manager, TechCorp',
      content: 'RuralConnect\'s AI-powered matching helped us find skilled workers 3x faster than traditional methods. The secure payment system and interview scheduling made our hiring process seamless.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
      rating: 5
    },
    {
      name: 'Isha Kumari',
      role: 'Digital Marketing Assistant',
      content: 'The free training programs helped me transition from farming to digital marketing. I completed 3 certifications and now manage social media for 5 small businesses remotely.',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
      rating: 5
    }
  ];

  jobOpportunities: JobOpportunity[] = [
    {
      id: 1,
      title: 'Remote Data Entry Specialist',
      company: 'DataCorp Solutions',
      location: 'Remote',
      salary: '₹15,000 - ₹25,000',
      type: 'Full-time',
      skills: ['Excel', 'Data Entry', 'Attention to Detail'],
      matchScore: 94,
      posted: '2 days ago',
      logo: 'DC',
      rating: 4
    },
    {
      id: 2,
      title: 'Digital Marketing Assistant',
      company: 'GrowthHub',
      location: 'Remote',
      salary: '₹20,000 - ₹35,000',
      type: 'Part-time',
      skills: ['Social Media', 'Content Creation', 'Analytics'],
      matchScore: 89,
      posted: '1 week ago',
      logo: 'GH',
      rating: 4.5
    },
    {
      id: 3,
      title: 'Customer Support Representative',
      company: 'TechSupport Inc',
      location: 'Remote',
      salary: '₹18,000 - ₹28,000',
      type: 'Full-time',
      skills: ['Communication', 'Problem Solving', 'Hindi & English'],
      matchScore: 91,
      posted: '3 days ago',
      logo: 'TS',
      rating: 3
    }
  ];

  trainingPrograms: TrainingProgram[] = [
    {
      id: 1,
      title: 'Data Analysis with Python',
      provider: 'Data Academy',
      duration: '8 weeks',
      level: 'Intermediate',
      skills: ['Python', 'Pandas', 'NumPy', 'Matplotlib'],
      matchScore: 89,
      category: 'Popular',
      logo: 'DA'
    },
    {
      id: 2,
      title: 'Digital Marketing Mastery',
      provider: 'Digital Institute',
      duration: '6 weeks',
      level: 'Beginner',
      skills: ['SEO', 'Social Media', 'Google Ads', 'Analytics'],
      matchScore: 92,
      category: 'Trending',
      logo: 'DI'
    },
    {
      id: 3,
      title: 'Cloud Computing Fundamentals',
      provider: 'Cloud Certified',
      duration: '10 weeks',
      level: 'Advanced',
      skills: ['AWS', 'Azure', 'Docker', 'Kubernetes'],
      matchScore: 94,
      category: 'Certification',
      logo: 'CC'
    }
  ];
  router: any;

  ngOnInit(): void {
    setInterval(() => {
      this.currentTestimonial = (this.currentTestimonial + 1) % this.stories.length;
    }, 5000);
  }
 navigateToLogin(): void {
  this.router.navigate(['/auth'], { queryParams: { mode: 'login' } });
}

navigateToSignup(): void {
  this.router.navigate(['/auth'], { queryParams: { mode: 'signup' } });
}
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    this.isMenuOpen = false;
  }

  getStarArray(rating: number): number[] {
    return Array(rating).fill(0);
  }

  getOpportunities() {
    return this.activeTab === 'jobs' ? this.jobOpportunities : this.trainingPrograms;
  }

  bookmarkOpportunity(event: Event, id: number): void {
    event.stopPropagation();
    console.log('Bookmarked opportunity:', id);
  }

  shareCandidate(event: Event, candidate: Candidate): void {
    event.stopPropagation();
    console.log('Shared candidate:', candidate.name);
  }

  viewCandidateResume(candidate: Candidate): void {
    console.log('Viewing resume for:', candidate.name);
  }

  applyForJob(job: JobOpportunity): void {
    console.log('Applying for job:', job.title);
  }

  enrollInTraining(training: TrainingProgram): void {
    console.log('Enrolling in training:', training.title);
  }

  addSkill(skill: string): void {
    if (!this.simulatedSkills.includes(skill)) {
      this.simulatedSkills.push(skill);
    }
    console.log('Added skill for simulation:', skill);
  }

  getCareerForSkill(skill: string): string {
    const careers: { [key: string]: string } = {
      'Python': 'Data Scientist roles',
      'React': 'Frontend Developer positions',
      'Node.js': 'Full-Stack Developer opportunities'
    };
    return careers[skill] || 'New career paths';
  }

  getSalaryForSkill(skill: string): string {
    const salaries: { [key: string]: string } = {
      'Python': 'Ksh 50,000 - Ksh 1,20,000/month',
      'React': 'Ksh 40,000 - Ksh 90,000/month',
      'Node.js': 'Ksh 45,000 - Ksh 1,00,000/month'
    };
    return salaries[skill] || 'Ksh 30,000+/month';
  }

  subscribeToPremium(): void {
    console.log('Navigating to premium subscription...');
    // In a real app, this would redirect to a subscription page
    window.location.href = '../premium/subscribe';
  }
}