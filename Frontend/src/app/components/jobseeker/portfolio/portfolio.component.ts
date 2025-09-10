import { Component, OnInit } from '@angular/core';
import {DatePipe} from '@angular/common'; 
import {CommonModule} from '@angular/common';
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
  endorsements: number;
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
  imports: [CommonModule, DatePipe],
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit {
  
  // User Profile Data
  profileData = {
    fullName: 'Barbara Wanjiku',
    title: 'Turning Data into Actionable Insights',
    location: 'Nairobi, Kenya',
    profilePicture: '/assets/images/profile-picture.jpg',
    coverBanner: '/assets/images/cover-banner.jpg',
    bio: 'Business & IT graduate passionate about UI/UX design, software development, and leveraging AI for real-world solutions. Experienced in creating user-centered designs and data-driven applications.',
    email: 'barbara.wanjiku@email.com',
    phone: '+254 700 123 456'
  };

  // Training Experiences
  trainingExperiences: Training[] = [
    {
      id: 1,
      title: 'AI for Job Search',
      status: 'completed',
      trainer: 'Digital Skills Academy',
      completionDate: '2024-03-15',
      description: 'Comprehensive course on leveraging AI tools for job searching and career development.'
    },
    {
      id: 2,
      title: 'Responsive Web Design',
      status: 'completed',
      trainer: 'FreeCodeCamp',
      completionDate: '2024-02-20',
      description: 'Full-stack web development course covering HTML, CSS, JavaScript, and responsive design principles.'
    },
    {
      id: 3,
      title: 'Data Analytics Bootcamp',
      status: 'completed',
      trainer: 'Google Career Certificates',
      completionDate: '2024-01-30',
      description: 'Intensive bootcamp covering data analysis, visualization, and statistical methods.'
    },
    {
      id: 4,
      title: 'UX/UI Design Fundamentals',
      status: 'in-progress',
      trainer: 'Coursera',
      description: 'Advanced course in user experience design and interface development.'
    }
  ];

  // Certifications
  certificates: Certificate[] = [
    {
      id: 1,
      name: 'Google Data Analytics Certificate',
      issuer: 'Google',
      completionDate: '2024-01-30',
      downloadUrl: '/assets/certificates/google-data-analytics.pdf'
    },
    {
      id: 2,
      name: 'Responsive Web Design Certification',
      issuer: 'FreeCodeCamp',
      completionDate: '2024-02-20',
      downloadUrl: '/assets/certificates/freecodecamp-responsive.pdf'
    },
    {
      id: 3,
      name: 'AI for Job Search Completion',
      issuer: 'Digital Skills Academy',
      completionDate: '2024-03-15',
      downloadUrl: '/assets/certificates/ai-job-search.pdf'
    },
    {
      id: 4,
      name: 'JavaScript Algorithms and Data Structures',
      issuer: 'FreeCodeCamp',
      completionDate: '2024-02-25',
      downloadUrl: '/assets/certificates/javascript-algorithms.pdf'
    }
  ];

  // Projects
  projects: Project[] = [
    {
      id: 1,
      title: 'E-Commerce Dashboard',
      description: 'A comprehensive admin dashboard for managing online store operations with real-time analytics.',
      techStack: ['Angular', 'TypeScript', 'Chart.js', 'Bootstrap'],
      category: 'Web Apps',
      thumbnail: '/assets/projects/ecommerce-dashboard.jpg',
      liveDemo: 'https://demo-ecommerce-dashboard.com',
      githubLink: 'https://github.com/barbara/ecommerce-dashboard'
    },
    {
      id: 2,
      title: 'Mobile Banking App UI',
      description: 'Modern and intuitive mobile banking application interface with focus on user experience.',
      techStack: ['Figma', 'Adobe XD', 'Prototype'],
      category: 'UI Design',
      thumbnail: '/assets/projects/banking-app-ui.jpg',
      liveDemo: 'https://figma.com/banking-app-prototype'
    },
    {
      id: 3,
      title: 'Sales Performance Analytics',
      description: 'Interactive data visualization dashboard for tracking sales metrics and performance indicators.',
      techStack: ['Python', 'Pandas', 'Plotly', 'Streamlit'],
      category: 'Data Analysis',
      thumbnail: '/assets/projects/sales-analytics.jpg',
      liveDemo: 'https://sales-analytics-app.herokuapp.com',
      githubLink: 'https://github.com/barbara/sales-analytics'
    },
    {
      id: 4,
      title: 'Brand Identity Package',
      description: 'Complete brand identity design for a tech startup including logo, color palette, and guidelines.',
      techStack: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
      category: 'Branding & Marketing',
      thumbnail: '/assets/projects/brand-identity.jpg'
    }
  ];

  // Skills
  skills: Skill[] = [
    { name: 'UI/UX Design', endorsements: 7, category: 'Design' },
    { name: 'React Development', endorsements: 5, category: 'Development' },
    { name: 'Data Visualization', endorsements: 4, category: 'Analytics' },
    { name: 'Angular Framework', endorsements: 6, category: 'Development' },
    { name: 'Python Programming', endorsements: 3, category: 'Development' },
    { name: 'Adobe Creative Suite', endorsements: 8, category: 'Design' },
    { name: 'SQL & Databases', endorsements: 4, category: 'Analytics' },
    { name: 'Responsive Design', endorsements: 7, category: 'Development' }
  ];

  // Testimonials
  testimonials: Testimonial[] = [
    {
      id: 1,
      text: 'Barbara is a detail-oriented designer who always delivers high-quality work on time. Her analytical skills are exceptional.',
      author: 'Brian C.',
      position: 'Senior Project Manager'
    },
    {
      id: 2,
      text: 'Working with Barbara was a great experience. She brings creative solutions to complex problems.',
      author: 'Sarah M.',
      position: 'Product Owner'
    },
    {
      id: 3,
      text: 'Barbara\'s data analysis skills helped us make informed business decisions. Highly recommended!',
      author: 'David K.',
      position: 'Business Analyst'
    }
  ];

  // Filter and display properties
  selectedProjectCategory: string = 'All';
  projectCategories: string[] = ['All', 'Web Apps', 'UI Design', 'Data Analysis', 'Branding & Marketing'];
  filteredProjects: Project[] = [];
  currentTestimonialIndex: number = 0;
  viewCount: number = 245;
https: any;

  ngOnInit(): void {
    this.filteredProjects = this.projects;
    this.startTestimonialCarousel();
  }

  // Project filtering
  filterProjects(category: string): void {
    this.selectedProjectCategory = category;
    if (category === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(project => project.category === category);
    }
  }

  // Testimonial carousel
  startTestimonialCarousel(): void {
    setInterval(() => {
      this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
    }, 5000);
  }

  // Action methods
  downloadCV(): void {
    // Implementation for CV download
    const link = document.createElement('a');
    link.href = '/assets/cv/barbara-wanjiku-cv.pdf';
    link.download = 'Barbara_Wanjiku_CV.pdf';
    link.click();
  }

  downloadPortfolioPDF(): void {
    // Implementation for portfolio PDF generation
    console.log('Generating portfolio PDF...');
    // This would typically call a service to generate PDF
  }

  sharePortfolio(): void {
    const portfolioUrl = `${window.location.origin}/portfolio/barbara-wanjiku`;
    if (navigator.share) {
      navigator.share({
        title: 'Barbara Wanjiku - Portfolio',
        text: 'Check out my professional portfolio',
        url: portfolioUrl
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(portfolioUrl);
      alert('Portfolio link copied to clipboard!');
    }
  }

  openContact(): void {
    // Implementation for contact modal or redirect
    console.log('Opening contact form...');
  }

  downloadCertificate(certificate: Certificate): void {
    if (certificate.downloadUrl) {
      const link = document.createElement('a');
      link.href = certificate.downloadUrl;
      link.download = `${certificate.name.replace(/\s+/g, '_')}.pdf`;
      link.click();
    }
  }

  endorseSkill(skill: Skill): void {
    skill.endorsements++;
    // This would typically call an API to record the endorsement
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