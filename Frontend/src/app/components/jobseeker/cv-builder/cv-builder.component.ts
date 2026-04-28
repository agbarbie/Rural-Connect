// cv-builder.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CvService, CVData, CV } from '../../../../../services/cv.service';
import { AuthService } from '../../../../../services/auth.service';
import { ProfileService } from '../../../../../services/profile.service';
import { environment } from '../../../../environments/environments';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-cv-builder',
  templateUrl: './cv-builder.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  styleUrls: ['./cv-builder.component.css']
})
export class CvBuilderComponent implements OnInit, OnDestroy {
  
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
  
  currentStep = 1;
  totalSteps = 6;
  previewMode = false;
  isDraft = true;
  showWelcome = true;
  isDragOver = false;
  isProcessingFile = false;
  showNotification = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';
  currentCVId: string | null = null;
  savedCVs: CV[] = [];
  
  // Auth related properties
  isAuthenticated = false;
  currentUserId: string | null = null;
  userName: string = 'User';
  private authSubscription: Subscription | null = null;

  cvData: CVData = {
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      linkedIn: '',
      website: '',
      professionalSummary: '',
      profileImage: ''
    },
    education: [],
    workExperience: [],
    skills: [],
    certifications: [],
    projects: []
  };

  // Profile image upload
  @ViewChild('profileImageInput') profileImageInput!: ElementRef<HTMLInputElement>;
  profileImageFile: File | null = null;
  profileImagePreview: string | null = null;

  skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  skillCategories = ['Technical', 'Programming', 'Design', 'Management', 'Communication', 'Other'];
  
  availableSkills = [
    'JavaScript', 'TypeScript', 'Angular', 'React', 'Vue.js', 'Node.js', 'Python', 'Java',
    'C#', 'PHP', 'HTML', 'CSS', 'SASS', 'Bootstrap', 'Tailwind CSS', 'SQL', 'MongoDB',
    'PostgreSQL', 'Git', 'Docker', 'AWS', 'Azure', 'Google Cloud', 'Project Management',
    'Agile', 'Scrum', 'Leadership', 'Team Management', 'Communication', 'Problem Solving'
  ];

  constructor(
    private cvService: CvService,
    private profileService: ProfileService,
    private authService: AuthService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Subscribe to authentication state
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user && user.user_type === 'jobseeker') {
        this.isAuthenticated = true;
        this.currentUserId = user.id?.toString() || null;
        this.userName = user.name || 'Job Seeker';
        
        // Pre-fill personal info with user data if CV is empty
        if (!this.cvData.personalInfo.fullName && !this.cvData.personalInfo.email) {
          this.cvData.personalInfo.fullName = user.name || '';
          this.cvData.personalInfo.email = user.email || '';
        }
        
        // Load saved CVs once authenticated
        this.loadSavedCVs();
      } else {
        this.isAuthenticated = false;
        this.currentUserId = null;
        this.displayNotification('Please login as a jobseeker to use CV Builder', 'error');
        // Redirect to login after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      }
    });

    // Check authentication immediately
    if (!this.authService.isAuthenticated() || !this.authService.isJobseeker()) {
      this.displayNotification('Authentication required. Redirecting to login...', 'error');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // ============================================
  // AUTH GUARD METHODS
  // ============================================

  private checkAuthentication(): boolean {
    if (!this.isAuthenticated || !this.currentUserId) {
      this.displayNotification('You must be logged in to perform this action', 'error');
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }

  // ============================================
  // FILE UPLOAD AND DRAG-DROP HANDLERS
  // ============================================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    if (!this.checkAuthentication()) return;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    if (!this.checkAuthentication()) return;
    
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

 private processFile(file: File): void {
  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    this.displayNotification('Please upload a valid CV file (PDF, DOC, DOCX, or TXT)', 'error');
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    this.displayNotification('File size must be less than 10MB', 'error');
    return;
  }

  this.isProcessingFile = true;
  
  // Upload file to backend
  this.cvService.uploadCV(file).subscribe({
    next: (response) => {
      this.isProcessingFile = false;
      console.log('📥 CV Upload Response:', response);
      
      if (response.success && response.data) {
        // ✅ CRITICAL FIX: Handle response with null safety
        const data = response.data;
        
        // Ensure cvData exists
        if (data.cvData) {
          this.cvData = data.cvData;
        } else {
          console.warn('⚠️ No cvData in response, using default structure');
          this.cvData = {
            personalInfo: {
              fullName: this.userName,
              email: this.authService.getCurrentUser()?.email || '',
              phone: '',
              address: '',
              linkedIn: '',
              website: '',
              professionalSummary: '',
              profileImage: ''
            },
            education: [],
            workExperience: [],
            skills: [],
            certifications: [],
            projects: []
          };
        }
        
        this.currentCVId = data.id || null;
        this.isDraft = (data.status || 'draft') === 'draft';
        
        this.displayNotification('CV uploaded and parsed successfully!', 'success');
        this.startCVBuilder();
      } else {
        this.displayNotification('Failed to parse CV. Please try again.', 'error');
      }
    },
    error: (error) => {
      this.isProcessingFile = false;
      console.error('❌ CV Upload Error:', error);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        this.displayNotification('Session expired. Please login again.', 'error');
        this.router.navigate(['/login']);
      } else {
        this.displayNotification('Error uploading CV: ' + error.message, 'error');
      }
    }
  });
}


  // ============================================
  // PROFILE IMAGE UPLOAD METHODS
  // ============================================

  onProfileImageSelected(event: any): void {
    if (!this.checkAuthentication()) return;
    
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        this.displayNotification('Image size must be less than 5MB', 'error');
        return;
      }

      this.profileImageFile = file;
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
      
      this.uploadProfileImage(file);
    } else {
      this.displayNotification('Please select a valid image file (JPEG, PNG, GIF, WebP).', 'error');
    }
  }

  private uploadProfileImage(file: File): void {
    this.displayNotification('Uploading profile image...', 'success');

    this.cvService.uploadProfileImage(file).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Store the profile image URL in CV data
          this.cvData.personalInfo.profileImage = response.data.imageUrl;
          this.profileImagePreview = null; // Clear preview since we have actual URL
          
          // Auto-save the CV to ensure profile image is persisted
          this.autoSaveCV();
          
          this.displayNotification('Profile image uploaded successfully!', 'success');
        } else {
          this.displayNotification('Failed to upload image. Please try again.', 'error');
        }
      },
      error: (error) => {
        this.handleServiceError(error, 'uploading profile image');
      }
    });
  }

  removeProfileImage(): void {
    if (!this.checkAuthentication()) return;
    
    if (confirm('Are you sure you want to remove your profile image?')) {
      this.cvData.personalInfo.profileImage = '';
      this.profileImageFile = null;
      this.profileImagePreview = null;
      this.displayNotification('Profile image removed', 'success');
    }
  }

  getProfileImageUrl(): string {
  // Add comprehensive null checks
  if (!this.cvData || !this.cvData.personalInfo) {
    return 'https://ui-avatars.com/api/?name=User&background=6b7280&color=fff&size=150';
  }

  if (this.profileImagePreview) {
    return this.profileImagePreview;
  }
  
  if (this.cvData.personalInfo.profileImage) {
    return this.getFullImageUrl(this.cvData.personalInfo.profileImage);
  }
  
  // Generate avatar with user's name
  const name = this.cvData.personalInfo.fullName || this.userName || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6b7280&color=fff&size=150&bold=true`;
}

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

  triggerProfileImageUpload(): void {
    this.profileImageInput.nativeElement.click();
  }

  // ============================================
  // CV OPERATIONS
  // ============================================

  startNewCV(): void {
    if (!this.checkAuthentication()) return;
    
    // Reset CV data but keep user info
    this.cvData = {
      personalInfo: {
        fullName: this.userName,
        email: this.authService.getCurrentUser()?.email || '',
        phone: '',
        address: '',
        linkedIn: '',
        website: '',
        professionalSummary: '',
        profileImage: ''
      },
      education: [],
      workExperience: [],
      skills: [],
      certifications: [],
      projects: []
    };

    this.profileImageFile = null;
    this.profileImagePreview = null;
    this.currentCVId = null;
    this.isDraft = true;
    this.startCVBuilder();
  }

  private startCVBuilder(): void {
    this.showWelcome = false;
    this.currentStep = 1;
  }

  // Add auto-save method
  private autoSaveCV(): void {
    if (this.currentCVId) {
      this.cvService.updateCV(this.currentCVId, this.cvData).subscribe({
        next: (response) => {
          console.log('CV auto-saved with profile image');
        },
        error: (error) => {
          console.error('Error auto-saving CV:', error);
        }
      });
    }
  }

  saveAsDraft(): void {
    if (!this.checkAuthentication()) return;
    
    this.isDraft = true;
    
    if (this.currentCVId) {
      // Update existing CV
      this.cvService.updateCV(this.currentCVId, this.cvData).subscribe({
        next: (response) => {
          if (response.success) {
            this.displayNotification('CV draft updated successfully!', 'success');
            // Update status to draft if needed
            if (response.data?.status !== 'draft') {
              this.cvService.updateCVStatus(this.currentCVId!, 'draft').subscribe();
            }
            this.loadSavedCVs();
          }
        },
        error: (error) => {
          this.handleServiceError(error, 'saving draft');
        }
      });
    } else {
      // Create new CV
      this.cvService.createCV(this.cvData).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.currentCVId = response.data.id;
            this.displayNotification('CV draft saved successfully!', 'success');
            this.loadSavedCVs();
          }
        },
        error: (error) => {
          this.handleServiceError(error, 'creating draft');
        }
      });
    }
  }

  saveAsFinal(): void {
    if (!this.checkAuthentication()) return;
    
    if (!this.validateCV()) {
      this.displayNotification('Please complete all required fields before saving as final.', 'error');
      return;
    }

    this.isDraft = false;

    if (this.currentCVId) {
      // Update existing CV and set status to final
      this.cvService.updateCV(this.currentCVId, this.cvData).subscribe({
        next: (response) => {
          if (response.success) {
            // Update status to final
            this.cvService.updateCVStatus(this.currentCVId!, 'final').subscribe({
              next: (statusResponse) => {
                if (statusResponse.success) {
                  this.displayNotification('CV finalized successfully!', 'success');
                  this.loadSavedCVs();
                }
              },
              error: (error) => {
                this.handleServiceError(error, 'finalizing CV');
              }
            });
          }
        },
        error: (error) => {
          this.handleServiceError(error, 'saving CV');
        }
      });
    } else {
      // Create new CV as final
      this.cvService.createCV(this.cvData).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.currentCVId = response.data.id;
            // Update status to final
            this.cvService.updateCVStatus(this.currentCVId, 'final').subscribe({
              next: () => {
                this.displayNotification('CV created and finalized successfully!', 'success');
                this.loadSavedCVs();
              }
            });
          }
        },
        error: (error) => {
          this.handleServiceError(error, 'creating CV');
        }
      });
    }
  }

  loadSavedCVs(): void {
    if (!this.checkAuthentication()) return;
    
    this.cvService.getMyCVs().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.savedCVs = response.data;
          
          // Load the most recent CV if available and no current CV is loaded
          if (this.savedCVs.length > 0 && !this.currentCVId) {
            const latestCV = this.savedCVs[0];
            this.cvData = latestCV.cvData;
            this.currentCVId = latestCV.id;
            this.isDraft = latestCV.status === 'draft';
            this.displayNotification(`Loaded CV: ${latestCV.cvData.personalInfo.fullName || 'Untitled'}`, 'success');
          }
        }
      },
      error: (error) => {
        this.handleServiceError(error, 'loading CVs');
      }
    });
  }

  loadCV(cvId: string): void {
    if (!this.checkAuthentication()) return;
    
    this.cvService.getCVById(cvId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.cvData = response.data.cvData;
          this.currentCVId = response.data.id;
          this.isDraft = response.data.status === 'draft';
          this.displayNotification('CV loaded successfully!', 'success');
          this.showWelcome = false;
        }
      },
      error: (error) => {
        this.handleServiceError(error, 'loading CV');
      }
    });
  }

  deleteCV(cvId: string): void {
    if (!this.checkAuthentication()) return;
    
    if (!confirm('Are you sure you want to delete this CV?')) {
      return;
    }

    this.cvService.deleteCV(cvId).subscribe({
      next: (response) => {
        if (response.success) {
          this.displayNotification('CV deleted successfully!', 'success');
          this.loadSavedCVs();
          
          // If we deleted the current CV, reset
          if (cvId === this.currentCVId) {
            this.startNewCV();
            this.showWelcome = true;
          }
        }
      },
      error: (error) => {
        this.handleServiceError(error, 'deleting CV');
      }
    });
  }

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  downloadPDF(): void {
    if (!this.checkAuthentication()) return;
    
    if (!this.currentCVId) {
      this.displayNotification('Please save your CV first before downloading.', 'warning');
      return;
    }

    const filename = `${this.cvData.personalInfo.fullName || 'CV'}_${Date.now()}.pdf`;
    this.cvService.downloadCV(this.currentCVId, 'pdf', filename);
    this.displayNotification('Downloading PDF...', 'success');
  }

  downloadWord(): void {
    if (!this.checkAuthentication()) return;
    
    if (!this.currentCVId) {
      this.displayNotification('Please save your CV first before downloading.', 'warning');
      return;
    }

    const filename = `${this.cvData.personalInfo.fullName || 'CV'}_${Date.now()}.docx`;
    this.cvService.downloadCV(this.currentCVId, 'docx', filename);
    this.displayNotification('Downloading Word document...', 'success');
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  nextStep(): void {
    if (this.validateCurrentStep() && this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
    }
  }

  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  // ============================================
  // EDUCATION METHODS
  // ============================================

  addEducation(): void {
    const newEducation: any = {
      id: this.generateId(),
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startYear: '',
      endYear: '',
      gpa: '',
      achievements: ''
    };
    this.cvData.education.push(newEducation);
  }

  removeEducation(id: string): void {
    this.cvData.education = this.cvData.education.filter(edu => edu.id !== id);
  }

  // ============================================
  // WORK EXPERIENCE METHODS
  // ============================================

  addWorkExperience(): void {
    const newWork: any = {
      id: this.generateId(),
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      current: false,
      responsibilities: '',
      achievements: ''
    };
    this.cvData.workExperience.push(newWork);
  }

  removeWorkExperience(id: string): void {
    this.cvData.workExperience = this.cvData.workExperience.filter(work => work.id !== id);
  }

  onCurrentJobChange(work: any): void {
    if (work.current) {
      work.endDate = '';
    }
  }

  // ============================================
  // SKILLS METHODS
  // ============================================

  addSkill(): void {
    const newSkill: any = {
      name: '',
      level: 'Intermediate',
      category: 'Technical'
    };
    this.cvData.skills.push(newSkill);
  }

  removeSkill(index: number): void {
    this.cvData.skills.splice(index, 1);
  }

  getSkillCategories(): string[] {
    const categories = [...new Set(this.cvData.skills.map((skill: any) => skill.category))];
    return categories.filter(category => category);
  }

  getSkillsByCategory(category: string): any[] {
    return this.cvData.skills.filter((skill: any) => skill.category === category);
  }

  // ============================================
  // CERTIFICATIONS METHODS
  // ============================================

  addCertification(): void {
    const newCertification: any = {
      id: this.generateId(),
      name: '',
      issuer: '',
      dateIssued: '',
      expiryDate: '',
      credentialId: ''
    };
    this.cvData.certifications.push(newCertification);
  }

  removeCertification(id: string): void {
    this.cvData.certifications = this.cvData.certifications.filter(cert => cert.id !== id);
  }

  // ============================================
  // PROJECTS METHODS
  // ============================================

  addProject(): void {
    const newProject: any = {
      id: this.generateId(),
      name: '',
      description: '',
      technologies: '',
      startDate: '',
      endDate: '',
      githubLink: '',
      demoLink: '',
      outcomes: ''
    };
    this.cvData.projects.push(newProject);
  }

  removeProject(id: string): void {
    this.cvData.projects = this.cvData.projects.filter(project => project.id !== id);
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  private validateCurrentStep(): boolean {
    switch(this.currentStep) {
      case 1:
        const personalInfo = this.cvData.personalInfo;
        if (!personalInfo.fullName || !personalInfo.email || !personalInfo.phone || !personalInfo.professionalSummary) {
          this.displayNotification('Please fill in all required fields', 'error');
          return false;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(personalInfo.email)) {
          this.displayNotification('Please enter a valid email address', 'error');
          return false;
        }
        break;
      case 2:
        if (this.cvData.education.length === 0) {
          this.displayNotification('Please add at least one education entry', 'warning');
          return true; // Allow to proceed but warn
        }
        break;
      case 3:
        if (this.cvData.workExperience.length === 0) {
          this.displayNotification('Consider adding work experience', 'warning');
          return true; // Allow to proceed but warn
        }
        break;
    }
    return true;
  }

  private validateCV(): boolean {
    const { personalInfo, education } = this.cvData;
    
    // Check required personal info
    if (!personalInfo.fullName || !personalInfo.email || !personalInfo.phone || !personalInfo.professionalSummary) {
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(personalInfo.email)) {
      return false;
    }

    // Check if at least one education entry exists
    if (education.length === 0) {
      return false;
    }

    return true;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private displayNotification(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showNotification = true;

    // Hide notification after 5 seconds
    setTimeout(() => {
      this.showNotification = false;
    }, 5000);
  }

  private handleServiceError(error: any, action: string): void {
    console.error(`Error ${action}:`, error);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized') || 
        error.message.includes('token') || error.message.includes('authentication')) {
      this.displayNotification('Session expired. Please login again.', 'error');
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } else {
      this.displayNotification(`Error ${action}: ${error.message}`, 'error');
    }
  }

  getNotificationIcon(): string {
    switch(this.notificationType) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-exclamation-circle';
      case 'warning':
        return 'fas fa-info-circle';
      default:
        return 'fas fa-info-circle';
    }
  }

  getStepName(step: number): string {
    const stepNames = [
      'Personal Info',
      'Education',
      'Work Experience',
      'Skills',
      'Certifications',
      'Projects'
    ];
    return stepNames[step - 1];
  }

  // Helper method for downloading PDF from saved CVs list
  downloadPDFForCV(cvId: string): void {
    if (!this.checkAuthentication()) return;
    
    this.cvService.downloadCV(cvId, 'pdf', `CV_${Date.now()}.pdf`);
    this.displayNotification('Downloading PDF...', 'success');
  }
}