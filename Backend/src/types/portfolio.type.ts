export interface PortfolioSettings {
  id?: number;
  user_id: number;
  theme: 'light' | 'dark' | 'auto';
  is_public: boolean;
  custom_domain?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  analytics_enabled: boolean;
  show_contact_form: boolean;
  show_download_cv: boolean;
  social_links: SocialLink[];
  custom_sections?: CustomSection[];
  created_at?: Date;
  updated_at?: Date;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
  order: number;
}

export interface CustomSection {
  id?: string;
  title: string;
  content: string;
  order: number;
  visible: boolean;
}

export interface PortfolioView {
  id?: number;
  portfolio_user_id: number;
  viewer_ip: string;
  viewer_country?: string;
  viewer_city?: string;
  user_agent?: string;
  referrer?: string;
  viewed_at?: Date;
}

export interface PortfolioData {
  personalInfo: {
    fullName: string;
    title: string;
    location: string;
    email: string;
    phone: string;
    bio: string;
    profileImage?: string;
    coverImage?: string;
  };
  skills: Array<{
    name: string;
    category: string;
    level?: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description: string;
    achievements?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    startYear: string;
    endYear?: string;
    gpa?: string;
    achievements?: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string;
    startDate?: string;
    endDate?: string;
    githubLink?: string;
    demoLink?: string;
    outcomes?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    dateIssued: string;
    expiryDate?: string;
    credentialId?: string;
  }>;
  testimonials: Array<{
    name: string;
    position: string;
    company: string;
    text: string;
    date: string;
  }>;
}