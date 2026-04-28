// portfolio.component.ts - FIXED VERSION with correct image handling
import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common'; 
import { CommonModule } from '@angular/common';
import { CvService, CV } from '../../../../../services/cv.service';
import { AuthService } from '../../../../../services/auth.service';
import { PortfolioService, EnhancedPortfolioData } from '../../../../../services/portfolio.service';
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
  
  // Sidebar toggle methods for mobile
  toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');

    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
    hamburger?.classList.toggle('active');
  }

  closeSidebar(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger');

    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    hamburger?.classList.remove('active');
  }
  
  isLoading = true;
  currentCV: CV | null = null;
  hasCVData = false;

  // ✅ FIXED: Use reliable default image
  profileData = {
    fullName: '',
    title: '',
    location: '',
    profilePicture: 'https://ui-avatars.com/api/?name=User&size=200&background=4F46E5&color=fff',
    coverBanner: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
    bio: '',
    email: '',
    phone: '',
    linkedIn: '',
    github: '',
    website: '',
    yearsOfExperience: 0
  };

  trainingExperiences: Training[] = [];
  certificates: Certificate[] = [];
  projects: Project[] = [];
  skills: Skill[] = [];
  testimonials: Testimonial[] = [];

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
    this.loadPortfolioData();
    this.startTestimonialCarousel();
  }

  private loadPortfolioData(): void {
    this.isLoading = true;

    this.portfolioService.getMyPortfolio().subscribe({
      next: (response: EnhancedPortfolioData) => {
        console.log('✅ Enhanced Portfolio Data Loaded:', response);
        
        if (response.cvId) {
          console.log('✅ CV found:', response.cvId);
          this.hasCVData = true;
          
          this.currentCV = {
            id: response.cvId,
            userId: response.userId,
            status: 'final',
            cvData: response.cvData,
            createdAt: response.createdAt,
            updatedAt: response.updatedAt
          };
        } else {
          console.log('ℹ️ No CV ID in response - using profile data only');
          this.hasCVData = false;
        }
        
        this.populatePortfolioFromData(response);
        this.viewCount = response.viewCount || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading portfolio data:', error);
        
        const errorMessage = error.error?.message || error.message || '';
        const isNoCVError = error.status === 404 || 
                           errorMessage.includes('No CV found') || 
                           errorMessage.includes('CV not found');
        
        if (isNoCVError) {
          console.log('ℹ️ No CV found - this is normal, loading profile data only');
          this.hasCVData = false;
          this.loadBasicProfileData();
        } else {
          console.error('Unexpected error:', error);
          alert('Failed to load portfolio. Please try again.');
        }
        
        this.isLoading = false;
      }
    });
  }

  private loadBasicProfileData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.profileData.fullName = currentUser.name || '';
      this.profileData.email = currentUser.email || '';
      this.profileData.title = 'Professional';
      this.profileData.location = 'Kenya';
      
      // ✅ FIXED: Generate avatar with user's name
      this.profileData.profilePicture = this.generateAvatarUrl(this.profileData.fullName);
      
      console.log('✅ Loaded basic profile data from auth');
    }
  }

  // ✅ NEW: Generate avatar URL using UI Avatars API
  private generateAvatarUrl(name: string): string {
    const displayName = name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=200&background=4F46E5&color=fff&bold=true`;
  }

  private populatePortfolioFromData(data: any): void {
    const cvData = data.cvData || {};
    const profileData = data.profileData || {};

    console.log('🔄 Populating portfolio...');
    console.log('Profile Data:', profileData);
    console.log('CV Data:', cvData);
    console.log('Has CV:', this.hasCVData);

    // Set basic profile data
    this.profileData.fullName = profileData.name || this.authService.getCurrentUser()?.name || '';
    this.profileData.email = profileData.email || this.authService.getCurrentUser()?.email || '';
    this.profileData.phone = profileData.phone || '';
    this.profileData.location = profileData.location || 'Kenya';
    this.profileData.bio = profileData.bio || 'Complete your profile to add a professional summary.';
    this.profileData.yearsOfExperience = profileData.years_of_experience || 0;
    
    // Social Links
    this.profileData.linkedIn = profileData.linkedin_url || '';
    this.profileData.github = profileData.github_url || '';
    this.profileData.website = profileData.website_url || '';

    // ✅ FIXED: Profile Image with proper fallback
    if (profileData.profile_image) {
      this.profileData.profilePicture = this.getFullImageUrl(profileData.profile_image);
      console.log('✅ Using profile image:', this.profileData.profilePicture);
    } else if (this.hasCVData) {
      const cvPersonalInfo = cvData.personalInfo || cvData.personal_info || {};
      if (cvPersonalInfo?.profileImage || cvPersonalInfo?.profile_image) {
        const cvImage = cvPersonalInfo.profileImage || cvPersonalInfo.profile_image;
        this.profileData.profilePicture = this.getFullImageUrl(cvImage);
        console.log('⚠️ Using CV fallback image:', this.profileData.profilePicture);
      } else {
        this.profileData.profilePicture = this.generateAvatarUrl(this.profileData.fullName);
        console.log('ℹ️ Using generated avatar');
      }
    } else {
      this.profileData.profilePicture = this.generateAvatarUrl(this.profileData.fullName);
      console.log('ℹ️ No CV, using generated avatar');
    }

    // Generate title
    if (profileData.current_position) {
      this.profileData.title = profileData.current_position;
    } else {
      this.profileData.title = this.generateTitle(cvData, profileData);
    }

    // Skills
    this.skills = [];
    
    if (profileData.skills && profileData.skills.length > 0) {
      this.skills = profileData.skills.map((skillName: string) => ({
        name: skillName,
        category: this.categorizeSkill(skillName)
      }));
      console.log('✅ Loaded skills from profile:', this.skills.length);
    }
    
    if (this.skills.length === 0 && this.hasCVData) {
      let cvSkills = cvData.skills || cvData.skill || cvData.Skills || [];
      if (Array.isArray(cvSkills) && cvSkills.length > 0) {
        this.skills = cvSkills.map((skill: any) => ({
          name: skill.skill_name || skill.skillName || skill.name || '',
          category: skill.category || skill.skill_category || 'General'
        })).filter((skill: Skill) => skill.name && skill.name.trim() !== '');
        console.log('⚠️ Loaded skills from CV (fallback):', this.skills.length);
      }
    }

    // Load CV-specific sections only if CV exists
    if (this.hasCVData) {
      // Work Experience
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
        console.log('✅ Loaded work experiences:', this.trainingExperiences.length);
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
        console.log('✅ Loaded certifications:', this.certificates.length);
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
            thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=300&fit=crop',
            liveDemo: proj.demoLink || proj.demo_link || undefined,
            githubLink: proj.githubLink || proj.github_link || undefined
          };
        });

        this.updateProjectCategories();
        this.filteredProjects = this.projects;
        console.log('✅ Loaded projects:', this.projects.length);
      }
    } else {
      console.log('ℹ️ No CV data - skipping work experience, certifications, and projects');
    }

    // Testimonials
    if (data.testimonials && data.testimonials.length > 0) {
      this.testimonials = data.testimonials.map((t: any, index: number) => ({
        id: t.id || index + 1,
        text: t.text || t.content || '',
        author: t.author || '',
        position: t.position || t.role || ''
      }));
      console.log('✅ Loaded testimonials:', this.testimonials.length);
    }

    if (this.testimonials.length === 0) {
      this.generateTestimonials(cvData);
    }

    console.log('✅ Portfolio population complete');
  }

  // ✅ FIXED: Proper image URL handling with reliable fallback
  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) {
      return this.generateAvatarUrl(this.profileData.fullName);
    }
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // If it's a base64 image, return as is
    if (imagePath.startsWith('data:image')) {
      return imagePath;
    }
    
    // If it's a relative path, construct full URL
    if (imagePath.startsWith('/uploads') || imagePath.startsWith('uploads')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
    }
    
    return imagePath;
  }

  // ✅ FIXED: Reliable error handler
  onImageError(event: any): void {
    console.log('❌ Profile image load error, using fallback avatar');
    event.target.src = this.generateAvatarUrl(this.profileData.fullName);
  }

  private generateTitle(cvData: any, profileData: any): string {
    if (profileData.current_position) {
      return profileData.current_position;
    }

    if (this.hasCVData) {
      const workExp = cvData.workExperience || cvData.work_experience || [];
      if (workExp.length > 0) {
        return workExp[0].position;
      }
    }

    if (profileData.skills && profileData.skills.length > 0) {
      const topSkills = profileData.skills.slice(0, 3);
      return `${topSkills.join(' | ')} Specialist`;
    }

    if (this.hasCVData && cvData.skills && cvData.skills.length > 0) {
      const topSkills = cvData.skills.slice(0, 3).map((s: any) => s.name || s.skill_name);
      return `${topSkills.join(' | ')} Specialist`;
    }

    return 'Professional';
  }

  private categorizeSkill(skillName: string): string {
    const tech = skillName.toLowerCase();
    
    if (tech.includes('javascript') || tech.includes('python') || tech.includes('java') || 
        tech.includes('react') || tech.includes('angular') || tech.includes('vue') ||
        tech.includes('node') || tech.includes('sql') || tech.includes('docker')) {
      return 'Technical';
    }
    if (tech.includes('communication') || tech.includes('leadership') || 
        tech.includes('teamwork') || tech.includes('management')) {
      return 'Soft Skills';
    }
    
    return 'General';
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
    
    if (this.hasCVData) {
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
    }

    if (this.testimonials.length === 0) {
      this.testimonials.push({
        id: 1,
        text: 'Excellent professional with great attention to detail and strong technical skills.',
        author: 'Professional Contact',
        position: 'Colleague'
      });
    }
  }

  filterProjects(category: string): void {
    this.selectedProjectCategory = category;
    if (category === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(project => project.category === category);
    }
  }

  startTestimonialCarousel(): void {
    setInterval(() => {
      if (this.testimonials.length > 0) {
        this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
      }
    }, 5000);
  }

  downloadCV(): void {
    if (this.currentCV && this.hasCVData) {
      const filename = `${this.profileData.fullName.replace(/\s+/g, '_')}_CV.pdf`;
      this.cvService.downloadCV(this.currentCV.id, 'pdf', filename);
    } else {
      alert('No CV available. You can upload a CV in the CV Builder to enable this feature.');
    }
  }

  downloadPortfolioPDF(): void {
    if (!this.hasCVData) {
      alert('Upload a CV first to download portfolio as PDF. Go to CV Builder to upload your CV.');
      return;
    }

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