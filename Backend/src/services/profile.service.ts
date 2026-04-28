// src/services/profile.service.ts
import { CVData } from '../types/cv.type';
import { ProfileData, Skill, Experience } from '../types/profile.type';

export class ProfileService {
  
  /**
   * Transform CV data into profile format
   */
  async transformCVToProfile(cvData: CVData, userId: string, cvId: string): Promise<ProfileData> {
    const profile: ProfileData = {
      userId,
      cvId,
      personalInfo: this.extractPersonalInfo(cvData),
      profileCompletion: 0,
      skills: this.extractSkills(cvData),
      certifications: this.extractCertifications(cvData),
      experiences: this.extractExperiences(cvData),
      education: this.extractEducation(cvData),
      projects: this.extractProjects(cvData),
      recommendations: this.generateRecommendations(cvData),
      socialLinks: this.extractSocialLinks(cvData),
      workSamples: []
    };

    profile.profileCompletion = this.calculateProfileCompletion(profile);

    return profile;
  }

  /**
   * Extract personal information from CV data
   */
  private extractPersonalInfo(cvData: CVData) {
    const personalInfo = cvData.personal_info || cvData.personal_info;
    
    return {
      fullName: personalInfo?.full_name || personalInfo?.full_name || '',
      title: this.generateTitle(cvData),
      location: personalInfo?.address || '',
      email: personalInfo?.email || '',
      phone: personalInfo?.phone || '',
      profileImage: undefined,
      about: personalInfo?.professional_summary || personalInfo?.professional_summary || '',
      linkedIn: personalInfo?.linkedIn || personalInfo?.linkedIn || undefined,
      website: personalInfo?.website || undefined,
      github: personalInfo?.github || undefined
    };
  }

  /**
   * Generate professional title from CV data
   */
  private generateTitle(cvData: CVData): string {
    // Try to get title from most recent work experience
    const workExp = cvData.work_experience || cvData.work_experience || [];
    if (workExp.length > 0) {
      return workExp[0].position || workExp[0].title || 'Professional';
    }

    // Try to generate from skills
    const skills = cvData.skills || [];
    if (skills.length > 0) {
      const topSkills = skills.slice(0, 3).map(s => s.name || s.skill_name || '');
      return `${topSkills.join(' | ')} Specialist`;
    }

    return 'Professional';
  }

  /**
   * Extract and categorize skills
   */
  private extractSkills(cvData: CVData) {
    const skills = cvData.skills || [];
    
    const technicalSkills: Skill[] = [];
    const softSkills: Skill[] = [];

    skills.forEach((skill: any) => {
      const skillName = skill.name || skill.skill_name || '';
      const skillCategory = skill.category || skill.skill_category || 'Other';
      const skillLevel = skill.level || skill.skill_level;

      if (['Technical', 'Programming', 'Design', 'Tools'].includes(skillCategory)) {
        technicalSkills.push({
          name: skillName,
          type: 'technical',
          level: skillLevel as any,
          category: skillCategory
        });
      } else {
        softSkills.push({
          name: skillName,
          type: 'soft',
          category: skillCategory
        });
      }
    });

    return { technical: technicalSkills, soft: softSkills };
  }

  /**
   * Extract certifications
   */
  private extractCertifications(cvData: CVData) {
    const certs = cvData.certifications || [];
    
    return certs.map((cert: any) => ({
      title: cert.name || cert.title || '',
      organization: cert.issuer || cert.organization || '',
      completionDate: cert.dateIssued || cert.date_issued || new Date().toISOString().split('T')[0],
      badgeUrl: undefined,
      certificateUrl: cert.credentialId || cert.credential_id || cert.url || undefined
    }));
  }

  /**
   * Extract work experiences
   */
  private extractExperiences(cvData: CVData) {
    const workExp = cvData.work_experience || cvData.work_experience || [];
    
    return workExp.map((work: any): Experience => {
      const startDate = new Date(work.startDate || work.start_date || Date.now());
      const endDate = (work.current || work.is_current) 
        ? new Date() 
        : new Date(work.endDate || work.end_date || Date.now());
      
      const duration = this.calculateDuration(startDate, endDate);

      return {
        title: work.position || work.title || '',
        company: work.company || work.employer || '',
        duration,
        startDate: work.startDate || work.start_date || startDate.toISOString().split('T')[0],
        endDate: (work.current || work.is_current) 
          ? 'Present' 
          : (work.endDate || work.end_date || endDate.toISOString().split('T')[0]),
        responsibilities: this.parseMultilineText(
          work.responsibilities || work.key_responsibilities || ''
        ),
        achievements: this.parseMultilineText(
          work.achievements || work.key_achievements || ''
        ),
        companyLogo: undefined
      };
    });
  }

  /**
   * Extract education
   */
  private extractEducation(cvData: CVData) {
    const education = cvData.education || [];
    
    return education.map((edu: any) => {
      const coursework = edu.achievements || edu.coursework
        ? (edu.achievements || edu.coursework).split(',').map((a: string) => a.trim()).filter(Boolean)
        : undefined;

      const degree = edu.degree || '';
      const field = edu.fieldOfStudy || edu.field_of_study || '';
      const fullDegree = degree + (field ? ` in ${field}` : '');

      return {
        degree: fullDegree,
        institution: edu.institution || edu.school || '',
        graduationDate: edu.endYear || edu.end_year 
          ? `${edu.endYear || edu.end_year}-06-01` 
          : new Date().toISOString().split('T')[0],
        gpa: edu.gpa || undefined,
        coursework
      };
    });
  }

  /**
   * Extract projects
   */
  private extractProjects(cvData: CVData) {
    const projects = cvData.projects || [];
    
    return projects.map((proj: any) => ({
      title: proj.name || proj.project_name || proj.title || 'Untitled Project',
      description: proj.description || '',
      technologies: (proj.technologies || proj.tech_stack || '')
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => t),
      githubUrl: proj.githubLink || proj.github_link || proj.github || undefined,
      liveUrl: proj.demoLink || proj.demo_link || proj.live_url || undefined,
      imageUrl: proj.image || undefined
    }));
  }

  /**
   * Generate recommendations from work experience
   */
  private generateRecommendations(cvData: CVData) {
    const recommendations: any[] = [];
    const workExp = cvData.work_experience || cvData.work_experience || [];

    workExp.forEach((work: any) => {
      const achievements = work.achievements || work.key_achievements;
      if (achievements) {
        const achievementLines = this.parseMultilineText(achievements);
        if (achievementLines.length > 0) {
          recommendations.push({
            name: `Colleague from ${work.company || work.employer || 'Previous Role'}`,
            position: 'Team Member',
            company: work.company || work.employer || 'Previous Company',
            text: achievementLines[0],
            date: work.endDate || work.end_date || new Date().toISOString().split('T')[0]
          });
        }
      }
    });

    // Add default recommendation if none exist
    if (recommendations.length === 0) {
      recommendations.push({
        name: 'Professional Contact',
        position: 'Colleague',
        company: 'Various',
        text: 'Excellent professional with great attention to detail and strong technical skills.',
        date: new Date().toISOString().split('T')[0]
      });
    }

    return recommendations;
  }

  /**
   * Extract social links
   */
  private extractSocialLinks(cvData: CVData) {
    const socialLinks: any[] = [];
    const personalInfo = cvData.personal_info || cvData.personal_info;

    if (personalInfo?.linkedIn || personalInfo?.linkedIn) {
      socialLinks.push({
        platform: 'LinkedIn',
        url: personalInfo.linkedIn || personalInfo.linkedIn,
        icon: 'fab fa-linkedin'
      });
    }

    if (personalInfo?.github) {
      socialLinks.push({
        platform: 'GitHub',
        url: personalInfo.github,
        icon: 'fab fa-github'
      });
    }

    if (personalInfo?.website) {
      socialLinks.push({
        platform: 'Portfolio',
        url: personalInfo.website,
        icon: 'fas fa-globe'
      });
    }

    // Add Twitter if present (assuming twitter or x handle)
    if (personalInfo?.twitter || personalInfo?.x_handle) {
      socialLinks.push({
        platform: 'Twitter',
        url: `https://twitter.com/${personalInfo.twitter || personalInfo.x_handle}`,
        icon: 'fab fa-twitter'
      });
    }

    return socialLinks;
  }

  /**
   * Calculate profile completion percentage
   */
  private calculateProfileCompletion(profile: ProfileData): number {
    let completedSections = 0;
    const totalSections = 8;

    if (profile.personalInfo.fullName && profile.personalInfo.email) completedSections++;
    if (profile.personalInfo.about) completedSections++;
    if (profile.skills.technical.length > 0 || profile.skills.soft.length > 0) completedSections++;
    if (profile.education.length > 0) completedSections++;
    if (profile.experiences.length > 0) completedSections++;
    if (profile.certifications.length > 0) completedSections++;
    if (profile.projects.length > 0) completedSections++;
    if (profile.socialLinks.length > 0) completedSections++;

    return Math.round((completedSections / totalSections) * 100);
  }

  /**
   * Calculate duration between two dates
   */
  private calculateDuration(start: Date, end: Date): string {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Less than 1 month';
    }

    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                   (end.getMonth() - start.getMonth());
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years > 0 && remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else if (remainingMonths > 0) {
      return `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }

    return 'Less than 1 month';
  }

  /**
   * Parse multiline text into array
   */
  private parseMultilineText(text: string): string[] {
    if (!text || typeof text !== 'string') return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}

export default new ProfileService();