// profile.component.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProfileService, PortfolioData, Skill, WorkExperience, Education, Certification, Project, Testimonial } from '../../../../../services/profile.service';
import { AuthService } from '../../../../../services/auth.service';
import { environment } from '../../../../environments/environments';

interface ProfileDisplay {
  fullName: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  profileCompletion: number;
  profileImage: string;
  about: string;
  linkedIn?: string;
  website?: string;
  github?: string;
}

interface SkillDisplay {
  name: string;
  type: 'technical' | 'soft';
  level?: string;
  category?: string;
}

interface ExperienceDisplay {
  title: string;
  company: string;
  duration: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
  achievements: string[];
  companyLogo?: string;
}

interface EducationDisplay {
  degree: string;
  institution: string;
  graduationDate: string;
  coursework?: string[];
  gpa?: string;
}

interface ProjectDisplay {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
}

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

interface Field {
  field: string;
  completed: boolean;
  required: boolean;
}

interface Section {
  name: string;
  completed: boolean;
  weight: number;
  fields: Field[];  // Now always present
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileData: any;
  copyLinkDirect(_t96: HTMLInputElement) {
    throw new Error('Method not implemented.');
  }
  hideToast() {
    throw new Error('Method not implemented.');
  }

  isLoading = true;
  portfolioData: PortfolioData | null = null;
  shareableUrl: string = '';
  isPublic: boolean = false;

  // Profile Data
  profile: ProfileDisplay = {
    fullName: '',
    title: '',
    location: '',
    email: '',
    phone: '',
    profileCompletion: 0,
    profileImage: 'assets/images/profile-placeholder.jpg',
    about: ''
  };

  technicalSkills: SkillDisplay[] = [];
  softSkills: SkillDisplay[] = [];
  certifications: EducationDisplay[] = [];
  experiences: ExperienceDisplay[] = [];
  education: EducationDisplay[] = [];
  projects: ProjectDisplay[] = [];
  recommendations: Testimonial[] = [];
  socialLinks: SocialLink[] = [];
  viewCount: number = 0;
  showToast: boolean = false;
  private toastTimeout: any;

  // Completion Data
  completedSections: Section[] = [];
  missingFields: string[] = [];
  completionRecommendations: string[] = [];

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPortfolioData();
  }

  private loadPortfolioData(): void {
    this.isLoading = true;

    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.portfolioData = response.data;
          this.populateProfileFromPortfolio(response.data);
          this.loadShareableUrl();
        } else {
          console.error('No portfolio data found');
          this.showNoPortfolioMessage();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        if (error.status === 404 || error.error?.message?.includes('No CV found')) {
          this.showNoPortfolioMessage();
        }
        this.isLoading = false;
      }
    });
  }

  private showNoPortfolioMessage(): void {
    alert('No portfolio found. Please create a CV in the CV Builder first.');
    this.redirectToCVBuilder();
  }

  private populateProfileFromPortfolio(portfolio: PortfolioData): void {
    const cvData = portfolio.cvData;
    const personalInfo = cvData.personal_info || cvData.personal_info;

    // Personal Information
    if (personalInfo) {
      // PROFILE IMAGE - Get from CV data with proper URL handling
      const profileImage = personalInfo.profile_image || personalInfo.profile_image;
      if (profileImage) {
        this.profile.profileImage = this.getFullImageUrl(profileImage);
      } else {
        this.profile.profileImage = 'assets/images/profile-placeholder.jpg';
      }
      
      this.profile.fullName = personalInfo.full_name || personalInfo.full_name || '';
      this.profile.email = personalInfo.email || '';
      this.profile.phone = personalInfo.phone || '';
      this.profile.location = personalInfo.address || '';
      this.profile.about = personalInfo.professional_summary || personalInfo.professional_summary || '';
      this.profile.linkedIn = personalInfo.linkedin_url || personalInfo.linkedIn;
      this.profile.website = personalInfo.website_url || personalInfo.website;
      this.profile.github = personalInfo.github_url || personalInfo.github;

      // Extract title from first work experience if available
      const workExp = cvData.work_experience || cvData.work_experience || [];
      if (workExp.length > 0) {
        this.profile.title = workExp[0].position;
      }

      // Build social links
      this.buildSocialLinks(personalInfo);
    }

    // Skills - categorize by type
    if (cvData.skills && cvData.skills.length > 0) {
      const technicalCategories = ['Technical', 'Programming', 'Software', 'Tools', 'Languages'];
      
      this.technicalSkills = cvData.skills
        .filter(skill => 
          technicalCategories.some(cat => 
            skill.category?.toLowerCase().includes(cat.toLowerCase())
          )
        )
        .map(skill => ({
          name: skill.skill_name,
          type: 'technical' as const,
          level: skill.proficiency_level,
          category: skill.category
        }));

      this.softSkills = cvData.skills
        .filter(skill => 
          !technicalCategories.some(cat => 
            skill.category?.toLowerCase().includes(cat.toLowerCase())
          )
        )
        .map(skill => ({
          name: skill.skill_name,
          type: 'soft' as const,
          category: skill.category
        }));
    }

    // Education
    if (cvData.education && cvData.education.length > 0) {
      this.education = cvData.education.map(edu => ({
        degree: edu.degree,
        institution: edu.institution,
        graduationDate: edu.end_date || edu.start_date,
        gpa: edu.gpa,
        coursework: edu.coursework ? edu.coursework.split(',').map(c => c.trim()) : undefined
      }));
    }

    // Work Experience
    if (cvData.work_experience && cvData.work_experience.length > 0) {
      this.experiences = cvData.work_experience.map(work => {
        const duration = this.calculateDuration(work.start_date, work.end_date, work.is_current);

        return {
          title: work.position,
          company: work.company,
          duration: duration,
          startDate: work.start_date,
          endDate: work.is_current ? 'Present' : (work.end_date || ''),
          responsibilities: work.responsibilities ? 
            work.responsibilities.split('\n').filter(r => r.trim()) : [],
          achievements: work.achievements ? 
            work.achievements.split('\n').filter(a => a.trim()) : [],
          companyLogo: work.company_logo
        };
      });
    }

    // Certifications
    if (cvData.certifications && cvData.certifications.length > 0) {
      this.certifications = cvData.certifications.map(cert => ({
        degree: cert.certification_name,
        institution: cert.issuer,
        graduationDate: cert.date_issued,
        coursework: cert.credential_url ? [cert.credential_url] : undefined
      }));
    }

    // Projects
    if (cvData.projects && cvData.projects.length > 0) {
      this.projects = cvData.projects.map(proj => ({
        title: proj.project_name,
        description: proj.description || '',
        technologies: proj.technologies ? 
          proj.technologies.split(',').map(t => t.trim()) : [],
        githubUrl: proj.github_url,
        liveUrl: proj.project_url,
        imageUrl: proj.image_url
      }));
    }

    // Testimonials/Recommendations
    if (portfolio.testimonials && portfolio.testimonials.length > 0) {
      this.recommendations = portfolio.testimonials;
    }

    // View count
    this.viewCount = portfolio.viewCount || 0;

    // Portfolio settings
    this.isPublic = portfolio.settings?.is_public || false;

    // Initialize completion data and calculate percentage based on fields
    this.initializeCompletionData();
    this.profile.profileCompletion = this.calculateCompletionPercentage();
  }

  // Add helper method to get full image URL
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

  // Add image error handler
  handleImageError(event: any): void {
    console.log('Profile image load error, using fallback');
    event.target.src = 'assets/images/profile-placeholder.jpg';
  }

  private initializeCompletionData(): void {
    // Basic Information with multiple fields
    const basicFields: Field[] = [
      { field: 'Full Name', completed: !!this.profile.fullName, required: true },
      { field: 'Email', completed: !!this.profile.email, required: true },
      { field: 'Phone Number', completed: !!this.profile.phone, required: true },
      { field: 'Profile Picture', completed: !!this.profile.profileImage && this.profile.profileImage !== 'assets/images/profile-placeholder.jpg', required: false },
      { field: 'Location', completed: !!this.profile.location, required: false }
    ];

    this.completedSections = [
      {
        name: 'Basic Information',
        completed: basicFields.every(f => f.completed),
        weight: 20,
        fields: basicFields
      },
      {
        name: 'Professional Summary',
        completed: !!this.profile.about && this.profile.about.trim().length > 0,
        weight: 15,
        fields: [{ field: 'Professional Summary', completed: !!this.profile.about && this.profile.about.trim().length > 0, required: true }]
      },
      {
        name: 'Skills',
        completed: (this.technicalSkills.length + this.softSkills.length) > 0,
        weight: 15,
        fields: [{ field: 'Skills Section', completed: (this.technicalSkills.length + this.softSkills.length) > 0, required: true }]
      },
      {
        name: 'Work Experience',
        completed: this.experiences.length > 0,
        weight: 20,
        fields: [{ field: 'Work Experience Section', completed: this.experiences.length > 0, required: true }]
      },
      {
        name: 'Education',
        completed: this.education.length > 0,
        weight: 15,
        fields: [{ field: 'Education Section', completed: this.education.length > 0, required: true }]
      },
      {
        name: 'Certifications',
        completed: this.certifications.length > 0,
        weight: 5,
        fields: [{ field: 'Certifications Section', completed: this.certifications.length > 0, required: true }]
      },
      {
        name: 'Projects',
        completed: this.projects.length > 0,
        weight: 5,
        fields: [{ field: 'Projects Section', completed: this.projects.length > 0, required: true }]
      },
      {
        name: 'Social Links',
        completed: this.socialLinks.length > 0,
        weight: 5,
        fields: [{ field: 'Social Links Section', completed: this.socialLinks.length > 0, required: false }]
      }
    ];

    // Missing fields: collect incomplete field names from all sections
    this.missingFields = this.completedSections
      .flatMap(section => section.fields.filter(f => !f.completed).map(f => f.field))
      .filter((field, index, self) => self.indexOf(field) === index);  // Unique

    // Simple recommendations based on missing fields
    this.completionRecommendations = [
      '🎯 Almost there! Add more details to reach 100% completion and stand out to employers',
      ...(this.missingFields.includes('Professional Summary') ? ['Add a compelling professional summary to introduce yourself to employers'] : []),
      ...(this.missingFields.includes('Certifications Section') ? ['Consider adding professional certifications to strengthen your profile'] : [])
    ].slice(0, 3); // Limit to 3
  }

  private calculateCompletionPercentage(): number {
    let totalFilled = 0;
    let totalFields = 0;

    this.completedSections.forEach(section => {
      const filled = this.getCompletedFieldsCount(section);
      const total = this.getTotalFields(section);
      totalFilled += filled;
      totalFields += total;
    });

    return totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;
  }

  getCompletedFieldsCount(section: Section): number {
    return section.fields.filter(f => f.completed).length;
  }

  getTotalFields(section: Section): number {
    return section.fields.length;
  }

  getIncompleteFields(section: Section): Field[] {
    return section.fields.filter(f => !f.completed);
  }

  // NEW: Check if profile is complete (you can adjust the threshold as needed)
  isProfileComplete(): boolean {
    return this.profile.profileCompletion >= 80; // 80% or higher considered complete
  }


  // NEW: Complete Profile Action - Navigate to CV Manager
  completeProfile(): void {
    console.log('Navigating to CV Manager to complete profile...');
    this.router.navigate(['jobseeker/cv-manager']); // Changed from cv-builder to match your routing
  }

  // NEW: Redirect to CV Manager
  private redirectToCVBuilder(): void {
    console.log('Redirecting to CV Manager to complete profile...');
    this.router.navigate(['jobseeker/cv-manager']); // Changed from cv-builder to match your routing
  }

  // Image Upload Methods
  triggerImageUpload(): void {
    this.fileInput.nativeElement.click();
  }

  handleImageUpload(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      // Preview the image locally
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profile.profileImage = e.target.result; // Base64 for preview
      };
      reader.readAsDataURL(file);

      // Upload to server
      this.uploadProfileImage(file);
    } else {
      alert('Please select a valid image file.');
    }
  }

  private uploadProfileImage(file: File): void {
    this.isLoading = true;
    this.profileService.uploadProfileImage(file).subscribe({
      next: (response) => {
        if (response.success) {
          this.profile.profileImage = response.imageUrl ?? 'assets/images/profile-placeholder.jpg'; // Update with server URL or fallback
          this.initializeCompletionData(); // Recompute completion
          this.profile.profileCompletion = this.calculateCompletionPercentage();
          alert('Profile image updated successfully!');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
        this.isLoading = false;
      }
    });
  }

  private buildSocialLinks(personalInfo: any): void {
    this.socialLinks = [];

    if (personalInfo.linkedin_url || personalInfo.linkedIn) {
      this.socialLinks.push({
        platform: 'LinkedIn',
        url: personalInfo.linkedin_url || personalInfo.linkedIn,
        icon: 'fab fa-linkedin'
      });
    }

    if (personalInfo.github_url || personalInfo.github) {
      this.socialLinks.push({
        platform: 'GitHub',
        url: personalInfo.github_url || personalInfo.github,
        icon: 'fab fa-github'
      });
    }

    if (personalInfo.website_url || personalInfo.website) {
      this.socialLinks.push({
        platform: 'Website',
        url: personalInfo.website_url || personalInfo.website,
        icon: 'fas fa-globe'
      });
    }
  }

  private calculateDuration(startDate: string, endDate: string | undefined, isCurrent: boolean): string {
    const start = new Date(startDate);
    const end = isCurrent ? new Date() : (endDate ? new Date(endDate) : new Date());
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                   (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years > 0 && remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${remainingMonths || 1} month${remainingMonths > 1 ? 's' : ''}`;
    }
  }

  private loadShareableUrl(): void {
    this.profileService.getShareableUrl().subscribe({
      next: (result) => {
        this.shareableUrl = result.url;
        this.isPublic = result.isPublic;
      },
      error: (error) => {
        console.error('Error generating shareable URL:', error);
      }
    });
  }

  // Action Methods
  editProfile(): void {
    console.log('Navigating to CV Builder for profile editing...');
    this.router.navigate(['jobseeker/cv-builder']);
  }

  shareProfile(): void {
    // Check if profile is complete before allowing sharing
    if (!this.isProfileComplete()) {
      const proceed = confirm('Your profile is not complete yet. A complete profile makes a better impression on employers. Would you like to complete your profile first?');
      if (proceed) {
        this.completeProfile();
        return;
      }
    }

    console.log('Share Profile clicked');
    console.log('Current shareableUrl:', this.shareableUrl);
    console.log('Is Public:', this.isPublic);

    // If URL is not generated yet, try to load it
    if (!this.shareableUrl) {
      alert('Generating your shareable link. Please wait a moment...');
      this.loadShareableUrl();
      setTimeout(() => {
        if (this.shareableUrl) {
          this.shareProfile();
        } else {
          alert('Unable to generate shareable link. Please try again or contact support.');
        }
      }, 2000);
      return;
    }

    // If portfolio is private, ask to make it public
    if (!this.isPublic) {
      const makePublic = confirm('Your portfolio is currently private. Would you like to make it public to share it?');
      if (makePublic) {
        this.profileService.togglePortfolioVisibility(true).subscribe({
          next: (response) => {
            if (response.success) {
              this.isPublic = true;
              console.log('Portfolio is now public');
              // Reload shareable URL after making public
              this.loadShareableUrl();
              setTimeout(() => {
                this.copyShareLink();
              }, 1000);
            }
          },
          error: (error) => {
            console.error('Error making portfolio public:', error);
            alert('Failed to make portfolio public. Please try again.');
          }
        });
      }
      return;
    }

    // Portfolio is public and URL is ready, proceed with sharing
    this.copyShareLink();
  }

  private copyShareLink(): void {
    console.log('Attempting to share/copy:', this.shareableUrl);

    // Try native share API first (works on mobile and some desktop browsers)
    if (navigator.share && this.isMobileDevice()) {
      console.log('Using native share API');
      navigator.share({
        title: `${this.profile.fullName} - Professional Portfolio`,
        text: `Check out ${this.profile.fullName}'s professional portfolio`,
        url: this.shareableUrl,
      })
      .then(() => {
        console.log('Successfully shared via native API');
      })
      .catch(err => {
        console.log('Native share cancelled or failed:', err);
        // User cancelled or share failed, fall back to clipboard
        this.copyToClipboard();
      });
    } else {
      console.log('Native share not available, using clipboard');
      this.copyToClipboard();
    }
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private copyToClipboard(): void {
    console.log('Attempting clipboard copy');

    // Modern Clipboard API (most secure and recommended)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(this.shareableUrl)
        .then(() => {
          console.log('Clipboard copy successful');
          this.showSuccessMessage();
        })
        .catch(err => {
          console.error('Clipboard API failed:', err);
          this.fallbackCopyTextToClipboard(this.shareableUrl);
        });
    } else {
      console.log('Clipboard API not available, using fallback');
      this.fallbackCopyTextToClipboard(this.shareableUrl);
    }
  }

  private showSuccessMessage(): void {
    const message = `✅ Portfolio link copied to clipboard!\n\n${this.shareableUrl}\n\nYou can now paste and share this link with:\n• Recruiters and employers\n• LinkedIn contacts\n• WhatsApp groups\n• Email applications\n• Social media platforms`;
    alert(message);
  }

  private fallbackCopyTextToClipboard(text: string): void {
    console.log('Using fallback copy method');
    
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible and out of viewport
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      console.log('Fallback copy result:', successful);
      
      if (successful) {
        this.showSuccessMessage();
      } else {
        this.showLinkManually(text);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.showLinkManually(text);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  private showLinkManually(text: string): void {
    const message = `📋 Your shareable portfolio link:\n\n${text}\n\n⚠️ Automatic copy failed. Please copy this link manually by:\n1. Selecting the link above\n2. Press Ctrl+C (Windows) or Cmd+C (Mac)\n3. Paste it wherever you want to share\n\nShare with recruiters, employers, and your network!`;
    
    // Create a prompt with the link for easy manual copying
    const userAction = prompt(message, text);
    if (userAction !== null) {
      alert('Great! Now you can paste the link wherever you want to share your portfolio.');
    }
  }

  togglePortfolioVisibility(): void {
    const newVisibility = !this.isPublic;
    
    this.profileService.togglePortfolioVisibility(newVisibility).subscribe({
      next: (response) => {
        if (response.success) {
          this.isPublic = newVisibility;
          alert(`Portfolio is now ${newVisibility ? 'public' : 'private'}`);
          if (newVisibility) {
            // Reload shareable URL after making public
            this.loadShareableUrl();
          }
        }
      },
      error: (error) => {
        console.error('Error toggling portfolio visibility:', error);
        alert('Failed to update portfolio visibility. Please try again.');
      }
    });
  }

  viewCertificate(certification: EducationDisplay): void {
    if (certification.coursework && certification.coursework.length > 0) {
      const url = certification.coursework[0];
      if (url && url !== '#') {
        window.open(url, '_blank');
      }
    } else {
      console.log('Certificate URL not available for:', certification.degree);
    }
  }

  downloadFile(fileUrl: string): void {
    if (fileUrl && fileUrl !== '#') {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = '';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      console.log('File URL not available:', fileUrl);
    }
  }

  // UI Helper Methods
  getSkillColor(level?: string): string {
    if (!level) return '#6b7280';
    
    switch(level.toLowerCase()) {
      case 'expert':
      case 'advanced': return '#10b981';
      case 'intermediate': return '#3b82f6';
      case 'beginner':
      case 'basic': return '#f59e0b';
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

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  getSkillsByCategory(): Map<string, SkillDisplay[]> {
    const categorized = new Map<string, SkillDisplay[]>();
    
    [...this.technicalSkills, ...this.softSkills].forEach(skill => {
      const category = skill.category || 'General';
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      categorized.get(category)!.push(skill);
    });

    return categorized;
  }

  get hasCompletedProfile(): boolean {
    return this.profile.profileCompletion >= 70;
  }

  get profileCompletionColor(): string {
    if (this.profile.profileCompletion >= 80) return '#10b981';
    if (this.profile.profileCompletion >= 50) return '#f59e0b';
    return '#ef4444';
  }

getCompletionColor(percentage: number): string {
  // Red until 100% complete, then green
  if (percentage === 100) return 'completion-green';
  return 'completion-red';
}

getProgressColor(percentage: number): string {
  // Red until 100% complete
  if (percentage === 100) return '#10b981'; // Green when complete
  return '#ef4444'; // Red when incomplete
}
}