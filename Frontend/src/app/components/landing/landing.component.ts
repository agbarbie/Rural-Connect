import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
      name: 'Wanjiku Kamau',
      role: 'Data Analyst',
      experience: '3 Years',
      location: 'Nairobi, Kenya',
      skills: ['Python', 'Excel', 'SQL'],
      image: 'https://ui-avatars.com/api/?name=Wanjiku+Kamau&background=22c55e&color=fff&size=150&bold=true',
      matchScore: 95
    },
    {
      name: 'Kipchoge Mwangi',
      role: 'Digital Marketer',
      experience: '2 Years',
      location: 'Kisumu, Kenya',
      skills: ['SEO', 'Social Media', 'Content'],
      image: 'https://ui-avatars.com/api/?name=Kipchoge+Mwangi&background=3b82f6&color=fff&size=150&bold=true',
      matchScore: 92
    },
    {
      name: 'Akinyi Odhiambo',
      role: 'Web Developer',
      experience: '4 Years',
      location: 'Mombasa, Kenya',
      skills: ['React', 'Node.js', 'MongoDB'],
      image: 'https://ui-avatars.com/api/?name=Akinyi+Odhiambo&background=f97316&color=fff&size=150&bold=true',
      matchScore: 88
    },
    {
      name: 'Barasa Wekesa',
      role: 'Content Writer',
      experience: '1 Year',
      location: 'Eldoret, Kenya',
      skills: ['Writing', 'Research', 'SEO'],
      image: 'https://ui-avatars.com/api/?name=Barasa+Wekesa&background=8b5cf6&color=fff&size=150&bold=true',
      matchScore: 85
    }
  ];

  stories: Story[] = [
    {
      name: 'Njeri Ndungu',
      role: 'Data Entry Specialist',
      content: 'Thanks to Digital Skilling App, I found a remote data entry job from my village in Nyeri. The AI matching system guided me perfectly, and I now earn Ksh 25,000 monthly while staying close to my family.',
      avatar: 'https://ui-avatars.com/api/?name=Njeri+Ndungu&background=22c55e&color=fff&size=50&bold=true',
      rating: 5
    },
    {
      name: 'Otieno Ouma',
      role: 'HR Manager, TechCorp Kenya',
      content: 'Digital Skilling App\'s AI-powered matching helped us find skilled workers 3x faster than traditional methods. The secure payment system and interview scheduling made our hiring process seamless.',
      avatar: 'https://ui-avatars.com/api/?name=Otieno+Ouma&background=3b82f6&color=fff&size=50&bold=true',
      rating: 5
    },
    {
      name: 'Chebet Korir',
      role: 'Digital Marketing Assistant',
      content: 'The free training programs helped me transition from farming to digital marketing. I completed 3 certifications and now manage social media for 5 small businesses remotely from Nakuru.',
      avatar: 'https://ui-avatars.com/api/?name=Chebet+Korir&background=f97316&color=fff&size=50&bold=true',
      rating: 5
    }
  ];

  jobOpportunities: JobOpportunity[] = [
    {
      id: 1,
      title: 'Remote Data Entry Specialist',
      company: 'DataCorp Solutions',
      location: 'Remote',
      salary: 'Ksh 15,000 - Ksh 25,000',
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
      salary: 'Ksh 20,000 - Ksh 35,000',
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
      salary: 'Ksh 18,000 - Ksh 28,000',
      type: 'Full-time',
      skills: ['Communication', 'Problem Solving', 'Swahili & English'],
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

  constructor(private router: Router) { }

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
    this.router.navigate(['/premium/subscribe']);
  }
}