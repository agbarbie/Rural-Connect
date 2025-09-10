import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  linkedIn: string;
  website: string;
  professionalSummary: string;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  gpa?: string;
  achievements: string;
}

interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  current: boolean;
  responsibilities: string;
  achievements: string;
}

interface Skill {
  name: string;
  level: string;
  category: string;
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  dateIssued: string;
  expiryDate?: string;
  credentialId?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string;
  startDate: string;
  endDate: string;
  githubLink?: string;
  demoLink?: string;
  outcomes: string;
}

interface CVData {
  personalInfo: PersonalInfo;
  education: Education[];
  workExperience: WorkExperience[];
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
}

@Component({
  selector: 'app-cv-builder',
  templateUrl: './cv-builder.component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./cv-builder.component.css']
})
export class CvBuilderComponent implements OnInit {
  
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

  cvData: CVData = {
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      linkedIn: '',
      website: '',
      professionalSummary: ''
    },
    education: [],
    workExperience: [],
    skills: [],
    certifications: [],
    projects: []
  };

  skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  skillCategories = ['Technical', 'Programming', 'Design', 'Management', 'Communication', 'Other'];
  
  availableSkills = [
    'JavaScript', 'TypeScript', 'Angular', 'React', 'Vue.js', 'Node.js', 'Python', 'Java',
    'C#', 'PHP', 'HTML', 'CSS', 'SASS', 'Bootstrap', 'Tailwind CSS', 'SQL', 'MongoDB',
    'PostgreSQL', 'Git', 'Docker', 'AWS', 'Azure', 'Google Cloud', 'Project Management',
    'Agile', 'Scrum', 'Leadership', 'Team Management', 'Communication', 'Problem Solving'
  ];

  constructor() { }

  ngOnInit(): void {
    this.loadSavedCV();
  }

  // File upload and drag-drop handlers
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
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
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
    
    // Simulate file processing (replace with actual parsing logic)
    setTimeout(() => {
      this.parseCV(file);
    }, 2000);
  }

  private parseCV(file: File): void {
    const reader = new FileReader();

    reader.onload = (e) => {
      this.isProcessingFile = false;
      
      // Simulate extracted data (replace with actual parsing results)
      this.simulateExtractedData();
      
      this.displayNotification('CV uploaded and parsed successfully!', 'success');
      this.startCVBuilder();
    };

    reader.onerror = () => {
      this.isProcessingFile = false;
      this.displayNotification('Error reading file. Please try again.', 'error');
    };

    if (file.type === 'text/plain') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  private simulateExtractedData(): void {
    // Simulate parsed CV data - replace with actual parsing logic
    this.cvData = {
      personalInfo: {
        fullName: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+254 700 123 456',
        address: 'Nairobi, Kenya',
        linkedIn: 'https://linkedin.com/in/johndoe',
        website: 'https://johndoe.dev',
        professionalSummary: 'Experienced software developer with 5+ years of experience in web development and mobile applications.'
      },
      education: [
        {
          id: this.generateId(),
          institution: 'University of Nairobi',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startYear: '2016',
          endYear: '2020',
          gpa: '3.8/4.0',
          achievements: 'Dean\'s List, President of Computer Science Society'
        }
      ],
      workExperience: [
        {
          id: this.generateId(),
          company: 'Tech Solutions Ltd',
          position: 'Senior Software Developer',
          startDate: '2021-01',
          endDate: '',
          current: true,
          responsibilities: 'Lead development of web applications using React and Node.js. Mentor junior developers and conduct code reviews.',
          achievements: 'Improved application performance by 40%, led team of 3 developers'
        }
      ],
      skills: [
        { name: 'JavaScript', level: 'Expert', category: 'Programming' },
        { name: 'React', level: 'Advanced', category: 'Programming' },
        { name: 'Node.js', level: 'Advanced', category: 'Programming' },
        { name: 'Project Management', level: 'Intermediate', category: 'Management' }
      ],
      certifications: [
        {
          id: this.generateId(),
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          dateIssued: '2022-06',
          expiryDate: '2025-06',
          credentialId: 'AWS-SAA-123456'
        }
      ],
      projects: [
        {
          id: this.generateId(),
          name: 'E-commerce Platform',
          description: 'Full-stack e-commerce solution built with React, Node.js, and MongoDB',
          technologies: 'React, Node.js, MongoDB, Stripe API',
          startDate: '2022-01',
          endDate: '2022-06',
          githubLink: 'https://github.com/johndoe/ecommerce',
          demoLink: 'https://ecommerce-demo.com',
          outcomes: 'Successfully launched platform with 1000+ active users'
        }
      ]
    };
  }

  startNewCV(): void {
    // Reset CV data
    this.cvData = {
      personalInfo: {
        fullName: '',
        email: '',
        phone: '',
        address: '',
        linkedIn: '',
        website: '',
        professionalSummary: ''
      },
      education: [],
      workExperience: [],
      skills: [],
      certifications: [],
      projects: []
    };

    this.startCVBuilder();
  }

  private startCVBuilder(): void {
    this.showWelcome = false;
    this.currentStep = 1;
  }

  // Navigation methods
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

  // Education methods
  addEducation(): void {
    const newEducation: Education = {
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

  // Work Experience methods
  addWorkExperience(): void {
    const newWork: WorkExperience = {
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

  onCurrentJobChange(work: WorkExperience): void {
    if (work.current) {
      work.endDate = '';
    }
  }

  // Skills methods
  addSkill(): void {
    const newSkill: Skill = {
      name: '',
      level: 'Intermediate',
      category: 'Technical'
    };
    this.cvData.skills.push(newSkill);
  }

  removeSkill(index: number): void {
    this.cvData.skills.splice(index, 1);
  }

  // Certifications methods
  addCertification(): void {
    const newCertification: Certification = {
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

  // Projects methods
  addProject(): void {
    const newProject: Project = {
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

  // Save and Load methods
  saveAsDraft(): void {
    this.isDraft = true;
    // Save to localStorage or send to backend
    this.displayNotification('CV saved as draft successfully!', 'success');
  }

  saveAsFinal(): void {
    if (this.validateCV()) {
      this.isDraft = false;
      // Save to localStorage or send to backend
      this.displayNotification('CV saved as final successfully!', 'success');
    } else {
      this.displayNotification('Please complete all required fields before saving as final.', 'error');
    }
  }

  loadSavedCV(): void {
    // Load from localStorage or backend
    // Implementation would go here
  }

  // Preview and Export methods
  togglePreview(): void {
    this.previewMode = !this.previewMode;
  }

  downloadPDF(): void {
    // Implement PDF download logic here
    // You would typically use libraries like jsPDF or send data to backend
    this.displayNotification('PDF download feature will be implemented with jsPDF library.', 'warning');
  }

  downloadWord(): void {
    // Implement Word document download logic here
    // You would typically use libraries like docx or send data to backend
    this.displayNotification('Word download feature will be implemented with docx library.', 'warning');
  }

  // Validation methods
  private validateCurrentStep(): boolean {
    switch(this.currentStep) {
      case 1:
        const personalInfo = this.cvData.personalInfo;
        if (!personalInfo.fullName || !personalInfo.email || !personalInfo.phone || !personalInfo.professionalSummary) {
          this.displayNotification('Please fill in all required fields', 'error');
          return false;
        }
        break;
      // Add validation for other steps as needed
    }
    return true;
  }

  private validateCV(): boolean {
    const { personalInfo, education, workExperience } = this.cvData;
    
    // Check required personal info
    if (!personalInfo.fullName || !personalInfo.email || !personalInfo.phone || !personalInfo.professionalSummary) {
      return false;
    }

    // Check if at least one education entry exists and is complete
    if (education.length === 0) {
      return false;
    }

    // Additional validations can be added here
    return true;
  }

  // Utility methods
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

  // Getter for step names
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

  // Helper methods for skills in preview
  getSkillCategories(): string[] {
    const categories = [...new Set(this.cvData.skills.map(skill => skill.category))];
    return categories.filter(category => category);
  }

  getSkillsByCategory(category: string): Skill[] {
    return this.cvData.skills.filter(skill => skill.category === category);
  }
}