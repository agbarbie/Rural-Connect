// src/types/profile.type.ts

export interface ProfileData {
  userId: string;
  cvId: string;
  personalInfo: {
    fullName: string;
    title: string;
    location: string;
    email: string;
    phone: string;
    profileImage?: string;
    about: string;
    linkedIn?: string;
    website?: string;
  };
  profileCompletion: number;
  skills: {
    technical: Skill[];
    soft: Skill[];
  };
  certifications: Certification[];
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  recommendations: Recommendation[];
  socialLinks: SocialLink[];
  workSamples: WorkSample[];
}

export interface Skill {
  name: string;
  type: 'technical' | 'soft';
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  category?: string;
}

export interface Certification {
  title: string;
  organization: string;
  completionDate: string;
  badgeUrl?: string;
  certificateUrl?: string;
}

export interface Experience {
  title: string;
  company: string;
  duration: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
  achievements: string[];
  companyLogo?: string;
}

export interface Education {
  degree: string;
  institution: string;
  graduationDate: string;
  coursework?: string[];
  gpa?: string;
}

export interface Project {
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string;
}

export interface Recommendation {
  name: string;
  position: string;
  company: string;
  text: string;
  date: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

export interface WorkSample {
  name: string;
  type: string;
  size: string;
  url: string;
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  data?: ProfileData;
}