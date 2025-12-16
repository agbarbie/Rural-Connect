// src/controllers/profile.controller.ts - Fixed version with image upload
import { Request, Response } from 'express';
import pool from '../db/db.config';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

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
        SELECT u.id, u.name, u.email, u.profile_picture as profile_image, p.*
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const { rows } = await pool.query(query, [userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'Profile not found' });
        return;
      }

      // ✅ Ensure profile_image is included in response
      const profileData = rows[0];
      
      res.status(200).json({ 
        success: true, 
        data: {
          ...profileData,
          profile_image: profileData.profile_image || profileData.profile_picture,
          profileImage: profileData.profile_image || profileData.profile_picture
        }
      });
    } catch (error) {
      console.error('Error in getMyProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Update current user's profile
   * @route PATCH /api/profile
   */
  async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const updates = req.body;
      console.log('Received updates:', JSON.stringify(updates, null, 2));

      const allowedFields = [
        'bio', 'skills', 'phone', 'location', 'portfolio_url',
        'linkedin_url', 'github_url', 'website_url', 'years_of_experience',
        'current_position', 'availability_status', 'preferred_job_types',
        'preferred_locations', 'salary_expectation_min', 'salary_expectation_max'
      ];
      
      const updateFields: any = {};
      const arrayFields = ['skills', 'preferred_job_types', 'preferred_locations'];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (arrayFields.includes(field)) {
            try {
              let arr: string[] = [];
              
              // Handle different input formats
              if (Array.isArray(updates[field])) {
                arr = updates[field];
              } else if (typeof updates[field] === 'string') {
                // Try parsing as JSON first
                try {
                  const parsed = JSON.parse(updates[field]);
                  arr = Array.isArray(parsed) ? parsed : [];
                } catch {
                  // If not JSON, split by comma/newline
                  arr = updates[field]
                    .split(/[,\n]+/)
                    .map((item: string) => item.trim())
                    .filter((item: string) => item.length > 0);
                }
              }

              // Clean and validate array items
              arr = arr.map(item => String(item).trim()).filter(item => item.length > 0);

              console.log(`Processed ${field}:`, arr);

              // Store as JSON string
              updateFields[field] = JSON.stringify(arr);
            } catch (e) {
              console.error(`Error processing array field ${field}:`, e);
              updateFields[field] = '[]';
            }
          } else {
            updateFields[field] = updates[field];
          }
        }
      }

      console.log('Final updateFields:', JSON.stringify(updateFields, null, 2));

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ success: false, message: 'No valid fields to update' });
        return;
      }

      const checkQuery = `SELECT id FROM jobseeker_profiles WHERE user_id = $1`;
      const { rows: existing } = await pool.query(checkQuery, [userId]);

      let query: string;
      let values: any[];

      if (existing.length === 0) {
        // INSERT
        const columns = Object.keys(updateFields).join(', ');
        const placeholders = Object.keys(updateFields).map((_, i) => `$${i + 2}`).join(', ');
        query = `
          INSERT INTO jobseeker_profiles (user_id, ${columns})
          VALUES ($1, ${placeholders})
          RETURNING *
        `;
        values = [userId, ...Object.values(updateFields)];
        
        console.log('Executing INSERT query');
        const { rows } = await pool.query(query, values);
        res.status(201).json({ success: true, message: 'Profile created', data: rows[0] });
      } else {
        // UPDATE
        const setClause = Object.keys(updateFields).map((field, i) => `${field} = $${i + 2}`).join(', ');
        query = `
          UPDATE jobseeker_profiles
          SET ${setClause}, updated_at = NOW()
          WHERE user_id = $1
          RETURNING *
        `;
        values = [userId, ...Object.values(updateFields)];
        
        console.log('Executing UPDATE query');
        const { rows } = await pool.query(query, values);
        res.status(200).json({ success: true, message: 'Profile updated', data: rows[0] });
      }
    } catch (error) {
      console.error('Error in updateMyProfile:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * ✅ NEW: Upload profile image
   * @route POST /api/profile/upload-image
   */
  async uploadProfileImage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Check if file exists
      if (!req.file) {
        res.status(400).json({ 
          success: false, 
          message: 'No image file provided' 
        });
        return;
      }

      console.log('📸 Image upload request:', {
        userId,
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      });

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        // Delete invalid file
        await fs.unlink(req.file.path).catch(console.error);
        
        res.status(400).json({ 
          success: false, 
          message: 'Invalid file type. Only JPG, PNG, GIF, and WEBP images are allowed.' 
        });
        return;
      }

      // Validate file size (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        // Delete oversized file
        await fs.unlink(req.file.path).catch(console.error);
        
        res.status(400).json({ 
          success: false, 
          message: 'File too large. Maximum size is 5MB.' 
        });
        return;
      }

      // Generate image URL path
      const imageUrl = `/uploads/profiles/${req.file.filename}`;

      // Get old profile picture to delete later
      const oldPictureQuery = `SELECT profile_picture FROM users WHERE id = $1`;
      const { rows: oldRows } = await pool.query(oldPictureQuery, [userId]);
      const oldPicture = oldRows[0]?.profile_picture;

      // Update database
      const updateQuery = `
        UPDATE users
        SET profile_picture = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, profile_picture
      `;
      const { rows } = await pool.query(updateQuery, [imageUrl, userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      // Delete old profile picture if exists and is not default
      if (oldPicture && 
          oldPicture.startsWith('/uploads/') && 
          !oldPicture.includes('placeholder')) {
        const oldPath = path.join(__dirname, '../../', oldPicture);
        await fs.unlink(oldPath).catch(err => {
          console.log('Could not delete old image:', err.message);
        });
      }

      console.log('✅ Profile image updated successfully:', {
        userId,
        imageUrl,
        oldPicture
      });

      res.status(200).json({
        success: true,
        message: 'Profile image updated successfully',
        imageUrl: imageUrl,
        data: rows[0]
      });
    } catch (error) {
      console.error('❌ Error in uploadProfileImage:', error);
      
      // Clean up uploaded file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to upload image',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
        SELECT u.id, u.name, u.email, u.profile_picture as profile_image, p.*
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
   * @desc Update profile picture (legacy endpoint - redirects to upload)
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

      // If it's a URL string, update directly
      if (typeof profilePicture === 'string') {
        const query = `
          UPDATE users
          SET profile_picture = $1, updated_at = NOW()
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
      } else {
        res.status(400).json({
          success: false,
          message: 'Please use POST /api/profile/upload-image endpoint for file uploads'
        });
      }
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

      // Fetch User + Profile
      const userQuery = `
        SELECT u.id, u.name, u.email, u.profile_picture,
               p.id as profile_id, p.bio, p.skills, p.phone, p.location,
               p.portfolio_url as website_url, p.linkedin_url, p.github_url,
               p.years_of_experience, p.current_position, p.availability_status,
               p.preferred_job_types, p.preferred_locations,
               p.salary_expectation_min, p.salary_expectation_max
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

      // Parse skills from JSONB or JSON string
      let skillsCount = 0;
      try {
        if (user.skills) {
          let parsed;
          if (typeof user.skills === 'string') {
            parsed = JSON.parse(user.skills);
          } else {
            parsed = user.skills;
          }
          skillsCount = Array.isArray(parsed) ? parsed.length : 0;
        }
      } catch {
        skillsCount = 0;
      }

      // Parse social links count
      let socialLinksCount = 0;
      if (user.linkedin_url) socialLinksCount++;
      if (user.github_url) socialLinksCount++;
      if (user.website_url) socialLinksCount++;

      // Section Calculations
      const sections: CompletedSection[] = [];
      const missingFields: string[] = [];
      const recommendations: string[] = [];

      // 1. Basic Information (30%)
      const basicFields = [
        { field: 'Full Name', completed: !!user.name, required: true },
        { field: 'Email', completed: !!user.email, required: true },
        { field: 'Phone Number', completed: !!user.phone, required: true },
        { field: 'Profile Picture', completed: !!user.profile_picture, required: false },
        { field: 'Location', completed: !!user.location, required: true },
      ];
      const missingBasic = basicFields.filter(f => f.required && !f.completed);
      missingBasic.forEach(f => missingFields.push(f.field));
      
      sections.push({
        name: 'Basic Information',
        completed: missingBasic.length === 0,
        weight: 30,
        fields: basicFields,
      });

      // 2. Professional Summary (20%)
      const hasSummary = !!user.bio && user.bio.length >= 50;
      if (!hasSummary) {
        missingFields.push('Professional Summary');
        recommendations.push('Add a compelling professional summary (at least 50 characters).');
      }
      sections.push({
        name: 'Professional Summary',
        completed: hasSummary,
        weight: 20,
      });

      // 3. Skills (25%)
      const hasSkills = skillsCount >= 3;
      if (!hasSkills) {
        missingFields.push('Skills');
        recommendations.push(`Add ${hasSkills ? 'more' : 'at least 3'} relevant skills to your profile.`);
      }
      sections.push({ 
        name: 'Skills', 
        completed: hasSkills, 
        weight: 25 
      });

      // 4. Social Links (15%)
      const hasSocialLinks = socialLinksCount >= 1;
      if (!hasSocialLinks) {
        missingFields.push('Social Links');
        recommendations.push('Add at least one professional link (LinkedIn, GitHub, or Portfolio).');
      }
      sections.push({ 
        name: 'Social Links', 
        completed: hasSocialLinks, 
        weight: 15 
      });

      // 5. Career Preferences (10%)
      const hasCareerPrefs = !!(
        user.years_of_experience || 
        user.current_position || 
        user.availability_status
      );
      if (!hasCareerPrefs) {
        missingFields.push('Career Preferences');
        recommendations.push('Add your career preferences and work experience details.');
      }
      sections.push({ 
        name: 'Career Preferences', 
        completed: hasCareerPrefs, 
        weight: 10 
      });

      // Calculate total completion
      const totalCompletion = sections.reduce(
        (sum, s) => sum + (s.completed ? s.weight : 0),
        0
      );

      const result = {
        completion: Math.round(totalCompletion),
        missingFields,
        completedSections: sections,
        recommendations,
      };

      // Add personalized status message
      if (totalCompletion === 100) {
        result.recommendations.unshift('🎉 Perfect! Your profile is complete and ready to impress employers.');
      } else if (totalCompletion >= 80) {
        result.recommendations.unshift('💪 Almost there! Just a few more details to reach 100%.');
      } else if (totalCompletion >= 50) {
        result.recommendations.unshift('📈 Good progress! Add more details to stand out to employers.');
      } else {
        result.recommendations.unshift('⚠️ Your profile needs attention. Complete it to attract more opportunities.');
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