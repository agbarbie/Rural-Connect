import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  ProfileService,
  PortfolioData,
  Skill,
  WorkExperience,
  Education,
  Certification,
  Project,
  Testimonial,
  ProfileCompletionResponse,
  CompletedSection,
  ProfileResponse,
} from '../../../../../services/profile.service';
import { AuthService } from '../../../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { RatingService, Rating } from '../../../../../services/rating.service';

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
  selectedSkills: string[];
  socialLinksInput: { linkedin: string; github: string; website: string };
  profile_picture?: string;
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

interface RatingDistribution {
  [key: number]: number;
}

interface RatingStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: RatingDistribution;
}

interface ProfileViewer {
  id: string;
  name: string;
  email: string;
  user_type: string;
  profile_image: string;
  company_name: string;
  role_in_company: string;
  company_description?: string;
  company_industry?: string;
  company_size?: string;
  company_website?: string;
  company_logo?: string;
  location?: string;
  viewed_at: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  isLoading = true;
  isEditMode = false;
  isUploadingCV = false;
  showCVUpload = false;
  portfolioData: PortfolioData | null = null;
  shareableUrl: string = '';
  isPublic: boolean = false;

  availableTechnicalSkills: string[] = [
    'JavaScript',
    'Python',
    'Java',
    'C++',
    'React',
    'Angular',
    'Vue.js',
    'Node.js',
    'SQL',
    'MongoDB',
    'AWS',
    'Docker',
    'Git',
    'HTML',
    'CSS',
    'TypeScript',
    'PHP',
    'Ruby',
    'Go',
    'Rust',
    'Swift',
    'Kotlin',
    'C#',
    '.NET',
    'PostgreSQL',
    'MySQL',
    'Redis',
    'Firebase',
    'GraphQL',
    'REST API',
    'Kubernetes',
    'Jenkins',
    'CI/CD',
    'Agile',
    'Scrum',
    'DevOps',
  ];

  availableSoftSkills: string[] = [
    'Communication',
    'Leadership',
    'Teamwork',
    'Problem Solving',
    'Time Management',
    'Adaptability',
    'Critical Thinking',
    'Creativity',
    'Emotional Intelligence',
    'Public Speaking',
    'Negotiation',
    'Conflict Resolution',
    'Project Management',
    'Customer Service',
    'Analytical Thinking',
    'Attention to Detail',
    'Organization',
    'Resilience',
    'Empathy',
    'Networking',
  ];

  newSkill: string = '';

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
    socialLinksInput: { linkedin: '', github: '', website: '' },
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

  completedSections: CompletedSection[] = [];
  missingFields: string[] = [];
  completionRecommendations: string[] = [];

  profileViews: ProfileViewer[] = [];
  showViewersModal: boolean = false;
  isLoadingViewers: boolean = false;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cvFileInput') cvFileInput!: ElementRef<HTMLInputElement>;

  myRatings: Rating[] = [];
  ratingStats: RatingStats = {
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  isLoadingRatings = false;
  rating: any;

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private ratingService: RatingService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadProfileData();
    this.loadMyRatings();
    this.loadPortfolioData();
    this.loadProfileViewers();
  }

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

          if (data.profile_image || data.profileImage || data.profile_picture) {
            const rawImage =
              data.profile_image || data.profileImage || data.profile_picture;
            this.profile.profileImage = this.getFullImageUrl(rawImage);
          } else {
            this.profile.profileImage =
              'https://via.placeholder.com/150/cccccc/666666?text=Profile';
          }

          this.profile.linkedIn = data.linkedin_url || '';
          this.profile.website = data.website_url || '';
          this.profile.github = data.github_url || '';
          this.profile.yearsOfExperience = data.years_of_experience || 0;
          this.profile.currentPosition = data.current_position || '';
          this.profile.availabilityStatus =
            data.availability_status || 'open_to_opportunities';

          this.profile.preferredJobTypes = this.parseJsonField(
            data.preferred_job_types,
            '\n',
          );
          this.profile.preferredLocations = this.parseJsonField(
            data.preferred_locations,
            '\n',
          );
          this.profile.salaryMin = data.salary_expectation_min || null;
          this.profile.salaryMax = data.salary_expectation_max || null;

          let skills: string[] = this.parseJsonArrayField(data.skills);
          this.profile.selectedSkills = skills;
          this.populateSkills(skills);

          this.profile.socialLinksInput = {
            linkedin: this.profile.linkedIn || '',
            github: this.profile.github || '',
            website: this.profile.website || '',
          };
          this.buildSocialLinks();
          this.calculateProfileCompletion();
        }
      },
      error: (error) => {
        console.error('Error loading profile data:', error);
      },
    });
  }

  private parseJsonArrayField(field: any): string[] {
    if (!field) return [];
    try {
      if (typeof field === 'string') return JSON.parse(field);
      if (Array.isArray(field)) return field;
      return [];
    } catch {
      return [];
    }
  }

  private parseJsonField(field: any, separator: string = ', '): string {
    const arr = this.parseJsonArrayField(field);
    return arr.join(separator);
  }

  private populateSkills(skills: string[]): void {
    this.technicalSkills = skills
      .filter((s) => this.availableTechnicalSkills.includes(s.trim()))
      .map((s) => ({
        name: s.trim(),
        type: 'technical' as const,
        category: 'Technical',
      }));

    this.softSkills = skills
      .filter((s) => this.availableSoftSkills.includes(s.trim()))
      .map((s) => ({
        name: s.trim(),
        type: 'soft' as const,
        category: 'Soft',
      }));

    this.otherSkills = skills
      .filter(
        (s) =>
          !this.availableTechnicalSkills.includes(s.trim()) &&
          !this.availableSoftSkills.includes(s.trim()),
      )
      .map((s) => ({
        name: s.trim(),
        type: 'other' as const,
        category: 'Other',
      }));
  }

  calculateProfileCompletion(): void {
    const fields: { [key: string]: number } = {
      name: this.profile?.fullName ? 10 : 0,
      email: this.profile?.email ? 10 : 0,
      phone: this.profile?.phone ? 10 : 0,
      location: this.profile?.location ? 10 : 0,
      profile_image: this.hasProfileImage() ? 15 : 0,
      bio: this.profile?.about && this.profile.about.length >= 50 ? 15 : 0,
      skills:
        this.profile?.selectedSkills && this.profile.selectedSkills.length >= 3
          ? 20
          : 0,
      career_info:
        this.profile?.yearsOfExperience > 0 ||
        this.profile?.currentPosition ||
        this.profile?.availabilityStatus
          ? 10
          : 0,
    };

    const totalScore = Object.values(fields).reduce(
      (sum, score) => sum + (typeof score === 'number' ? score : 0),
      0,
    );
    this.profile.profileCompletion = totalScore;

    this.missingFields = [];
    if (!this.profile?.fullName) this.missingFields.push('Full Name');
    if (!this.profile?.email) this.missingFields.push('Email');
    if (!this.profile?.phone) this.missingFields.push('Phone Number');
    if (!this.profile?.location) this.missingFields.push('Location');
    if (!this.hasProfileImage()) this.missingFields.push('Profile Image');
    if (!this.profile?.about || this.profile.about.length < 50)
      this.missingFields.push('Professional Summary (50+ characters)');
    if (!this.profile?.selectedSkills || this.profile.selectedSkills.length < 3)
      this.missingFields.push('Skills (at least 3)');
    if (
      !this.profile?.yearsOfExperience &&
      !this.profile?.currentPosition &&
      !this.profile?.availabilityStatus
    ) {
      this.missingFields.push(
        'Career Information (experience, position, or availability)',
      );
    }

    this.completionRecommendations = [];
    if (this.profile.profileCompletion < 100) {
      if (this.missingFields.length > 0) {
        this.completionRecommendations.push(
          `Complete ${this.missingFields.length} remaining field(s):`,
        );
        this.completionRecommendations.push(...this.missingFields.slice(0, 3));
        if (this.missingFields.length > 3) {
          this.completionRecommendations.push(
            `...and ${this.missingFields.length - 3} more`,
          );
        }
      }

      if (!this.profile.about || this.profile.about.length < 50) {
        this.completionRecommendations.push(
          '💡 Tip: Add a professional summary to stand out',
        );
      }
      if (
        !this.profile.selectedSkills ||
        this.profile.selectedSkills.length < 3
      ) {
        this.completionRecommendations.push(
          '💡 Tip: Add your top skills to attract employers',
        );
      }
      if (!this.hasProfileImage()) {
        this.completionRecommendations.push(
          '💡 Tip: Upload a professional photo',
        );
      }
    } else {
      this.completionRecommendations.push(
        '🎉 Perfect! Your profile is 100% complete!',
      );
      this.completionRecommendations.push(
        '💼 You can now apply for jobs with confidence',
      );
    }

    console.log('Profile completion calculated:', {
      score: this.profile.profileCompletion,
      missingFields: this.missingFields.length,
      fields: fields,
    });
  }

  hasProfileImage(): boolean {
    const img = this.profile?.profileImage;
    if (!img) return false;
    const trimmed = (img || '').toString().trim();
    if (
      trimmed === '' ||
      trimmed.includes('profile-placeholder') ||
      trimmed === 'assets/images/profile-placeholder.jpg'
    ) {
      return false;
    }
    return true;
  }

  private loadPortfolioData(): void {
    this.isLoading = true;
    this.profileService.getMyPortfolio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.portfolioData = response.data;
          this.populatePortfolioFromData(response.data);
          this.loadShareableUrl();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading portfolio:', error);
        this.isLoading = false;
      },
    });
  }

  private populatePortfolioFromData(portfolio: PortfolioData): void {
    const cvData = portfolio.cvData;
    const personalInfo = cvData.personal_info || {};
    const workExp = cvData.work_experience || [];

    if (workExp.length > 0) {
      this.profile.title = workExp[0].position;
    }

    if (personalInfo.profile_image) {
      this.profile.profileImage = this.getFullImageUrl(
        personalInfo.profile_image,
      );
    }

    if (
      this.technicalSkills.length === 0 &&
      this.softSkills.length === 0 &&
      this.otherSkills.length === 0 &&
      cvData.skills
    ) {
      const cvSkills: Skill[] = cvData.skills;
      const allSkills = cvSkills.map((s) => s.skill_name);
      this.profile.selectedSkills = allSkills;
      this.populateSkills(allSkills);
    }

    if (cvData.education && cvData.education.length > 0) {
      this.education = cvData.education.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        graduationDate: edu.end_date || edu.start_date,
        gpa: edu.gpa,
        coursework: edu.coursework
          ? edu.coursework.split(',').map((c) => c.trim())
          : undefined,
      }));
    }

    if (cvData.work_experience && cvData.work_experience.length > 0) {
      this.experiences = cvData.work_experience.map((work) => {
        const duration = this.calculateDuration(
          work.start_date,
          work.end_date,
          work.is_current,
        );
        return {
          title: work.position,
          company: work.company,
          duration: duration,
          startDate: work.start_date,
          endDate: work.is_current ? 'Present' : work.end_date || '',
          responsibilities: work.responsibilities
            ? work.responsibilities.split('\n').filter((r) => r.trim())
            : [],
          achievements: work.achievements
            ? work.achievements.split('\n').filter((a) => a.trim())
            : [],
          companyLogo: work.company_logo,
        };
      });
    }

    if (cvData.certifications && cvData.certifications.length > 0) {
      this.certifications = cvData.certifications.map((cert) => ({
        degree: cert.certification_name,
        institution: cert.issuer,
        graduationDate: cert.date_issued,
        coursework: cert.credential_url ? [cert.credential_url] : undefined,
      }));
    }

    if (cvData.projects && cvData.projects.length > 0) {
      this.projects = cvData.projects.map((proj) => ({
        title: proj.project_name,
        description: proj.description || '',
        technologies: proj.technologies
          ? proj.technologies.split(',').map((t) => t.trim())
          : [],
        githubUrl: proj.github_url,
        liveUrl: proj.project_url,
        imageUrl: proj.image_url,
      }));
    }

    if (portfolio.testimonials && portfolio.testimonials.length > 0) {
      this.recommendations = portfolio.testimonials;
    }

    this.viewCount = portfolio.viewCount || 0;
    this.isPublic = portfolio.settings?.is_public || false;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
  }

  toggleCVUpload(): void {
    this.showCVUpload = !this.showCVUpload;
  }

  toggleSkill(skill: string, event: any): void {
    if (event.target.checked) {
      if (!this.profile.selectedSkills.includes(skill)) {
        this.profile.selectedSkills.push(skill);
      }
    } else {
      this.profile.selectedSkills = this.profile.selectedSkills.filter(
        (s) => s !== skill,
      );
    }
    this.populateSkills(this.profile.selectedSkills);
  }

  addCustomSkill(): void {
    if (this.newSkill.trim()) {
      const skill = this.newSkill.trim();
      if (!this.profile.selectedSkills.includes(skill)) {
        this.profile.selectedSkills.push(skill);
      }
      this.newSkill = '';
      this.populateSkills(this.profile.selectedSkills);
    }
  }

  saveProfile(): void {
    const updates: any = {};
    if (this.profile.phone !== undefined)
      updates.phone = this.profile.phone || null;
    if (this.profile.location !== undefined)
      updates.location = this.profile.location || null;
    if (this.profile.about !== undefined)
      updates.bio = this.profile.about || null;

    const skillsArray = this.profile.selectedSkills || [];
    updates.skills = JSON.stringify(skillsArray);

    updates.linkedin_url = this.profile.socialLinksInput.linkedin || null;
    updates.github_url = this.profile.socialLinksInput.github || null;
    updates.website_url = this.profile.socialLinksInput.website || null;

    updates.years_of_experience = this.profile.yearsOfExperience || null;
    updates.current_position = this.profile.currentPosition || null;
    updates.availability_status = this.profile.availabilityStatus || null;

    const jobTypes = this.profile.preferredJobTypes
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t);
    updates.preferred_job_types = JSON.stringify(jobTypes);

    const locations = this.profile.preferredLocations
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    updates.preferred_locations = JSON.stringify(locations);

    updates.salary_expectation_min = this.profile.salaryMin || null;
    updates.salary_expectation_max = this.profile.salaryMax || null;

    if (Object.keys(updates).length > 0) {
      this.profileService.updateProfile(updates).subscribe({
        next: (response) => {
          if (response.success) {
            alert('Profile updated successfully!');
            this.toggleEditMode();
            this.loadProfileData();
            this.buildSocialLinks();
            this.populateSkills(skillsArray);
          } else {
            alert('Failed to update profile.');
          }
        },
        error: (error) => {
          console.error('Error saving profile:', error);
          alert('Error updating profile. Please try again.');
        },
      });
    } else {
      alert('No changes to save.');
      this.toggleEditMode();
    }
  }

  formatViewTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffTime / 1000);
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getSuccessRate(): number {
    if (this.ratingStats.totalRatings > 0) {
      if (this.ratingStats.averageRating >= 4.5) return 100;
      if (this.ratingStats.averageRating >= 4.0)
        return Math.round(85 + (this.ratingStats.averageRating - 4.0) * 30);
      if (this.ratingStats.averageRating >= 3.0)
        return Math.round(60 + (this.ratingStats.averageRating - 3.0) * 25);
      return Math.round((this.ratingStats.averageRating / 5) * 100);
    }
    return 0;
  }

  private loadProfileViewers(): void {
    this.isLoadingViewers = true;
    console.log('🔍 Loading profile viewers...');
    
    this.profileService.getProfileViewers({ limit: 50 }).subscribe({
      next: (response) => {
        console.log('✅ Profile viewers response:', response);
        
        if (response.success && response.data) {
          this.profileViews = response.data.viewers || [];
          console.log(`📊 Loaded ${this.profileViews.length} profile viewers`);
          
          if (this.profileViews.length > 0) {
            console.log('👀 First viewer:', this.profileViews[0]);
          }
        } else {
          console.warn('⚠️ No viewers data in response');
          this.profileViews = [];
        }
        
        this.isLoadingViewers = false;
      },
      error: (error) => {
        console.error('❌ Error loading profile viewers:', error);
        this.profileViews = [];
        this.isLoadingViewers = false;
        
        if (error.status === 401) {
          console.error('🔒 Authentication error - user may need to log in again');
        }
      },
    });
  }

  hasProfileViews(): boolean {
    return this.profileViews && this.profileViews.length > 0;
  }

  getProfileViewsCount(): number {
    return this.profileViews ? this.profileViews.length : 0;
  }

  showProfileViewers(): void {
    console.log('👁️ Opening profile viewers modal...');
    console.log('Current viewers:', this.profileViews);
    this.showViewersModal = true;
  }

  closeViewersModal(): void {
    this.showViewersModal = false;
  }

  private loadMyRatings(): void {
    this.isLoadingRatings = true;
    const userId = this.authService.getUserId();

    if (!userId) {
      console.error('User ID not found');
      this.isLoadingRatings = false;
      return;
    }

    this.ratingService
      .getJobseekerRatings(userId, { page: 1, limit: 100 })
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.myRatings = response.data.ratings || [];
            console.log('✅ Loaded ratings count:', this.myRatings.length);

            if (this.myRatings.length > 0) {
              console.log(
                '📊 Full rating object:',
                JSON.stringify(this.myRatings[0], null, 2),
              );
            }

            this.calculateRatingStats();
          }
          this.isLoadingRatings = false;
        },
        error: (error) => {
          console.error('❌ Error loading ratings:', error);
          this.isLoadingRatings = false;
        },
      });
  }

  private calculateRatingStats(): void {
    if (this.myRatings.length === 0) {
      this.ratingStats = {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      return;
    }

    const sum = this.myRatings.reduce((acc, rating) => acc + rating.rating, 0);
    this.ratingStats.averageRating = sum / this.myRatings.length;
    this.ratingStats.totalRatings = this.myRatings.length;

    this.ratingStats.ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.myRatings.forEach((rating) => {
      const ratingValue = rating.rating;
      if (ratingValue >= 1 && ratingValue <= 5) {
        this.ratingStats.ratingDistribution[ratingValue]++;
      }
    });
  }

  getStarArray(rating: number): number[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) stars.push(1);
    if (hasHalfStar && fullStars < 5) stars.push(0.5);
    const remaining = 5 - stars.length;
    for (let i = 0; i < remaining; i++) stars.push(0);

    return stars;
  }

  getRatingPercentage(count: number): number {
    if (this.ratingStats.totalRatings === 0) return 0;
    return (count / this.ratingStats.totalRatings) * 100;
  }

  formatRatingDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  cancelEdit(): void {
    this.loadProfileData();
    this.toggleEditMode();
  }

  getFullImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath || imagePath.trim() === '') {
      return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.profile.fullName || 'User') + '&background=6b7280&color=fff&size=150&bold=true';
    }

    const path = imagePath.trim();

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.profile.fullName || 'User') + '&background=6b7280&color=fff&size=150&bold=true';
  }

  handleImageError(event: any): void {
    const fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(this.profile.fullName || 'User') + '&background=6b7280&color=fff&size=150&bold=true';
    if (event.target.src !== fallback) {
      event.target.src = fallback;
    }
  }

  getCompletedFieldsCount(section: CompletedSection): number {
    return section.completed ? 1 : 0;
  }

  getTotalFields(section: CompletedSection): number {
    return 1;
  }

  getIncompleteFields(section: CompletedSection): Field[] {
    return [];
  }

  private buildSocialLinks(): void {
    this.socialLinks = [];
    if (this.profile.linkedIn) {
      this.socialLinks.push({
        platform: 'LinkedIn',
        url: this.profile.linkedIn,
        icon: 'fab fa-linkedin',
      });
    }
    if (this.profile.github) {
      this.socialLinks.push({
        platform: 'GitHub',
        url: this.profile.github,
        icon: 'fab fa-github',
      });
    }
    if (this.profile.website) {
      this.socialLinks.push({
        platform: 'Website',
        url: this.profile.website,
        icon: 'fas fa-globe',
      });
    }
  }

  isProfileComplete(): boolean {
    return this.profile.profileCompletion === 100;
  }

  triggerImageUpload(): void {
    this.fileInput.nativeElement.click();
  }

  handleImageUpload(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profile.profileImage = e.target.result;
      };
      reader.readAsDataURL(file);
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
          if (response.imageUrl) {
            this.profile.profileImage = this.getFullImageUrl(response.imageUrl);
          }
          this.profileService.getMyProfile().subscribe({
            next: (profileResponse) => {
              if (profileResponse.success && profileResponse.data) {
                const data = profileResponse.data;
                if (data.profile_image || data.profileImage) {
                  this.profile.profileImage = this.getFullImageUrl(
                    data.profile_image || data.profileImage,
                  );
                }
                this.calculateProfileCompletion();
              }
              this.isLoading = false;
              alert('Profile image updated successfully!');
            },
            error: (error) => {
              console.error('Error reloading profile:', error);
              this.calculateProfileCompletion();
              this.isLoading = false;
              alert('Profile image updated successfully!');
            },
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
      },
    });
  }

  triggerCVUpload(): void {
    this.cvFileInput.nativeElement.click();
  }

  handleCVUpload(event: any): void {
  const file = event.target.files[0];
  
  // ✅ Allow PDF, DOC, DOCX, and TXT files
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (
    file &&
    (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension))
  ) {
    if (file.size > 5 * 1024 * 1024) {
      alert('CV file size must be less than 5MB.');
      return;
    }
    this.isUploadingCV = true;
    this.uploadCV(file);
  } else {
    alert('Please select a valid CV file (PDF, DOC, DOCX, or TXT).');
  }
}


  private uploadCV(file: File): void {
    this.isUploadingCV = true;
    this.profileService.uploadCV(file).subscribe({
      next: (response: any) => {
        this.isUploadingCV = false;
        if (response?.success) {
          alert('CV uploaded successfully! Your portfolio has been updated.');
          this.loadProfileData();
          this.loadPortfolioData();
          if (this.cvFileInput && this.cvFileInput.nativeElement) {
            this.cvFileInput.nativeElement.value = '';
          }
        } else {
          alert('CV upload failed. Please try again.');
        }
      },
      error: (error: any) => {
        console.error('❌ CV upload error:', error);
        this.isUploadingCV = false;
        let errorMessage = 'Failed to upload CV. ';
        if (error.status === 401) {
          errorMessage += 'Please login again.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else if (error.status === 413) {
          errorMessage += 'File is too large. Maximum size is 10MB.';
        } else if (error.status === 400) {
          errorMessage += error.error?.message || 'Invalid file or format.';
        } else if (error.error?.message) {
          errorMessage += error.error.message;
        } else {
          errorMessage += 'Please try again.';
        }
        alert(errorMessage);
        if (this.cvFileInput && this.cvFileInput.nativeElement) {
          this.cvFileInput.nativeElement.value = '';
        }
      },
    });
  }

  private calculateDuration(
    startDate: string,
    endDate: string | undefined,
    isCurrent: boolean,
  ): string {
    const start = new Date(startDate);
    const end = isCurrent
      ? new Date()
      : endDate
        ? new Date(endDate)
        : new Date();
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
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
      },
    });
  }

  editProfile(): void {
    this.toggleEditMode();
  }

  completeProfile(): void {
    this.saveProfile();
  }

  shareProfile(): void {
    if (!this.isProfileComplete()) {
      const proceed = confirm(
        'Your profile is not complete yet. A complete profile makes a better impression on employers. Would you like to complete your profile first?',
      );
      if (proceed) {
        this.completeProfile();
        return;
      }
    }

    if (!this.shareableUrl) {
      alert('Generating your shareable link. Please wait a moment...');
      this.loadShareableUrl();
      setTimeout(() => {
        if (this.shareableUrl) {
          this.shareProfile();
        } else {
          alert(
            'Unable to generate shareable link. Please try again or contact support.',
          );
        }
      }, 2000);
      return;
    }

    if (!this.isPublic) {
      const makePublic = confirm(
        'Your portfolio is currently private. Would you like to make it public to share it?',
      );
      if (makePublic) {
        this.profileService.togglePortfolioVisibility(true).subscribe({
          next: (response) => {
            if (response.success) {
              this.isPublic = true;
              this.loadShareableUrl();
              setTimeout(() => {
                this.copyShareLink();
              }, 1000);
            }
          },
          error: (error) => {
            console.error('Error making portfolio public:', error);
            alert('Failed to make portfolio public. Please try again.');
          },
        });
      }
      return;
    }

    this.copyShareLink();
  }

  private copyShareLink(): void {
    if (navigator.share && this.isMobileDevice()) {
      navigator
        .share({
          title: `${this.profile.fullName} - Professional Portfolio`,
          text: `Check out ${this.profile.fullName}'s professional portfolio`,
          url: this.shareableUrl,
        })
        .catch((err) => {
          this.copyToClipboard();
        });
    } else {
      this.copyToClipboard();
    }
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  }

  private copyToClipboard(): void {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(this.shareableUrl)
        .then(() => {
          this.showSuccessMessage();
        })
        .catch((err) => {
          this.fallbackCopyTextToClipboard(this.shareableUrl);
        });
    } else {
      this.fallbackCopyTextToClipboard(this.shareableUrl);
    }
  }

  private showSuccessMessage(): void {
    const message = `✅ Portfolio link copied to clipboard!\n\n${this.shareableUrl}\n\nYou can now paste and share this link with:\n• Recruiters and employers\n• LinkedIn contacts\n• WhatsApp groups\n• Email applications\n• Social media platforms`;
    alert(message);
  }

  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showSuccessMessage();
      } else {
        this.showLinkManually(text);
      }
    } catch (err) {
      this.showLinkManually(text);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  private showLinkManually(text: string): void {
    const message = `📋 Your shareable portfolio link:\n\n${text}\n\n⚠️ Automatic copy failed. Please copy this link manually.`;
    const userAction = prompt(message, text);
    if (userAction !== null) {
      alert(
        'Great! Now you can paste the link wherever you want to share your portfolio.',
      );
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
            this.loadShareableUrl();
          }
        }
      },
      error: (error) => {
        console.error('Error toggling portfolio visibility:', error);
        alert('Failed to update portfolio visibility. Please try again.');
      },
    });
  }

  viewCertificate(certification: EducationDisplay): void {
    if (certification.coursework && certification.coursework.length > 0) {
      const url = certification.coursework[0];
      if (url && url !== '#') {
        window.open(url, '_blank');
      }
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
    }
  }

  getSkillColor(level?: string): string {
    if (!level) return '#6b7280';
    switch (level.toLowerCase()) {
      case 'expert':
      case 'advanced':
        return '#10b981';
      case 'intermediate':
        return '#3b82f6';
      case 'beginner':
      case 'basic':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  getFileIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'fas fa-file-pdf';
      case 'zip':
        return 'fas fa-file-archive';
      case 'figma':
        return 'fab fa-figma';
      case 'doc':
      case 'docx':
        return 'fas fa-file-word';
      case 'xls':
      case 'xlsx':
        return 'fas fa-file-excel';
      case 'ppt':
      case 'pptx':
        return 'fas fa-file-powerpoint';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'fas fa-file-image';
      default:
        return 'fas fa-file';
    }
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  getSkillsByCategory(): Map<string, SkillDisplay[]> {
    const categorized = new Map<string, SkillDisplay[]>();
    [...this.technicalSkills, ...this.softSkills, ...this.otherSkills].forEach(
      (skill) => {
        const category = skill.category || 'General';
        if (!categorized.has(category)) {
          categorized.set(category, []);
        }
        categorized.get(category)!.push(skill);
      },
    );
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
    if (percentage === 100) return 'completion-green';
    return 'completion-red';
  }

  getProgressColor(percentage: number): string {
    if (percentage === 100) return '#10b981';
    return '#ef4444';
  }

  copyLinkDirect(_t96: HTMLInputElement): void {
    throw new Error('Method not implemented.');
  }

  hideToast(): void {
    throw new Error('Method not implemented.');
  }

  hasSkillsRating(skills_rating: any): boolean {
    if (!skills_rating) return false;
    return !!(
      (typeof skills_rating.technical === 'number' &&
        skills_rating.technical > 0) ||
      (typeof skills_rating.communication === 'number' &&
        skills_rating.communication > 0) ||
      (typeof skills_rating.professionalism === 'number' &&
        skills_rating.professionalism > 0) ||
      (typeof skills_rating.quality === 'number' &&
        skills_rating.quality > 0) ||
      (typeof skills_rating.timeliness === 'number' &&
        skills_rating.timeliness > 0)
    );
  }
}