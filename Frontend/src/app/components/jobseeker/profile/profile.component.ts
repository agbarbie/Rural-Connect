import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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

  // Profile Data
  profile = {
    fullName: 'Alex Johnson',
    title: 'Full Stack Developer & UI/UX Designer',
    location: 'Nairobi, Kenya',
    email: 'alex.johnson@email.com',
    phone: '+254 712 345 678',
    profileCompletion: 95,
    profileImage: 'assets/images/profile-placeholder.jpg',
    about: 'Experienced Software Engineer with 8+ years in full-stack development. Skilled in React, Python, and cloud solutions. Passionate about scalable applications and team leadership. Currently seeking opportunities to leverage my expertise in modern web technologies and contribute to innovative projects.'
  };

  // Skills
  technicalSkills: Skill[] = [
    { name: 'JavaScript', type: 'technical', level: 'Expert' },
    { name: 'Angular', type: 'technical', level: 'Advanced' },
    { name: 'React', type: 'technical', level: 'Advanced' },
    { name: 'Python', type: 'technical', level: 'Advanced' },
    { name: 'Node.js', type: 'technical', level: 'Advanced' },
    { name: 'SQL', type: 'technical', level: 'Intermediate' },
    { name: 'AWS', type: 'technical', level: 'Intermediate' },
    { name: 'Docker', type: 'technical', level: 'Intermediate' }
  ];

  softSkills: Skill[] = [
    { name: 'Leadership', type: 'soft' },
    { name: 'Team Collaboration', type: 'soft' },
    { name: 'Problem Solving', type: 'soft' },
    { name: 'Communication', type: 'soft' },
    { name: 'Project Management', type: 'soft' },
    { name: 'Mentoring', type: 'soft' }
  ];

  // Certifications
  certifications: Certification[] = [
    {
      title: 'AWS Certified Solutions Architect',
      organization: 'Amazon Web Services',
      completionDate: '2024-03-15',
      badgeUrl: 'assets/badges/aws-badge.png',
      certificateUrl: 'assets/certificates/aws-cert.pdf'
    },
    {
      title: 'Google UX Design Professional Certificate',
      organization: 'Google',
      completionDate: '2023-11-20',
      badgeUrl: 'assets/badges/google-ux-badge.png',
      certificateUrl: 'assets/certificates/google-ux-cert.pdf'
    },
    {
      title: 'Certified Scrum Master',
      organization: 'Scrum Alliance',
      completionDate: '2023-08-10',
      badgeUrl: 'assets/badges/scrum-badge.png',
      certificateUrl: 'assets/certificates/scrum-cert.pdf'
    }
  ];

  // Experience
  experiences: Experience[] = [
    {
      title: 'Senior Full Stack Developer',
      company: 'TechCorp Solutions',
      duration: '3 years 2 months',
      startDate: '2022-01',
      endDate: 'Present',
      companyLogo: 'assets/logos/techcorp-logo.png',
      responsibilities: [
        'Lead development of scalable web applications using React and Node.js',
        'Mentor junior developers and conduct code reviews',
        'Collaborate with UX/UI team to implement responsive designs'
      ],
      achievements: [
        'Improved application performance by 40%',
        'Led team of 5 developers on major product launch',
        'Implemented CI/CD pipeline reducing deployment time by 60%'
      ]
    },
    {
      title: 'Frontend Developer',
      company: 'Digital Innovations Ltd',
      duration: '2 years 6 months',
      startDate: '2019-07',
      endDate: '2021-12',
      companyLogo: 'assets/logos/digital-innovations-logo.png',
      responsibilities: [
        'Developed responsive web applications using Angular and Vue.js',
        'Collaborated with backend team to integrate APIs',
        'Optimized applications for maximum speed and scalability'
      ],
      achievements: [
        'Delivered 15+ successful projects on time',
        'Reduced page load times by 50%',
        'Implemented modern UI/UX best practices'
      ]
    }
  ];

  // Education
  education: Education[] = [
    {
      degree: 'Bachelor of Science in Computer Science',
      institution: 'University of Nairobi',
      graduationDate: '2019-06-15',
      coursework: ['Data Structures', 'Software Engineering', 'Database Systems', 'Web Development'],
      gpa: '3.8/4.0'
    }
  ];

  // Projects
  projects: Project[] = [
    {
      title: 'E-Commerce Platform',
      description: 'Full-stack e-commerce solution with React frontend and Node.js backend, featuring payment integration and admin dashboard.',
      technologies: ['React', 'Node.js', 'MongoDB', 'Stripe API', 'AWS'],
      githubUrl: 'https://github.com/alexjohnson/ecommerce-platform',
      liveUrl: 'https://ecommerce-demo.com',
      imageUrl: 'assets/projects/ecommerce-project.jpg'
    },
    {
      title: 'Task Management App',
      description: 'Collaborative task management application with real-time updates, built using Angular and Firebase.',
      technologies: ['Angular', 'Firebase', 'TypeScript', 'Material Design'],
      githubUrl: 'https://github.com/alexjohnson/task-manager',
      liveUrl: 'https://taskmaster-app.com',
      imageUrl: 'assets/projects/taskmanager-project.jpg'
    },
    {
      title: 'Weather Dashboard',
      description: 'Interactive weather dashboard with data visualization and location-based forecasts.',
      technologies: ['Vue.js', 'Chart.js', 'OpenWeather API', 'CSS3'],
      githubUrl: 'https://github.com/alexjohnson/weather-dashboard',
      liveUrl: 'https://weather-insights.com',
      imageUrl: 'assets/projects/weather-project.jpg'
    }
  ];

  // Recommendations
  recommendations: Recommendation[] = [
    {
      name: 'Sarah Mitchell',
      position: 'Senior Project Manager',
      company: 'TechCorp Solutions',
      text: 'Alex is an exceptional developer with strong leadership qualities. His technical expertise and ability to mentor others make him a valuable team member.',
      date: '2024-02-15'
    },
    {
      name: 'Michael Chen',
      position: 'CTO',
      company: 'Digital Innovations Ltd',
      text: 'Working with Alex was a pleasure. His dedication to quality code and innovative solutions consistently exceeded our expectations.',
      date: '2021-12-10'
    }
  ];

  // Social Links
  socialLinks: SocialLink[] = [
    { platform: 'LinkedIn', url: 'https://linkedin.com/in/alexjohnson', icon: 'fab fa-linkedin' },
    { platform: 'GitHub', url: 'https://github.com/alexjohnson', icon: 'fab fa-github' },
    { platform: 'Portfolio', url: 'https://alexjohnson.dev', icon: 'fas fa-globe' },
    { platform: 'Twitter', url: 'https://twitter.com/alexjohnsondev', icon: 'fab fa-twitter' }
  ];

  // Work Samples
  workSamples: WorkSample[] = [
    { name: 'Portfolio_Design.pdf', type: 'PDF', size: '2.4 MB', url: 'assets/samples/portfolio-design.pdf' },
    { name: 'Code_Sample.zip', type: 'ZIP', size: '5.1 MB', url: 'assets/samples/code-sample.zip' },
    { name: 'UI_Mockups.fig', type: 'Figma', size: '8.2 MB', url: 'assets/samples/ui-mockups.fig' }
  ];

  constructor() { }

  ngOnInit(): void {
    // Initialize component
    console.log('Profile component initialized');
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
    // Implement profile editing logic
    console.log('Editing profile...');
    // You can navigate to edit profile component here
    // this.router.navigate(['/profile/edit']);
  }

  shareProfile(): void {
    // Implement profile sharing logic
    if (navigator.share) {
      navigator.share({
        title: `${this.profile.fullName} - Profile`,
        text: `Check out ${this.profile.fullName}'s professional profile`,
        url: window.location.href,
      }).catch(err => console.log('Error sharing:', err));
    } else {
      // Fallback for browsers that don't support Web Share API
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