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
    // Profile completion will be calculated after profile data loads
    // Load portfolio data if needed (for display purposes only)
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
          
          // ✅ Load profile image from backend
          if (data.profile_image || data.profileImage) {
            const imageUrl = data.profile_image || data.profileImage;
            this.profile.profileImage = this.getFullImageUrl(imageUrl);
            console.log('✅ Profile image loaded:', {
              rawUrl: imageUrl,
              fullUrl: this.profile.profileImage
            });
          } else {
            this.profile.profileImage = 'assets/images/profile-placeholder.jpg';
            console.log('ℹ️ No profile image found, using placeholder');
          }
          
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
          
          // ✅ CALCULATE PROFILE COMPLETION BASED ON FORM FIELDS
          this.calculateProfileCompletion();
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

  /**
   * ✅ NEW: Calculate profile completion based on form fields only
   * This ensures profile completion is 100% independent of CV upload
   */
  private calculateProfileCompletion(): void {
    let totalFields = 0;
    let completedFields = 0;
    this.missingFields = [];

    // 1. Basic Contact Information (3 required fields)
    totalFields += 3;
    if (this.profile.phone && this.profile.phone.trim().length > 0) {
      completedFields++;
    } else {
      this.missingFields.push('Phone Number');
    }
    
    if (this.profile.location && this.profile.location.trim().length > 0) {
      completedFields++;
    } else {
      this.missingFields.push('Location');
    }
    
    // Check if profile image is uploaded (not the default placeholder)
    const hasCustomImage = this.profile.profileImage && 
                          this.profile.profileImage !== 'assets/images/profile-placeholder.jpg' &&
                          !this.profile.profileImage.includes('profile-placeholder') &&
                          (this.profile.profileImage.startsWith('http') || 
                           this.profile.profileImage.startsWith('/uploads') ||
                           this.profile.profileImage.startsWith('data:image'));
    
    if (hasCustomImage) {
      completedFields++;
    } else {
      this.missingFields.push('Profile Image');
    }

    // 2. Professional Summary (1 required field)
    totalFields += 1;
    if (this.profile.about && this.profile.about.trim().length > 50) {
      completedFields++;
    } else {
      this.missingFields.push('Professional Summary (minimum 50 characters)');
    }

    // 3. Skills (1 required field - at least 3 skills)
    totalFields += 1;
    if (this.profile.selectedSkills && this.profile.selectedSkills.length >= 3) {
      completedFields++;
    } else {
      this.missingFields.push(`Skills (${this.profile.selectedSkills.length}/3 minimum)`);
    }

    // 4. Social Links (1 required field - at least one link)
    totalFields += 1;
    const hasLinkedIn = this.profile.socialLinksInput.linkedin && this.profile.socialLinksInput.linkedin.trim().length > 0;
    const hasGithub = this.profile.socialLinksInput.github && this.profile.socialLinksInput.github.trim().length > 0;
    const hasWebsite = this.profile.socialLinksInput.website && this.profile.socialLinksInput.website.trim().length > 0;
    
    if (hasLinkedIn || hasGithub || hasWebsite) {
      completedFields++;
    } else {
      this.missingFields.push('At least one Social Link (LinkedIn, GitHub, or Website)');
    }

    // 5. Career Preferences (3 required fields)
    totalFields += 3;
    if (this.profile.yearsOfExperience > 0) {
      completedFields++;
    } else {
      this.missingFields.push('Years of Experience');
    }
    
    if (this.profile.currentPosition && this.profile.currentPosition.trim().length > 0) {
      completedFields++;
    } else {
      this.missingFields.push('Current Position');
    }
    
    if (this.profile.preferredJobTypes && this.profile.preferredJobTypes.trim().length > 0) {
      completedFields++;
    } else {
      this.missingFields.push('Preferred Job Types');
    }

    // 6. Salary Expectations (1 optional field - bonus points if filled)
    totalFields += 1;
    if ((this.profile.salaryMin && this.profile.salaryMin > 0) || 
        (this.profile.salaryMax && this.profile.salaryMax > 0)) {
      completedFields++;
    } else {
      this.missingFields.push('Salary Expectations (optional but recommended)');
    }

    // Calculate percentage
    const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    this.profile.profileCompletion = percentage;
    
    // Update completion recommendations
    this.completionRecommendations = [];
    if (percentage < 100) {
      this.completionRecommendations.push(
        `Complete the following ${this.missingFields.length} field(s) to reach 100%:`
      );
      this.completionRecommendations.push(...this.missingFields);
    } else {
      this.completionRecommendations.push('✅ Your profile is 100% complete! You can now apply for jobs.');
    }

    console.log('📊 Profile completion calculation (Form-based):', {
      totalFields,
      completedFields,
      percentage,
      missingFields: this.missingFields
    });
  }

  private loadPortfolioData(): void {
    this.isLoading = true;

    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.portfolioData = response.data;
          this.populatePortfolioFromData(response.data); // For display purposes only
          this.loadShareableUrl();
        } else {
          console.log('No portfolio data found - CV not uploaded yet');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        if (error.status === 404 || error.error?.message?.includes('No CV found')) {
          console.log('No CV found - user can still complete profile without CV');
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

    // Populate CV-based sections (non-editable here, for display only)
    if (personalInfo.profile_image) {
      this.profile.profileImage = this.getFullImageUrl(personalInfo.profile_image);
    }

    // Skills from CV if profile skills empty (for display)
    if (this.technicalSkills.length === 0 && this.softSkills.length === 0 && this.otherSkills.length === 0 && cvData.skills) {
      const cvSkills: Skill[] = cvData.skills;
      const allSkills = cvSkills.map(s => s.skill_name);
      this.profile.selectedSkills = allSkills;
      this.populateSkills(allSkills);
    }

    // Education (for display)
    if (cvData.education && cvData.education.length > 0) {
      this.education = cvData.education.map(edu => ({
        degree: edu.degree,
        institution: edu.institution,
        graduationDate: edu.end_date || edu.start_date,
        gpa: edu.gpa,
        coursework: edu.coursework ? edu.coursework.split(',').map(c => c.trim()) : undefined
      }));
    }

    // Work Experience (for display)
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

    // Certifications (for display)
    if (cvData.certifications && cvData.certifications.length > 0) {
      this.certifications = cvData.certifications.map(cert => ({
        degree: cert.certification_name,
        institution: cert.issuer,
        graduationDate: cert.date_issued,
        coursework: cert.credential_url ? [cert.credential_url] : undefined
      }));
    }

    // Projects (for display)
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

    // Testimonials/Recommendations (for display)
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
           
            // Reload profile data and recalculate completion
            this.loadProfileData();
           
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

  // NEW: Check if profile is complete (100% required to apply for jobs)
  isProfileComplete(): boolean {
    return this.profile.profileCompletion === 100;
  }

  // Image Upload Methods
  triggerImageUpload(): void {
    this.fileInput.nativeElement.click();
  }

  handleImageUpload(event: any): void {
    const file = event.target.files[0];
    console.log('📸 Image selected:', {
      name: file?.name,
      type: file?.type,
      size: file?.size
    });
    
    if (file && file.type.startsWith('image/')) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB.');
        return;
      }
      
      // Preview the image locally
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profile.profileImage = e.target.result; // Base64 for preview
        console.log('✅ Image preview loaded (base64)');
      };
      reader.readAsDataURL(file);

      // Upload to server
      console.log('⬆️ Starting image upload to server...');
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
          // Set the image URL from response
          if (response.imageUrl) {
            this.profile.profileImage = this.getFullImageUrl(response.imageUrl);
          }
          
          // Reload profile data from backend to ensure we have the latest data
          this.profileService.getMyProfile().subscribe({
            next: (profileResponse) => {
              if (profileResponse.success && profileResponse.data) {
                // Update profile image from backend
                const data = profileResponse.data;
                if (data.profile_image || data.profileImage) {
                  this.profile.profileImage = this.getFullImageUrl(
                    data.profile_image || data.profileImage
                  );
                }
                
                // Recalculate completion after image update
                this.calculateProfileCompletion();
                
                console.log('✅ Profile image updated:', {
                  imageUrl: this.profile.profileImage,
                  completion: this.profile.profileCompletion
                });
              }
              
              this.isLoading = false;
              alert('Profile image updated successfully!');
            },
            error: (error) => {
              console.error('Error reloading profile:', error);
              // Still recalculate even if reload fails
              this.calculateProfileCompletion();
              this.isLoading = false;
              alert('Profile image updated successfully!');
            }
          });
        } else {
          this.isLoading = false;
          alert('Failed to upload image. Please try again.');
        }
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        this.isLoading = false;
        
        let errorMessage = 'Failed to upload image. ';
        if (error.status === 401) {
          errorMessage += 'Please login again.';
        } else if (error.status === 413) {
          errorMessage += 'Image file is too large. Maximum size is 5MB.';
        } else if (error.error?.message) {
          errorMessage += error.error.message;
        } else {
          errorMessage += 'Please try again.';
        }
        
        alert(errorMessage);
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
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('CV file size must be less than 5MB.');
        return;
      }
      
      this.isUploadingCV = true;
      this.uploadCV(file);
    } else {
      alert('Please select a valid PDF CV file.');
    }
  }

  private uploadCV(file: File): void {
    console.log('Uploading CV file:', file.name, file.type, file.size);
    
    // Show loading message
    const uploadNotification = 'Uploading and processing your CV. This may take 1-3 minutes depending on file size and content complexity. Please wait...';
    alert(uploadNotification);

    this.profileService.uploadCV(file).subscribe({
      next: (response: any) => {
        console.log('CV upload response:', response);
        this.isUploadingCV = false;
        
        if (response?.success) {
          alert('CV uploaded successfully! Your portfolio sections are being updated...');
          
          // Reload profile and portfolio data (for display purposes)
          this.loadProfileData();
          this.loadPortfolioData();
          
          // Clear the file input
          if (this.cvFileInput && this.cvFileInput.nativeElement) {
            this.cvFileInput.nativeElement.value = '';
          }
          
          // Show success message after data loads
          setTimeout(() => {
            alert('CV processing complete! Your portfolio has been updated with the extracted information.');
          }, 2000);
        } else {
          alert('CV upload failed. Please try again or check the file format.');
        }
      },
      error: (error: any) => {
        console.error('Error uploading CV:', error);
        this.isUploadingCV = false;
        
        let errorMessage = 'Failed to upload CV. ';
        if (error.status === 401) {
          errorMessage += 'Please login again.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else if (error.status === 413) {
          errorMessage += 'File is too large. Maximum size is 5MB.';
        } else if (error.error?.message) {
          errorMessage += error.error.message;
        } else {
          errorMessage += 'Please try again or check file format.';
        }
        
        alert(errorMessage);
        
        // Clear the file input
        if (this.cvFileInput && this.cvFileInput.nativeElement) {
          this.cvFileInput.nativeElement.value = '';
        }
      }
    });
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