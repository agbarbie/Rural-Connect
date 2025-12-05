import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ProfileService, PortfolioData, Skill, WorkExperience, Education, Certification, Project, Testimonial, ProfileCompletionResponse, CompletedSection, ProfileResponse } from '../../../../../services/profile.service';
import { AuthService } from '../../../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

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
  yearsOfExperience: number;
  currentPosition: string;
  availabilityStatus: string;
  preferredJobTypes: string;
  preferredLocations: string;
  salaryMin: number | null;
  salaryMax: number | null;
  selectedSkills: string[]; // Array for selected skills
  socialLinksInput: { linkedin: string; github: string; website: string; };
}

interface SkillDisplay {
  name: string;
  type: 'technical' | 'soft' | 'other';
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
  field: any;
  key: string;
  label?: string;
  value?: any;
  required?: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  isLoading = true;
  isEditMode = false;
  isUploadingCV = false; // New: Track CV upload state
  showCVUpload = false; // New: Toggle for optional CV upload
  portfolioData: PortfolioData | null = null;
  shareableUrl: string = '';
  isPublic: boolean = false;

  // Predefined available skills
  availableTechnicalSkills: string[] = [
    'JavaScript', 'Python', 'Java', 'C++', 'React', 'Angular', 'Vue.js', 'Node.js',
    'SQL', 'MongoDB', 'AWS', 'Docker', 'Git', 'HTML', 'CSS', 'TypeScript',
    'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'C#', '.NET',
    'PostgreSQL', 'MySQL', 'Redis', 'Firebase', 'GraphQL', 'REST API',
    'Kubernetes', 'Jenkins', 'CI/CD', 'Agile', 'Scrum', 'DevOps'
  ];

  availableSoftSkills: string[] = [
    'Communication', 'Leadership', 'Teamwork', 'Problem Solving', 'Time Management',
    'Adaptability', 'Critical Thinking', 'Creativity', 'Emotional Intelligence',
    'Public Speaking', 'Negotiation', 'Conflict Resolution', 'Project Management',
    'Customer Service', 'Analytical Thinking', 'Attention to Detail',
    'Organization', 'Resilience', 'Empathy', 'Networking'
  ];

  newSkill: string = '';

  // Profile Data
  profile: ProfileDisplay = {
    fullName: '',
    title: '',
    location: '',
    email: '',
    phone: '',
    profileCompletion: 0,
    profileImage: 'assets/images/profile-placeholder.jpg',
    about: '',
    linkedIn: '',
    website: '',
    github: '',
    yearsOfExperience: 0,
    currentPosition: '',
    availabilityStatus: 'open_to_opportunities',
    preferredJobTypes: '',
    preferredLocations: '',
    salaryMin: null,
    salaryMax: null,
    selectedSkills: [],
    socialLinksInput: { linkedin: '', github: '', website: '' }
  };

  technicalSkills: SkillDisplay[] = [];
  softSkills: SkillDisplay[] = [];
  otherSkills: SkillDisplay[] = [];
  certifications: EducationDisplay[] = [];
  experiences: ExperienceDisplay[] = [];
  education: EducationDisplay[] = [];
  projects: ProjectDisplay[] = [];
  recommendations: Testimonial[] = [];
  socialLinks: SocialLink[] = [];
  viewCount: number = 0;
  showToast: boolean = false;
  private toastTimeout: any;

  // Completion Data - now from backend
  completedSections: CompletedSection[] = [];
  missingFields: string[] = [];
  completionRecommendations: string[] = [];

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cvFileInput') cvFileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfileData();
    this.loadProfileCompletion();
    // Load portfolio data if needed
    this.loadPortfolioData();
  }

  // Load profile data from backend
  private loadProfileData(): void {
    this.profileService.getMyProfile().subscribe({
      next: (response: ProfileResponse) => {
        if (response.success && response.data) {
          const data = response.data;
          this.profile.fullName = data.name || '';
          this.profile.email = data.email || '';
          this.profile.phone = data.phone || '';
          this.profile.location = data.location || '';
          this.profile.about = data.bio || '';
          this.profile.linkedIn = data.linkedin_url || '';
          this.profile.website = data.website_url || '';
          this.profile.github = data.github_url || '';
          this.profile.yearsOfExperience = data.years_of_experience || 0;
          this.profile.currentPosition = data.current_position || '';
          this.profile.availabilityStatus = data.availability_status || 'open_to_opportunities';
          // Parse JSONB/JSON fields
          this.profile.preferredJobTypes = this.parseJsonField(data.preferred_job_types, '\n');
          this.profile.preferredLocations = this.parseJsonField(data.preferred_locations, '\n');
         
          this.profile.salaryMin = data.salary_expectation_min || null;
          this.profile.salaryMax = data.salary_expectation_max || null;
          // Skills
          let skills: string[] = this.parseJsonArrayField(data.skills);
          this.profile.selectedSkills = skills;
          this.populateSkills(skills);
          // Social links input
          this.profile.socialLinksInput = {
            linkedin: this.profile.linkedIn || '',
            github: this.profile.github || '',
            website: this.profile.website || ''
          };
          this.buildSocialLinks();
        }
      },
      error: (error) => {
        console.error('Error loading profile data:', error);
      }
    });
  }

  // Helper to parse JSON array fields
  private parseJsonArrayField(field: any): string[] {
    if (!field) return [];
    try {
      if (typeof field === 'string') {
        return JSON.parse(field);
      }
      if (Array.isArray(field)) {
        return field;
      }
      return [];
    } catch {
      return [];
    }
  }

  // Helper to parse JSON field and join with separator
  private parseJsonField(field: any, separator: string = ', '): string {
    const arr = this.parseJsonArrayField(field);
    return arr.join(separator);
  }

  // Populate skills from array with proper categorization
  private populateSkills(skills: string[]): void {
    this.technicalSkills = skills
      .filter(s => this.availableTechnicalSkills.includes(s.trim()))
      .map(s => ({
        name: s.trim(),
        type: 'technical' as const,
        category: 'Technical'
      }));

    this.softSkills = skills
      .filter(s => this.availableSoftSkills.includes(s.trim()))
      .map(s => ({
        name: s.trim(),
        type: 'soft' as const,
        category: 'Soft'
      }));

    this.otherSkills = skills
      .filter(s => !this.availableTechnicalSkills.includes(s.trim()) && !this.availableSoftSkills.includes(s.trim()))
      .map(s => ({
        name: s.trim(),
        type: 'other' as const,
        category: 'Other'
      }));
  }

  // Load profile completion independently
  private loadProfileCompletion(): void {
    this.profileService.getDetailedProfileCompletion().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.completedSections = response.data.completedSections || [];
          this.missingFields = response.data.missingFields || [];
          this.completionRecommendations = response.data.recommendations || [];
          this.profile.profileCompletion = response.data.completion || 0;
         
          console.log('Profile completion updated:', this.profile.profileCompletion);

          // Frontend fix: Remove 'skills' from missingFields if selectedSkills is filled
          if (this.profile.selectedSkills && this.profile.selectedSkills.length > 0) {
            this.missingFields = this.missingFields.filter(f => f.toLowerCase().trim() !== 'skills');
            // Optionally adjust completion percentage if skills was the only missing field
            if (this.missingFields.length === 0) {
              this.profile.profileCompletion = 100;
            }
          }
        }
      },
      error: (error) => {
        console.error('Error loading profile completion:', error);
      }
    });
  }

  private loadPortfolioData(): void {
    this.isLoading = true;

    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.portfolioData = response.data;
          this.populatePortfolioFromData(response.data); // Renamed to avoid confusion
          this.loadShareableUrl();
        } else {
          console.error('No portfolio data found');
          // Don't show message, as profile can exist without portfolio
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        if (error.status === 404 || error.error?.message?.includes('No CV found')) {
          // No portfolio, but profile can still be edited
        }
        this.isLoading = false;
      }
    });
  }

  private populatePortfolioFromData(portfolio: PortfolioData): void {
    const cvData = portfolio.cvData;
    const personalInfo = cvData.personal_info || {};

    // Override profile with CV data where applicable (e.g., title from experience)
    const workExp = cvData.work_experience || [];
    if (workExp.length > 0) {
      this.profile.title = workExp[0].position;
    }

    // Populate CV-based sections (non-editable here)
    if (personalInfo.profile_image) {
      this.profile.profileImage = this.getFullImageUrl(personalInfo.profile_image);
    }

    // Skills from CV if profile skills empty
    if (this.technicalSkills.length === 0 && this.softSkills.length === 0 && this.otherSkills.length === 0 && cvData.skills) {
      const cvSkills: Skill[] = cvData.skills;
      const allSkills = cvSkills.map(s => s.skill_name);
      this.profile.selectedSkills = allSkills;
      this.populateSkills(allSkills);
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
  }

  // Toggle edit mode
  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      // On exit, save if changes made, but for simplicity, save on explicit save
    }
  }

  // New: Toggle CV upload section
  toggleCVUpload(): void {
    this.showCVUpload = !this.showCVUpload;
  }

  // Toggle skill selection
  toggleSkill(skill: string, event: any): void {
    if (event.target.checked) {
      if (!this.profile.selectedSkills.includes(skill)) {
        this.profile.selectedSkills.push(skill);
      }
    } else {
      this.profile.selectedSkills = this.profile.selectedSkills.filter(s => s !== skill);
    }
    // Re-populate to update categories
    this.populateSkills(this.profile.selectedSkills);
  }

  // Add custom skill
  addCustomSkill(): void {
    if (this.newSkill.trim()) {
      const skill = this.newSkill.trim();
      if (!this.profile.selectedSkills.includes(skill)) {
        this.profile.selectedSkills.push(skill);
      }
      this.newSkill = '';
      // Re-populate to update categories
      this.populateSkills(this.profile.selectedSkills);
    }
  }

  // Save profile with completion refresh
  saveProfile(): void {
    const updates: any = {};
    // Basic info
    if (this.profile.phone !== undefined) updates.phone = this.profile.phone || null;
    if (this.profile.location !== undefined) updates.location = this.profile.location || null;
    // Summary
    if (this.profile.about !== undefined) updates.bio = this.profile.about || null;
    // Skills - handle as array
    const skillsArray = this.profile.selectedSkills || [];
    updates.skills = JSON.stringify(skillsArray);
    // Social links
    updates.linkedin_url = this.profile.socialLinksInput.linkedin || null;
    updates.github_url = this.profile.socialLinksInput.github || null;
    updates.website_url = this.profile.socialLinksInput.website || null;
    // Career preferences
    updates.years_of_experience = this.profile.yearsOfExperience || null;
    updates.current_position = this.profile.currentPosition || null;
    updates.availability_status = this.profile.availabilityStatus || null;
    // Parse job types from textarea (newline separated)
    const jobTypes = this.profile.preferredJobTypes
      .split('\n')
      .map(t => t.trim())
      .filter(t => t);
    updates.preferred_job_types = JSON.stringify(jobTypes);
    // Parse locations from textarea (newline separated)
    const locations = this.profile.preferredLocations
      .split('\n')
      .map(l => l.trim())
      .filter(l => l);
    updates.preferred_locations = JSON.stringify(locations);
    updates.salary_expectation_min = this.profile.salaryMin || null;
    updates.salary_expectation_max = this.profile.salaryMax || null;
    if (Object.keys(updates).length > 0) {
      this.profileService.updateProfile(updates).subscribe({
        next: (response) => {
          if (response.success) {
            alert('Profile updated successfully!');
            this.toggleEditMode();
           
            // Reload both profile data and completion
            this.loadProfileData();
            this.loadProfileCompletion();
           
            // Update display
            this.buildSocialLinks();
            this.populateSkills(skillsArray);
          } else {
            alert('Failed to update profile.');
          }
        },
        error: (error) => {
          console.error('Error saving profile:', error);
          alert('Error updating profile. Please try again.');
        }
      });
    } else {
      alert('No changes to save.');
      this.toggleEditMode();
    }
  }

  // Cancel edit
  cancelEdit(): void {
    this.loadProfileData(); // Reload original data
    this.toggleEditMode();
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

  getCompletedFieldsCount(section: CompletedSection): number {
    // Since backend sections may not have fields array, fallback to simple count
    return section.completed ? 1 : 0;
  }

  getTotalFields(section: CompletedSection): number {
    return 1; // Simplified for backend sections without fields
  }

  getIncompleteFields(section: CompletedSection): Field[] {
    // Simplified, return empty if no fields detail
    return [];
  }

  // Build social links for display
  private buildSocialLinks(): void {
    this.socialLinks = [];
    if (this.profile.linkedIn) {
      this.socialLinks.push({
        platform: 'LinkedIn',
        url: this.profile.linkedIn,
        icon: 'fab fa-linkedin'
      });
    }
    if (this.profile.github) {
      this.socialLinks.push({
        platform: 'GitHub',
        url: this.profile.github,
        icon: 'fab fa-github'
      });
    }
    if (this.profile.website) {
      this.socialLinks.push({
        platform: 'Website',
        url: this.profile.website,
        icon: 'fas fa-globe'
      });
    }
  }

  // NEW: Check if profile is complete (you can adjust the threshold as needed)
  isProfileComplete(): boolean {
    return this.profile.profileCompletion >= 80; // 80% or higher considered complete
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
          // Reload completion after update
          this.loadProfileCompletion();
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

  // CV Upload Methods
  triggerCVUpload(): void {
    this.cvFileInput.nativeElement.click();
  }

  handleCVUpload(event: any): void {
    const file = event.target.files[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      // Check file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('CV file size must be less than 5MB.');
        return;
      }
      // Set loading state
      this.isUploadingCV = true;
      // Upload to server
      this.uploadCV(file);
    } else {
      alert('Please select a valid PDF CV file.');
    }
  }

  private uploadCV(file: File): void {
    // Show informative message for long-running process
    const uploadMessage = 'Uploading and processing your CV. This may take 1-3 minutes depending on file size and content complexity. Please wait...';
    alert(uploadMessage); // Or use a modal/toast for better UX

    const result: any = this.profileService.uploadCV(file);

    // If the service returns an Observable
    if (result && typeof result.subscribe === 'function') {
      result.subscribe({
        next: (response: any) => {
          this.isUploadingCV = false;
          if (response?.success) {
            alert('CV uploaded successfully! Refreshing your profile sections...');
            // Poll for portfolio updates (retry up to 3 times with 10s intervals)
            this.pollForPortfolioUpdate(0, 3);
            // Reload completion after update
            this.loadProfileCompletion();
            // Clear the file input
            if (this.cvFileInput && this.cvFileInput.nativeElement) {
              this.cvFileInput.nativeElement.value = '';
            }
          }
        },
        error: (error: any) => {
          this.isUploadingCV = false;
          console.error('Error uploading CV:', error);
          alert('Failed to upload CV. Please try again or check file size.');
        }
      });
      return;
    }

    // If the service returns a Promise
    if (result && typeof result.then === 'function') {
      result.then((response: any) => {
        this.isUploadingCV = false;
        if (response?.success) {
          alert('CV uploaded successfully! Refreshing your profile sections...');
          this.pollForPortfolioUpdate(0, 3);
          this.loadProfileCompletion();
          if (this.cvFileInput && this.cvFileInput.nativeElement) {
            this.cvFileInput.nativeElement.value = '';
          }
        }
      }).catch((error: any) => {
        this.isUploadingCV = false;
        console.error('Error uploading CV:', error);
        alert('Failed to upload CV. Please try again.');
      });
      return;
    }

    // Service returned void (no observable/promise) — fallback with polling
    console.warn('uploadCV did not return an Observable/Promise; using polling fallback.');
    this.isUploadingCV = false;
    // Poll for portfolio updates (retry up to 3 times with 10s intervals)
    this.pollForPortfolioUpdate(0, 3);
    if (this.cvFileInput && this.cvFileInput.nativeElement) {
      this.cvFileInput.nativeElement.value = '';
    }
  }

  // New: Poll for portfolio updates after CV upload
  private pollForPortfolioUpdate(retryCount: number, maxRetries: number): void {
    this.loadPortfolioData();
    // Check if portfolio is updated (e.g., cvData exists)
    if (this.portfolioData && this.portfolioData.cvData) {
      alert('CV processing complete! Your profile has been updated.');
      return;
    }

    if (retryCount < maxRetries) {
      setTimeout(() => {
        this.pollForPortfolioUpdate(retryCount + 1, maxRetries);
      }, 10000); // Wait 10 seconds before next poll
    } else {
      alert('CV upload complete, but processing may still be ongoing. Please refresh the page in a few minutes or try uploading again.');
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

  // Action Methods - Updated to toggle edit mode
  editProfile(): void {
    this.toggleEditMode();
  }

  // Updated to save
  completeProfile(): void {
    this.saveProfile();
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
    
    [...this.technicalSkills, ...this.softSkills, ...this.otherSkills].forEach(skill => {
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

  copyLinkDirect(_t96: HTMLInputElement) {
    throw new Error('Method not implemented.');
  }
  hideToast() {
    throw new Error('Method not implemented.');
  }
}