// portfolio.component.ts - COMPLETE WITH MOBILE SIDEBAR TOGGLE
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
  
  // Sidebar toggle methods for mobile - EXACT SAME AS OTHER COMPONENTS
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
  hasCVData = false; // Track if CV exists

  // User Profile Data - Enhanced
  profileData = {
    fullName: '',
    title: '',
    location: '',
    profilePicture: 'assets/images/default-avatar.png',
    coverBanner: '/assets/images/cover-banner.jpg',
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
    this.loadPortfolioData();
    this.startTestimonialCarousel();
  }

  private loadPortfolioData(): void {
    this.isLoading = true;

    this.portfolioService.getMyPortfolio().subscribe({
      next: (response: EnhancedPortfolioData) => {
        console.log('✅ Enhanced Portfolio Data Loaded:', response);
        
        // ✅ FIXED: Just check if cvId exists (don't check success property)
        if (response.cvId) {
          console.log('✅ CV found:', response.cvId);
          this.hasCVData = true;
          
          // Set current CV
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
        
        // ✅ ALWAYS populate portfolio data (CV is optional)
        this.populatePortfolioFromData(response);
        this.viewCount = response.viewCount || 0;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading portfolio data:', error);
        
        // ✅ FIXED: Don't show alert for "No CV found" - it's expected!
        const errorMessage = error.error?.message || error.message || '';
        const isNoCVError = error.status === 404 || 
                           errorMessage.includes('No CV found') || 
                           errorMessage.includes('CV not found');
        
        if (isNoCVError) {
          console.log('ℹ️ No CV found - this is normal, loading profile data only');
          this.hasCVData = false;
          
          // Load basic profile data even without CV
          this.loadBasicProfileData();
        } else {
          // Only show alert for actual errors (not missing CV)
          console.error('Unexpected error:', error);
          alert('Failed to load portfolio. Please try again.');
        }
        
        this.isLoading = false;
      }
    });
  }

  // ✅ NEW: Load basic profile data when no CV exists
  private loadBasicProfileData(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.profileData.fullName = currentUser.name || '';
      this.profileData.email = currentUser.email || '';
      this.profileData.title = 'Professional';
      this.profileData.location = 'Kenya';
      
      console.log('✅ Loaded basic profile data from auth');
    }
  }

  private populatePortfolioFromData(data: any): void {
    // ✅ FIXED: Handle case where data might not have all fields
    const cvData = data.cvData || {};
    const profileData = data.profileData || {};

    console.log('🔄 Populating portfolio...');
    console.log('Profile Data:', profileData);
    console.log('CV Data:', cvData);
    console.log('Has CV:', this.hasCVData);

    // ✅ PRIORITY 1: Use profile data (from profile component) as primary source
    this.profileData.fullName = profileData.name || this.authService.getCurrentUser()?.name || '';
    this.profileData.email = profileData.email || this.authService.getCurrentUser()?.email || '';
    this.profileData.phone = profileData.phone || '';
    this.profileData.location = profileData.location || 'Kenya';
    this.profileData.bio = profileData.bio || 'Complete your profile to add a professional summary.';
    this.profileData.yearsOfExperience = profileData.years_of_experience || 0;
    
    // ✅ Social Links from profile
    this.profileData.linkedIn = profileData.linkedin_url || '';
    this.profileData.github = profileData.github_url || '';
    this.profileData.website = profileData.website_url || '';

    // ✅ CRITICAL: Profile Image - Use profile data first, fallback to CV
    if (profileData.profile_image) {
      this.profileData.profilePicture = this.getFullImageUrl(profileData.profile_image);
      console.log('✅ Using profile image:', this.profileData.profilePicture);
    } else if (this.hasCVData) {
      // Fallback to CV image only if CV exists
      const cvPersonalInfo = cvData.personalInfo || cvData.personal_info || {};
      if (cvPersonalInfo?.profileImage || cvPersonalInfo?.profile_image) {
        const cvImage = cvPersonalInfo.profileImage || cvPersonalInfo.profile_image;
        this.profileData.profilePicture = this.getFullImageUrl(cvImage);
        console.log('⚠️ Using CV fallback image:', this.profileData.profilePicture);
      } else {
        this.profileData.profilePicture = 'assets/images/default-avatar.png';
        console.log('ℹ️ Using default avatar');
      }
    } else {
      this.profileData.profilePicture = 'assets/images/default-avatar.png';
      console.log('ℹ️ No CV, using default avatar');
    }

    // Generate title from profile or CV
    if (profileData.current_position) {
      this.profileData.title = profileData.current_position;
    } else {
      this.profileData.title = this.generateTitle(cvData, profileData);
    }

    // ✅ Skills - Load from profile OR CV
    this.skills = [];
    
    // Add profile skills first (these are user-selected and more current)
    if (profileData.skills && profileData.skills.length > 0) {
      this.skills = profileData.skills.map((skillName: string) => ({
        name: skillName,
        category: this.categorizeSkill(skillName)
      }));
      console.log('✅ Loaded skills from profile:', this.skills.length);
    }
    
    // Add CV skills if profile skills are empty AND CV exists
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

    // ✅ Only load CV-specific sections if CV exists
    if (this.hasCVData) {
      // Work Experience from CV
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

      // Certifications from CV
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

      // Projects from CV
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

    // Generate testimonials if none exist
    if (this.testimonials.length === 0) {
      this.generateTestimonials(cvData);
    }

    console.log('✅ Portfolio population complete');
  }

  private getFullImageUrl(imagePath: string): string {
    if (!imagePath) return 'assets/images/default-avatar.png';
    
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

  onImageError(event: any): void {
    console.log('❌ Profile image load error, using fallback');
    event.target.src = 'assets/images/default-avatar.png';
  }

  private generateTitle(cvData: any, profileData: any): string {
    // Priority 1: Profile current position
    if (profileData.current_position) {
      return profileData.current_position;
    }

    // Priority 2: Latest work experience from CV (only if CV exists)
    if (this.hasCVData) {
      const workExp = cvData.workExperience || cvData.work_experience || [];
      if (workExp.length > 0) {
        return workExp[0].position;
      }
    }

    // Priority 3: Generate from skills
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