import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CvService, CV } from '../../../../../services/cv.service';
import { AuthService } from '../../../../../services/auth.service';

interface Skill {
  name: string;
  type: 'technical' | 'soft';
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
}

interface Certification {
  title: string;
  organization: string;
  completionDate: string;
  badgeUrl?: string;
  certificateUrl?: string;
}

interface Experience {
  title: string;
  company: string;
  duration: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
  achievements: string[];
  companyLogo?: string;
}

interface Education {
  degree: string;
  institution: string;
  graduationDate: string;
  coursework?: string[];
  gpa?: string;
}

interface Project {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
}

interface Recommendation {
  name: string;
  position: string;
  company: string;
  text: string;
  date: string;
}

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

interface WorkSample {
  name: string;
  type: string;
  size: string;
  url: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  isLoading = true;
  currentCV: CV | null = null;

  // Profile Data
  profile = {
    fullName: '',
    title: '',
    location: '',
    email: '',
    phone: '',
    profileCompletion: 0,
    profileImage: 'assets/images/profile-placeholder.jpg',
    about: ''
  };

  technicalSkills: Skill[] = [];
  softSkills: Skill[] = [];
  certifications: Certification[] = [];
  experiences: Experience[] = [];
  education: Education[] = [];
  projects: Project[] = [];
  recommendations: Recommendation[] = [];
  socialLinks: SocialLink[] = [];
  workSamples: WorkSample[] = [];
https: any;

  constructor(
    private cvService: CvService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadCVData();
  }

  private loadUserProfile(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.profile.fullName = user.name || '';
      this.profile.email = user.email || '';
      this.profile.title = user.user_type === 'jobseeker' ? 'Job Seeker' : 'Professional';
    }
  }

  private loadCVData(): void {
    this.cvService.getMyCVs().subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          // Get the most recent final CV, or draft if no final exists
          const finalCV = response.data.find(cv => cv.status === 'final');
          this.currentCV = finalCV || response.data[0];
          
          this.populateProfileFromCV(this.currentCV);
        } else {
          console.log('No CV found for user');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading CV data:', error);
        this.isLoading = false;
      }
    });
  }

  private populateProfileFromCV(cv: CV): void {
    const cvData = cv.cvData;

    // Personal Information
    if (cvData.personalInfo) {
      this.profile.fullName = cvData.personalInfo.fullName || this.profile.fullName;
      this.profile.email = cvData.personalInfo.email || this.profile.email;
      this.profile.phone = cvData.personalInfo.phone || '';
      this.profile.location = cvData.personalInfo.address || '';
      this.profile.about = cvData.personalInfo.professionalSummary || '';
      
      // Build social links from personal info
      this.socialLinks = [];
      if (cvData.personalInfo.linkedIn) {
        this.socialLinks.push({
          platform: 'LinkedIn',
          url: cvData.personalInfo.linkedIn,
          icon: 'fab fa-linkedin'
        });
      }
      if (cvData.personalInfo.website) {
        this.socialLinks.push({
          platform: 'Portfolio',
          url: cvData.personalInfo.website,
          icon: 'fas fa-globe'
        });
      }
    }

    // Skills - separate technical and soft skills
    if (cvData.skills && cvData.skills.length > 0) {
      this.technicalSkills = cvData.skills
        .filter(skill => skill.category === 'Technical' || skill.category === 'Programming')
        .map(skill => ({
          name: skill.name,
          type: 'technical' as const,
          level: skill.level as any
        }));

      this.softSkills = cvData.skills
        .filter(skill => skill.category === 'Communication' || skill.category === 'Management' || skill.category === 'Other')
        .map(skill => ({
          name: skill.name,
          type: 'soft' as const
        }));
    }

    // Education
    if (cvData.education && cvData.education.length > 0) {
      this.education = cvData.education.map(edu => ({
        degree: `${edu.degree}${edu.fieldOfStudy ? ' in ' + edu.fieldOfStudy : ''}`,
        institution: edu.institution,
        graduationDate: edu.endYear ? `${edu.endYear}-06-01` : new Date().toISOString(),
        gpa: edu.gpa,
        coursework: edu.achievements ? edu.achievements.split(',').map(a => a.trim()) : undefined
      }));
    }

    // Work Experience
    if (cvData.workExperience && cvData.workExperience.length > 0) {
      this.experiences = cvData.workExperience.map(work => {
        const start = new Date(work.startDate || '');
        const end = work.current ? new Date() : new Date(work.endDate || '');
        const duration = this.calculateDuration(start, end);

        return {
          title: work.position,
          company: work.company,
          duration: duration,
          startDate: work.startDate || '',
          endDate: work.current ? 'Present' : (work.endDate || ''),
          responsibilities: work.responsibilities ? work.responsibilities.split('\n').filter(r => r.trim()) : [],
          achievements: work.achievements ? work.achievements.split('\n').filter(a => a.trim()) : [],
          companyLogo: undefined
        };
      });
    }

    // Certifications
    if (cvData.certifications && cvData.certifications.length > 0) {
      this.certifications = cvData.certifications.map(cert => ({
        title: cert.name,
        organization: cert.issuer,
        completionDate: cert.dateIssued || new Date().toISOString(),
        badgeUrl: undefined,
        certificateUrl: cert.credentialId || undefined
      }));
    }

    // Projects
    if (cvData.projects && cvData.projects.length > 0) {
      this.projects = cvData.projects.map(proj => ({
        title: proj.name,
        description: proj.description || '',
        technologies: proj.technologies ? proj.technologies.split(',').map(t => t.trim()) : [],
        githubUrl: proj.githubLink || undefined,
        liveUrl: proj.demoLink || undefined,
        imageUrl: undefined
      }));
    }

    // Calculate profile completion
    this.calculateProfileCompletion();
  }

  private calculateDuration(start: Date, end: Date): string {
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years > 0 && remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
  }

  private calculateProfileCompletion(): void {
    let completedSections = 0;
    const totalSections = 8;

    if (this.profile.fullName && this.profile.email) completedSections++;
    if (this.profile.about) completedSections++;
    if (this.technicalSkills.length > 0 || this.softSkills.length > 0) completedSections++;
    if (this.education.length > 0) completedSections++;
    if (this.experiences.length > 0) completedSections++;
    if (this.certifications.length > 0) completedSections++;
    if (this.projects.length > 0) completedSections++;
    if (this.socialLinks.length > 0) completedSections++;

    this.profile.profileCompletion = Math.round((completedSections / totalSections) * 100);
  }

  // Methods
  downloadFile(fileUrl: string): void {
    if (fileUrl && fileUrl !== '#') {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.log('File URL not available:', fileUrl);
    }
  }

  viewCertificate(certificate: Certification): void {
    if (certificate.certificateUrl) {
      window.open(certificate.certificateUrl, '_blank');
    } else {
      console.log('Certificate URL not available for:', certificate.title);
    }
  }

  editProfile(): void {
    console.log('Navigating to CV Builder for profile editing...');
    // Navigate to CV builder
    window.location.href = '/cv-builder';
  }

  shareProfile(): void {
    if (navigator.share) {
      navigator.share({
        title: `${this.profile.fullName} - Profile`,
        text: `Check out ${this.profile.fullName}'s professional profile`,
        url: window.location.href,
      }).catch(err => console.log('Error sharing:', err));
    } else {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        alert('Profile URL copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy URL:', err);
      });
    }
  }

  getSkillColor(level: string): string {
    switch(level) {
      case 'Expert': return '#10b981';
      case 'Advanced': return '#3b82f6';
      case 'Intermediate': return '#f59e0b';
      case 'Beginner': return '#ef4444';
      default: return '#6b7280';
    }
  }

  getFileIcon(type: string): string {
    switch(type.toLowerCase()) {
      case 'pdf': return 'fas fa-file-pdf';
      case 'zip': return 'fas fa-file-archive';
      case 'figma': return 'fab fa-figma';
      case 'doc':
      case 'docx': return 'fas fa-file-word';
      case 'xls':
      case 'xlsx': return 'fas fa-file-excel';
      case 'ppt':
      case 'pptx': return 'fas fa-file-powerpoint';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return 'fas fa-file-image';
      default: return 'fas fa-file';
    }
  }
}