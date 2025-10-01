// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CVData } from '../types/cv.type';

// Validate CV data
export const validateCV = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const cvData: CVData = req.body;

    // Validate personal info
    if (!cvData.personal_info) {
      res.status(400).json({ success: false, message: 'Personal information is required' });
      return;
    }

    const pi = cvData.personal_info;
    if (!pi.full_name || pi.full_name.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Full name is required' });
      return;
    }

    if (!pi.email || !isValidEmail(pi.email)) {
      res.status(400).json({ success: false, message: 'Valid email is required' });
      return;
    }

    if (!pi.phone || pi.phone.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Phone number is required' });
      return;
    }

    if (!pi.professional_summary || pi.professional_summary.trim().length < 50) {
      res.status(400).json({ success: false, message: 'Professional summary must be at least 50 characters' });
      return;
    }

    // Validate education
    if (!cvData.education || !Array.isArray(cvData.education)) {
      res.status(400).json({ success: false, message: 'Education must be an array' });
      return;
    }

    for (let i = 0; i < cvData.education.length; i++) {
      const edu = cvData.education[i];
      if (!edu.institution || !edu.degree || !edu.field_of_study) {
        res.status(400).json({ success: false, message: `Education entry ${i + 1} is incomplete` });
        return;
      }
      if (!edu.start_year || !edu.end_year) {
        res.status(400).json({ success: false, message: `Education entry ${i + 1} requires start and end year` });
        return;
      }
    }

    // Validate work experience
    if (!cvData.work_experience || !Array.isArray(cvData.work_experience)) {
      res.status(400).json({ success: false, message: 'Work experience must be an array' });
      return;
    }

    for (let i = 0; i < cvData.work_experience.length; i++) {
      const work = cvData.work_experience[i];
      if (!work.company || !work.position || !work.start_date || !work.responsibilities) {
        res.status(400).json({ success: false, message: `Work experience entry ${i + 1} is incomplete` });
        return;
      }
    }

    // Validate skills
    if (!cvData.skills || !Array.isArray(cvData.skills)) {
      res.status(400).json({ success: false, message: 'Skills must be an array' });
      return;
    }

    const validLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    for (let i = 0; i < cvData.skills.length; i++) {
      const skill = cvData.skills[i];
      if (!skill.skill_name || !skill.skill_level || !skill.category) {
        res.status(400).json({ success: false, message: `Skill entry ${i + 1} is incomplete` });
        return;
      }
      if (!validLevels.includes(skill.skill_level)) {
        res.status(400).json({ success: false, message: `Skill entry ${i + 1} has invalid level` });
        return;
      }
    }

    // Validate certifications
    if (!cvData.certifications || !Array.isArray(cvData.certifications)) {
      res.status(400).json({ success: false, message: 'Certifications must be an array' });
      return;
    }

    for (let i = 0; i < cvData.certifications.length; i++) {
      const cert = cvData.certifications[i];
      if (!cert.certification_name || !cert.issuer || !cert.date_issued) {
        res.status(400).json({ success: false, message: `Certification entry ${i + 1} is incomplete` });
        return;
      }
    }

    // Validate projects
    if (!cvData.projects || !Array.isArray(cvData.projects)) {
      res.status(400).json({ success: false, message: 'Projects must be an array' });
      return;
    }

    for (let i = 0; i < cvData.projects.length; i++) {
      const project = cvData.projects[i];
      if (!project.project_name || !project.description || !project.technologies) {
        res.status(400).json({ success: false, message: `Project entry ${i + 1} is incomplete` });
        return;
      }
    }

    next();

  } catch (error: any) {
    console.error('CV validation error:', error);
    res.status(400).json({ success: false, message: 'Invalid CV data format' });
    return;
  }
};

// Helper functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate CV for draft (less strict)
export const validateCVDraft = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const cvData: CVData = req.body;

    if (!cvData.personal_info || !cvData.personal_info.full_name) {
      res.status(400).json({ success: false, message: 'Personal information with full name is required' });
      return;
    }

    next();
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Invalid CV data format' });
    return;
  }
};