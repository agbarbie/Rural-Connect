// portfolio.component.ts
import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common'; 
import { CommonModule } from '@angular/common';
import { CvService, CV } from '../../../../../services/cv.service';
import { AuthService } from '../../../../../services/auth.service';
import { PortfolioService, PortfolioData } from '../../../../../services/portfolio.service';
import { environment } from '../../../../environments/environments';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
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
  imports: [CommonModule, DatePipe, SidebarComponent],
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit {
  
  isLoading = true;
  currentCV: CV | null = null;

  // User Profile Data
  profileData = {
    fullName: '',
    title: '',
    location: '',
    profilePicture: 'assets/images/default-avatar.png',
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
        console.log('CV Data structure:', data.cvData);
        
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
    console.log('Personal Info:', cvData.personalInfo || cvData.personal_info);

    // Personal Information - Handle both personalInfo and personal_info formats
    if (cvData.personalInfo || cvData.personal_info) {
      const pi = cvData.personalInfo || cvData.personal_info;
      
      console.log('Profile Image from CV:', pi.profileImage || pi.profile_image);
      
      // PROFILE IMAGE - Get from CV data with proper URL handling
      const profileImage = pi.profileImage || pi.profile_image;
      if (profileImage) {
        this.profileData.profilePicture = this.getFullImageUrl(profileImage);
        console.log('Final profile picture URL:', this.profileData.profilePicture);
      } else {
        this.profileData.profilePicture = 'assets/images/default-avatar.png';
        console.log('Using default avatar');
      }
      
      this.profileData.fullName = pi.fullName || pi.full_name || this.profileData.fullName;
      this.profileData.email = pi.email || this.profileData.email;
      this.profileData.phone = pi.phone || '';
      this.profileData.location = pi.address || 'Kenya';
      this.profileData.bio = pi.professionalSummary || pi.professional_summary || '';
      this.profileData.title = this.generateTitle(cvData);
    }

    // Work Experience - Handle both formats
    const workExp = cvData.work_experience || cvData.workExperience || [];
    if (workExp.length > 0) {
      this.trainingExperiences = workExp.map((work: any, index: number) => ({
        id: index + 1,
        title: work.position,
        status: (work.is_current || work.current) ? 'in-progress' : 'completed',
        trainer: work.company,
        completionDate: (work.is_current || work.current) ? undefined : (work.end_date || work.endDate),
        description: work.responsibilities || ''
      }));
    }

    // Skills
    console.log('Processing skills...');
    this.skills = [];
    
    let skillsData = cvData.skills || cvData.skill || cvData.Skills || [];
    
    console.log('Found skills data:', skillsData);
    
    if (Array.isArray(skillsData) && skillsData.length > 0) {
      this.skills = skillsData.map((skill: any) => {
        const skillName = skill.skill_name || skill.skillName || skill.name || '';
        const skillCategory = skill.category || skill.skill_category || skill.skillCategory || 'General';
        
        return {
          name: skillName,
          category: skillCategory
        };
      }).filter((skill: Skill) => skill.name && skill.name.trim() !== '');
    }

    // Certifications
    const certs = cvData.certifications || [];
    if (certs.length > 0) {
      this.certificates = certs.map((cert: any, index: number): Certificate => ({
        id: index + 1,
        name: cert.name || cert.certification_name,
        issuer: cert.issuer,
        completionDate: cert.dateIssued || cert.date_issued || new Date().toISOString(),
        downloadUrl: cert.credentialId || cert.credential_id || undefined
      }));
    }

    // Projects
    const projects = cvData.projects || [];
    if (projects.length > 0) {
      this.projects = projects.map((proj: any, index: number): Project => {
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

    // Testimonials
    if (data.testimonials && data.testimonials.length > 0) {
      this.testimonials = data.testimonials.map((t, index) => ({
        id: t.id || index + 1,
        text: t.text || t.content || '',
        author: t.author || '',
        position: t.position || t.role || ''
      }));
    }

    // Generate testimonials if none exist
    if (this.testimonials.length === 0) {
      this.generateTestimonials(cvData);
    }
  }

  // Add helper method to get full image URL
  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/images/default-avatar.png';
    
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

  // Add image error handler
  onImageError(event: any): void {
    console.log('Profile image load error, using fallback');
    event.target.src = 'assets/images/default-avatar.png';
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