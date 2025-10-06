import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common'; 
import { CommonModule } from '@angular/common';
import { CvService, CV } from '../../../../../services/cv.service';
import { AuthService } from '../../../../../services/auth.service';
import { PortfolioService, PortfolioData } from '../../../../../services/portfolio.service';

interface Project {
  id: number;
  title: string;
  description: string;
  techStack: string[];
  category: string;
  thumbnail: string;
  liveDemo?: string;
  githubLink?: string;
}

interface Certificate {
  id: number;
  name: string;
  issuer: string;
  completionDate: string;
  downloadUrl?: string;
}

interface Training {
  id: number;
  title: string;
  status: 'completed' | 'in-progress';
  trainer: string;
  completionDate?: string;
  description: string;
}

interface Skill {
  name: string;
  category: string;
}

interface Testimonial {
  id: number;
  text: string;
  author: string;
  position: string;
}

@Component({
  selector: 'app-portfolio',
  templateUrl: './portfolio.component.html',
  imports: [CommonModule, DatePipe],
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit {
  onImageError($event: ErrorEvent, arg1: string) {
    throw new Error('Method not implemented.');
  }
  
  isLoading = true;
  currentCV: CV | null = null;

  // User Profile Data
  profileData = {
    fullName: '',
    title: '',
    location: '',
    profilePicture: '/assets/images/profile-picture.jpg',
    coverBanner: '/assets/images/cover-banner.jpg',
    bio: '',
    email: '',
    phone: ''
  };

  trainingExperiences: Training[] = [];
  certificates: Certificate[] = [];
  projects: Project[] = [];
  skills: Skill[] = [];
  testimonials: Testimonial[] = [];

  // Filter and display properties
  selectedProjectCategory: string = 'All';
  projectCategories: string[] = ['All'];
  filteredProjects: Project[] = [];
  currentTestimonialIndex: number = 0;
  viewCount: number = 0;

  constructor(
    private cvService: CvService,
    private authService: AuthService,
    private portfolioService: PortfolioService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadPortfolioData();
    this.startTestimonialCarousel();
  }

  private loadUserProfile(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.profileData.fullName = user.name || '';
      this.profileData.email = user.email || '';
    }
  }

  private loadPortfolioData(): void {
    this.portfolioService.getMyPortfolio().subscribe({
      next: (response: any) => {
        console.log('Raw API Response:', response);
        
        // Backend wraps response in { success, message, data }
        const data = response.data || response;
        
        console.log('Portfolio Data:', data);
        
        // Validate that we have a CV ID
        if (!data.cvId) {
          console.error('No CV ID in response:', data);
          this.isLoading = false;
          alert('No CV found. Please create a CV in the CV Builder first.');
          return;
        }
        
        // Set current CV with validated data
        this.currentCV = {
          id: data.cvId,
          userId: data.userId,
          status: 'final',
          cvData: data.cvData,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
        
        console.log('Current CV set:', this.currentCV.id);
        
        this.populatePortfolioFromData(data);
        this.viewCount = data.viewCount || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio data:', error);
        this.isLoading = false;
        
        // Show user-friendly error
        if (error.error?.message) {
          alert(error.error.message);
        } else {
          alert('Failed to load portfolio. Please ensure you have created a CV in the CV Builder.');
        }
      }
    });
  }

  private populatePortfolioFromData(data: PortfolioData): void {
    const cvData = data.cvData;

    console.log('Full cvData structure:', cvData);

    // Personal Information
    if (cvData.personalInfo) {
      this.profileData.fullName = cvData.personalInfo.fullName || this.profileData.fullName;
      this.profileData.email = cvData.personalInfo.email || this.profileData.email;
      this.profileData.phone = cvData.personalInfo.phone || '';
      this.profileData.location = cvData.personalInfo.address || 'Kenya';
      this.profileData.bio = cvData.personalInfo.professionalSummary || '';
      this.profileData.title = this.generateTitle(cvData);
    }

    // Work Experience - Handle both formats
    if (cvData.work_experience && cvData.work_experience.length > 0) {
      this.trainingExperiences = cvData.work_experience.map((work: any, index: number) => ({
        id: index + 1,
        title: work.position,
        status: work.is_current ? 'in-progress' : 'completed',
        trainer: work.company,
        completionDate: work.is_current ? undefined : work.end_date,
        description: work.responsibilities || ''
      }));
    } else if (cvData.workExperience && cvData.workExperience.length > 0) {
      this.trainingExperiences = cvData.workExperience.map((work: any, index: number) => ({
        id: index + 1,
        title: work.position,
        status: work.current ? 'in-progress' : 'completed',
        trainer: work.company,
        completionDate: work.current ? undefined : work.endDate,
        description: work.responsibilities || ''
      }));
    }

    // Skills - FIXED VERSION with comprehensive format handling
    console.log('Checking skills data...');
    console.log('cvData.skills:', cvData.skills);
    
    if (cvData.skills && Array.isArray(cvData.skills) && cvData.skills.length > 0) {
      console.log('Skills array found with', cvData.skills.length, 'items');
      console.log('First skill structure:', cvData.skills[0]);
      
      this.skills = cvData.skills.map((skill: any): Skill => {
        // Handle different possible field names
        const skillName = skill.name || skill.skill_name || skill.skillName || '';
        const skillCategory = skill.category || skill.skill_category || skill.skillCategory || 'General';
        
        console.log('Mapping skill:', { original: skill, mapped: { name: skillName, category: skillCategory } });
        
        return {
          name: skillName,
          category: skillCategory
        };
      }).filter((skill: Skill) => skill.name); // Remove empty skills
      
      console.log('Final mapped skills:', this.skills);
      console.log('Total skills after mapping:', this.skills.length);
    } else {
      console.warn('No skills found in cvData or skills is not an array');
      console.log('Available cvData keys:', Object.keys(cvData));
      
      // Fallback: Check if skills might be under a different key
      const possibleSkillsKeys = ['skill', 'Skills', 'SKILLS', 'user_skills'];
      for (const key of possibleSkillsKeys) {
        if (cvData[key] && Array.isArray(cvData[key]) && cvData[key].length > 0) {
          console.log(`Found skills under key: ${key}`);
          this.skills = cvData[key].map((skill: any): Skill => ({
            name: skill.name || skill.skill_name || '',
            category: skill.category || skill.skill_category || 'General'
          })).filter((skill: Skill) => skill.name);
          break;
        }
      }
      
      if (this.skills.length === 0) {
        console.error('Could not find skills in any expected location');
      }
    }

    // Certifications
    if (cvData.certifications && cvData.certifications.length > 0) {
      this.certificates = cvData.certifications.map((cert: any, index: number): Certificate => ({
        id: index + 1,
        name: cert.name,
        issuer: cert.issuer,
        completionDate: cert.dateIssued || cert.date_issued || new Date().toISOString(),
        downloadUrl: cert.credentialId || cert.credential_id || undefined
      }));
    }

    // Projects
    if (cvData.projects && cvData.projects.length > 0) {
      this.projects = cvData.projects.map((proj: any, index: number): Project => {
        const techString = proj.technologies || proj.tech_stack || '';
        const category: string = this.categorizeProject(techString);
        
        return {
          id: index + 1,
          title: proj.name || proj.project_name || 'Untitled Project',
          description: proj.description || '',
          techStack: techString ? techString.split(',').map((t: string) => t.trim()) : [],
          category: category,
          thumbnail: '/assets/projects/default-project.jpg',
          liveDemo: proj.demoLink || proj.demo_link || undefined,
          githubLink: proj.githubLink || proj.github_link || undefined
        };
      });

      this.updateProjectCategories();
      this.filteredProjects = this.projects;
    }

    // Testimonials from portfolio data
    if (data.testimonials && data.testimonials.length > 0) {
      this.testimonials = data.testimonials.map((t, index) => ({
        id: t.id || index + 1,
        text: t.text || t.content || '',
        author: t.author || '',
        position: t.position || t.role || ''
      }));
    }

    // If no testimonials, generate from work experience
    if (this.testimonials.length === 0) {
      this.generateTestimonials(cvData);
    }
  }

  private generateTitle(cvData: any): string {
    // Generate title based on skills and work experience
    if (cvData.skills && cvData.skills.length > 0) {
      const topSkills = cvData.skills.slice(0, 3).map((s: any) => s.name || s.skill_name);
      return `${topSkills.join(' | ')} Specialist`;
    }
    
    if (cvData.workExperience && cvData.workExperience.length > 0) {
      return cvData.workExperience[0].position;
    }
    
    if (cvData.work_experience && cvData.work_experience.length > 0) {
      return cvData.work_experience[0].position;
    }

    return 'Professional';
  }

  private categorizeProject(technologies: string): string {
    const tech = technologies.toLowerCase();
    
    if (tech.includes('react') || tech.includes('angular') || tech.includes('vue')) {
      return 'Web Apps';
    }
    if (tech.includes('figma') || tech.includes('adobe') || tech.includes('design')) {
      return 'UI Design';
    }
    if (tech.includes('python') || tech.includes('data') || tech.includes('analytics')) {
      return 'Data Analysis';
    }
    if (tech.includes('brand') || tech.includes('marketing')) {
      return 'Branding & Marketing';
    }
    
    return 'Web Apps';
  }

  private updateProjectCategories(): void {
    const categories = new Set(this.projects.map(p => p.category));
    this.projectCategories = ['All', ...Array.from(categories)];
  }

  private generateTestimonials(cvData: any): void {
    this.testimonials = [];
    
    // Check both workExperience and work_experience
    const workExp = cvData.workExperience || cvData.work_experience || [];
    
    if (workExp.length > 0) {
      workExp.forEach((work: any, index: number) => {
        const achievements = work.achievements || work.key_achievements;
        if (achievements) {
          const achievement = achievements.split('\n')[0] || achievements;
          this.testimonials.push({
            id: index + 1,
            text: achievement,
            author: `Colleague from ${work.company}`,
            position: 'Team Member'
          });
        }
      });
    }

    // If no testimonials, add a default one
    if (this.testimonials.length === 0) {
      this.testimonials.push({
        id: 1,
        text: 'Excellent professional with great attention to detail and strong technical skills.',
        author: 'Professional Contact',
        position: 'Colleague'
      });
    }
  }

  // Project filtering
  filterProjects(category: string): void {
    this.selectedProjectCategory = category;
    if (category === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(project => project.category === category);
    }
  }

  // Testimonial carousel
  startTestimonialCarousel(): void {
    setInterval(() => {
      if (this.testimonials.length > 0) {
        this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
      }
    }, 5000);
  }

  // Action methods
  downloadCV(): void {
    if (this.currentCV) {
      const filename = `${this.profileData.fullName.replace(/\s+/g, '_')}_CV.pdf`;
      this.cvService.downloadCV(this.currentCV.id, 'pdf', filename);
    } else {
      alert('No CV available. Please create one in the CV Builder.');
    }
  }

  downloadPortfolioPDF(): void {
    this.portfolioService.downloadPortfolioPDF().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.profileData.fullName}_Portfolio.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error downloading portfolio PDF:', error);
        alert('Error generating portfolio PDF');
      }
    });
  }

  sharePortfolio(): void {
    const portfolioUrl = `${window.location.origin}/portfolio`;
    if (navigator.share) {
      navigator.share({
        title: `${this.profileData.fullName} - Portfolio`,
        text: 'Check out my professional portfolio',
        url: portfolioUrl
      });
    } else {
      navigator.clipboard.writeText(portfolioUrl);
      alert('Portfolio link copied to clipboard!');
    }
  }

  openContact(): void {
    if (this.profileData.email) {
      window.location.href = `mailto:${this.profileData.email}`;
    } else {
      console.log('No email available');
    }
  }

  downloadCertificate(certificate: Certificate): void {
    if (certificate.downloadUrl) {
      window.open(certificate.downloadUrl, '_blank');
    } else {
      alert('Certificate download link not available');
    }
  }

  openProject(project: Project): void {
    if (project.liveDemo) {
      window.open(project.liveDemo, '_blank');
    }
  }

  openGithub(project: Project): void {
    if (project.githubLink) {
      window.open(project.githubLink, '_blank');
    }
  }
}