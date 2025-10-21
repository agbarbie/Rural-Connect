// src/controllers/profile.controller.ts
import { Request, Response } from 'express';
import pool from '../db/db.config';
import crypto from 'crypto';

interface ProfileCompletionResult {
  completion: number;
  missingFields: string[];
  completedSections: CompletedSection[];
  recommendations: string[];
}

interface CompletedSection {
  name: string;
  completed: boolean;
  weight: number;
  fields?: FieldStatus[];
}

interface FieldStatus {
  field: string;
  completed: boolean;
  required: boolean;
}

class ProfileController {
  /**
   * @desc Get current user's profile
   * @route GET /api/profile
   */
  async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const query = `
        SELECT u.id, u.name, u.email, u.profile_picture, p.*
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const { rows } = await pool.query(query, [userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'Profile not found' });
        return;
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('Error in getMyProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Get profile by CV ID
   * @route GET /api/profile/cv/:cvId
   */
  async getProfileByCVId(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { cvId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const query = `
        SELECT u.id, u.name, u.email, u.profile_picture, p.*
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        LEFT JOIN cvs c ON p.id = c.profile_id
        WHERE c.id = $1 AND u.id = $2
      `;
      const { rows } = await pool.query(query, [cvId, userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'Profile not found' });
        return;
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('Error in getProfileByCVId:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Update profile picture
   * @route PUT /api/profile/picture
   */
  async updateProfilePicture(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { profilePicture } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const query = `
        UPDATE users
        SET profile_picture = $1
        WHERE id = $2
        RETURNING id, name, email, profile_picture
      `;
      const { rows } = await pool.query(query, [profilePicture, userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile picture updated',
        data: rows[0],
      });
    } catch (error) {
      console.error('Error in updateProfilePicture:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Get detailed profile completion status
   * @route GET /api/profile/completion
   */
  async getProfileCompletion(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // --- Fetch User + Profile
      const userQuery = `
        SELECT u.id, u.name, u.email, u.profile_picture,
               p.id as profile_id, p.bio, p.skills, p.phone, p.location,
               p.website_url, p.linkedin_url, p.github_url
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const { rows: userRows } = await pool.query(userQuery, [userId]);

      if (!userRows.length) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const user = userRows[0];

      // --- Fetch latest CV
      const cvQuery = `
        SELECT id, personal_info, skills, work_experience, education, certifications, projects
        FROM cvs WHERE user_id = $1
        ORDER BY updated_at DESC LIMIT 1
      `;
      const { rows: cvRows } = await pool.query(cvQuery, [userId]);
      const latestCV = cvRows[0] || null;

      // --- Begin Section Calculations
      const sections: CompletedSection[] = [];
      const missingFields: string[] = [];
      const recommendations: string[] = [];

      // Basic Info
      const basicFields: FieldStatus[] = [
        { field: 'Full Name', completed: !!user.name, required: true },
        { field: 'Email', completed: !!user.email, required: true },
        { field: 'Phone Number', completed: !!user.phone, required: true },
        { field: 'Profile Picture', completed: !!user.profile_picture, required: false },
        { field: 'Location', completed: !!user.location, required: false },
      ];
      const missingBasic = basicFields.filter(f => f.required && !f.completed);
      missingBasic.forEach(f => missingFields.push(f.field));
      sections.push({
        name: 'Basic Information',
        completed: missingBasic.length === 0,
        weight: 20,
        fields: basicFields,
      });

      // Summary
      const hasSummary = !!user.bio || !!latestCV?.personal_info?.professional_summary;
      if (!hasSummary) {
        missingFields.push('Professional Summary');
        recommendations.push('Add a professional summary to attract employers.');
      }
      sections.push({
        name: 'Professional Summary',
        completed: hasSummary,
        weight: 15,
      });

      // Skills
      let skillsCount = 0;
      try {
        if (user.skills) {
          const parsed = JSON.parse(user.skills);
          skillsCount = Array.isArray(parsed) ? parsed.length : 0;
        } else if (latestCV?.skills) {
          skillsCount = Array.isArray(latestCV.skills) ? latestCV.skills.length : 0;
        }
      } catch {
        skillsCount = 0;
      }
      const hasSkills = skillsCount >= 3;
      if (!hasSkills) {
        missingFields.push('Skills');
        recommendations.push('Add at least 3 relevant skills.');
      }
      sections.push({ name: 'Skills', completed: hasSkills, weight: 15 });

      // Experience
      const expCount = Array.isArray(latestCV?.work_experience) ? latestCV.work_experience.length : 0;
      const hasExp = expCount > 0;
      if (!hasExp) {
        missingFields.push('Work Experience');
        recommendations.push('Add your work experience.');
      }
      sections.push({ name: 'Work Experience', completed: hasExp, weight: 20 });

      // Education
      const eduCount = Array.isArray(latestCV?.education) ? latestCV.education.length : 0;
      const hasEdu = eduCount > 0;
      if (!hasEdu) {
        missingFields.push('Education');
        recommendations.push('Add your education background.');
      }
      sections.push({ name: 'Education', completed: hasEdu, weight: 15 });

      // Certifications
      const certCount = Array.isArray(latestCV?.certifications) ? latestCV.certifications.length : 0;
      const hasCerts = certCount > 0;
      if (!hasCerts) recommendations.push('Add professional certifications.');
      sections.push({ name: 'Certifications', completed: hasCerts, weight: 5 });

      // Projects
      const projCount = Array.isArray(latestCV?.projects) ? latestCV.projects.length : 0;
      const hasProjects = projCount > 0;
      if (!hasProjects) recommendations.push('Showcase your projects.');
      sections.push({ name: 'Projects', completed: hasProjects, weight: 5 });

      // Social Links
      const socials = [user.linkedin_url, user.github_url, user.website_url].filter(Boolean).length;
      const hasSocials = socials >= 1;
      if (!hasSocials) recommendations.push('Add your LinkedIn, GitHub, or Portfolio.');
      sections.push({ name: 'Social Links', completed: hasSocials, weight: 5 });

      // Calculate completion
      const totalCompletion = sections.reduce(
        (sum, s) => sum + (s.completed ? s.weight : 0),
        0
      );

      const result: ProfileCompletionResult = {
        completion: Math.round(totalCompletion),
        missingFields,
        completedSections: sections,
        recommendations,
      };

      // Add status summary message
      if (totalCompletion < 50) {
        result.recommendations.unshift('🎯 Focus on completing Basic Info and Experience first.');
      } else if (totalCompletion < 80) {
        result.recommendations.unshift('💡 Add more details to reach 80% completion.');
      } else {
        result.recommendations.unshift('🎉 Excellent! Your profile is highly complete.');
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Error in getProfileCompletion:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Generate shareable profile link
   * @route POST /api/profile/share
   */
  async shareProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const shareToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const query = `
        INSERT INTO profile_shares (user_id, share_token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING share_token, expires_at
      `;
      const { rows } = await pool.query(query, [userId, shareToken, expiresAt]);

      res.status(201).json({
        success: true,
        data: {
          link: `${process.env.FRONTEND_URL}/profile/share/${rows[0].share_token}`,
          expiresAt: rows[0].expires_at,
        },
      });
    } catch (error) {
      console.error('Error in shareProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Get shared profile by token
   * @route GET /api/profile/shared/:token
   */
  async getSharedProfile(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const query = `
        SELECT u.id, u.name, u.email, u.profile_picture, p.*
        FROM profile_shares s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE s.share_token = $1 AND s.expires_at > NOW()
      `;
      const { rows } = await pool.query(query, [token]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'Shared profile not found or expired' });
        return;
      }

      await pool.query(`SELECT increment_profile_view_count($1)`, [token]);

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('Error in getSharedProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

export default new ProfileController();
