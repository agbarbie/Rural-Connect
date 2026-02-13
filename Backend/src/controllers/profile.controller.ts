// src/controllers/profile.controller.ts - COMPLETE FIX

import { Request, Response } from "express";
import pool from "../db/db.config";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

class ProfileController {
  /**
   * Get current user's profile
   */
  async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // ✅ Read from jobseeker_profiles table
      const query = `
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.profile_picture,
          jp.bio,
          jp.skills,
          jp.location,
          jp.phone,
          jp.linkedin_url,
          jp.github_url,
          jp.portfolio_url,
          jp.resume_url,
          jp.years_of_experience,
          jp.current_position,
          jp.availability_status,
          jp.preferred_job_types,
          jp.preferred_locations,
          jp.salary_expectation_min,
          jp.salary_expectation_max,
          jp.created_at,
          jp.updated_at
        FROM users u
        LEFT JOIN jobseeker_profiles jp ON u.id = jp.user_id
        WHERE u.id = $1
      `;
      
      const { rows } = await pool.query(query, [userId]);

      if (!rows.length) {
        res.status(404).json({ success: false, message: 'Profile not found' });
        return;
      }

      const profileData = rows[0];
      
      // Parse skills from JSONB
      let skills = [];
      try {
        skills = profileData.skills || [];
      } catch {
        skills = [];
      }
      
      res.status(200).json({ 
        success: true, 
        data: {
          ...profileData,
          skills: skills,
          profile_image: profileData.profile_picture,
          profileImage: profileData.profile_picture,
        }
      });
    } catch (error) {
      console.error('Error in getMyProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * ✅ FIXED: Update profile - now updates jobseeker_profiles table with correct columns
   */
  async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const updates = req.body;
      console.log("📝 Received profile updates:", JSON.stringify(updates, null, 2));

      // ✅ CRITICAL FIX: Use the ACTUAL jobseeker_profiles column names
      const fieldMapping: { [key: string]: string } = {
        bio: "bio",
        skills: "skills",
        phone: "phone",
        location: "location",
        linkedin_url: "linkedin_url",
        github_url: "github_url",
        portfolio_url: "portfolio_url",
        website_url: "portfolio_url", // Map website to portfolio_url
        resume_url: "resume_url",
        years_of_experience: "years_of_experience",
        current_position: "current_position",
        availability_status: "availability_status",
        preferred_job_types: "preferred_job_types",
        preferred_locations: "preferred_locations",
        salary_expectation_min: "salary_expectation_min",
        salary_expectation_max: "salary_expectation_max",
      };

      const updateFields: any = {};
      const jsonbFields = ["skills", "preferred_job_types", "preferred_locations"];

      for (const [frontendField, dbColumn] of Object.entries(fieldMapping)) {
        if (updates[frontendField] !== undefined) {
          if (jsonbFields.includes(dbColumn)) {
            // Handle JSONB array fields
            try {
              let arr: string[] = [];

              if (Array.isArray(updates[frontendField])) {
                arr = updates[frontendField];
              } else if (typeof updates[frontendField] === "string") {
                try {
                  const parsed = JSON.parse(updates[frontendField]);
                  arr = Array.isArray(parsed) ? parsed : [];
                } catch {
                  // If not JSON, split by newlines or commas
                  arr = updates[frontendField]
                    .split(/[,\n]+/)
                    .map((item: string) => item.trim())
                    .filter((item: string) => item.length > 0);
                }
              }

              arr = arr
                .map((item) => String(item).trim())
                .filter((item) => item.length > 0);

              // Store as JSONB (PostgreSQL will handle the conversion)
              updateFields[dbColumn] = JSON.stringify(arr);
            } catch (e) {
              console.error(`Error processing JSONB field ${dbColumn}:`, e);
              updateFields[dbColumn] = JSON.stringify([]);
            }
          } else {
            // Handle regular fields
            updateFields[dbColumn] = updates[frontendField];
          }
        }
      }

      console.log("✅ Mapped fields for database:", JSON.stringify(updateFields, null, 2));

      if (Object.keys(updateFields).length === 0) {
        res.status(400).json({ success: false, message: "No valid fields to update" });
        return;
      }

      // ✅ CRITICAL FIX: Update jobseeker_profiles table, not jobseekers
      const checkQuery = `SELECT id FROM jobseeker_profiles WHERE user_id = $1`;
      const { rows: existing } = await pool.query(checkQuery, [userId]);

      let query: string;
      let values: any[];

      if (existing.length === 0) {
        // INSERT new profile
        const columns = ["user_id", ...Object.keys(updateFields)].join(", ");
        const placeholders = Object.keys(updateFields)
          .map((_, i) => `$${i + 2}`)
          .join(", ");
        query = `
          INSERT INTO jobseeker_profiles (user_id, ${Object.keys(updateFields).join(", ")})
          VALUES ($1, ${placeholders})
          RETURNING *
        `;
        values = [userId, ...Object.values(updateFields)];

        console.log("✅ Executing INSERT into jobseeker_profiles");
        console.log("Query:", query);
        console.log("Values:", values);

        const { rows } = await pool.query(query, values);

        res.status(201).json({
          success: true,
          message: "Profile created successfully",
          data: rows[0],
        });
      } else {
        // UPDATE existing profile
        const setClause = Object.keys(updateFields)
          .map((field, i) => `${field} = $${i + 2}`)
          .join(", ");
        query = `
          UPDATE jobseeker_profiles
          SET ${setClause}, updated_at = NOW()
          WHERE user_id = $1
          RETURNING *
        `;
        values = [userId, ...Object.values(updateFields)];

        console.log("✅ Executing UPDATE on jobseeker_profiles");
        console.log("Query:", query);
        console.log("Values:", values);

        const { rows } = await pool.query(query, values);

        res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          data: rows[0],
        });
      }
    } catch (error) {
      console.error("❌ Error in updateMyProfile:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No image file provided",
        });
        return;
      }

      console.log("📸 Image upload request:", {
        userId,
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(req.file.mimetype)) {
        await fs.unlink(req.file.path).catch(console.error);
        res.status(400).json({
          success: false,
          message:
            "Invalid file type. Only JPG, PNG, GIF, and WEBP images are allowed.",
        });
        return;
      }

      // Validate file size (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        await fs.unlink(req.file.path).catch(console.error);
        res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
        });
        return;
      }

      // Generate image URL path
      const imageUrl = `/uploads/profiles/${req.file.filename}`;

      // Get old profile picture
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
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      // Delete old profile picture
      if (
        oldPicture &&
        oldPicture.startsWith("/uploads/") &&
        !oldPicture.includes("placeholder")
      ) {
        const oldPath = path.join(__dirname, "../../", oldPicture);
        await fs.unlink(oldPath).catch((err) => {
          console.log("Could not delete old image:", err.message);
        });
      }

      console.log("✅ Profile image updated successfully");

      res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        imageUrl: imageUrl,
        data: rows[0],
      });
    } catch (error) {
      console.error("❌ Error in uploadProfileImage:", error);

      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get profile completion status
   */
  async getProfileCompletion(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // ✅ Query jobseeker_profiles table
      const userQuery = `
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.profile_picture,
          jp.bio,
          jp.skills,
          jp.phone,
          jp.location,
          jp.linkedin_url,
          jp.github_url,
          jp.portfolio_url,
          jp.years_of_experience,
          jp.current_position,
          jp.availability_status,
          jp.preferred_job_types,
          jp.preferred_locations,
          jp.salary_expectation_min,
          jp.salary_expectation_max
        FROM users u
        LEFT JOIN jobseeker_profiles jp ON u.id = jp.user_id
        WHERE u.id = $1
      `;
      const { rows: userRows } = await pool.query(userQuery, [userId]);

      if (!userRows.length) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const user = userRows[0];

      // ✅ Parse skills (JSONB array)
      let skillsCount = 0;
      try {
        if (user.skills) {
          skillsCount = Array.isArray(user.skills) ? user.skills.length : 0;
        }
      } catch {
        skillsCount = 0;
      }

      // ✅ Count social links
      let socialLinksCount = 0;
      if (user.linkedin_url && user.linkedin_url.trim().length > 0) socialLinksCount++;
      if (user.github_url && user.github_url.trim().length > 0) socialLinksCount++;
      if (user.portfolio_url && user.portfolio_url.trim().length > 0) socialLinksCount++;

      const missingFields: string[] = [];
      const recommendations: string[] = [];
      const sections: any[] = [];

      // 1. Basic Information (30%)
      const basicFields = [
        { field: 'Full Name', completed: !!user.name, required: true },
        { field: 'Email', completed: !!user.email, required: true },
        { field: 'Phone Number', completed: !!(user.phone && user.phone.trim().length > 0), required: true },
        { field: 'Profile Picture', completed: !!user.profile_picture, required: false },
        { field: 'Location', completed: !!(user.location && user.location.trim().length > 0), required: true },
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
      const hasSummary = !!(user.bio && user.bio.trim().length >= 50);
      if (!hasSummary) {
        missingFields.push('Professional Summary (50+ characters)');
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
        missingFields.push('Skills (at least 3)');
        recommendations.push(`Add ${hasSkills ? 'more' : 'at least 3'} relevant skills.`);
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

      // Calculate completion
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

      if (totalCompletion === 100) {
        result.recommendations.unshift('🎉 Perfect! Your profile is 100% complete.');
      } else if (totalCompletion >= 80) {
        result.recommendations.unshift('💪 Almost there! Just a few more details.');
      } else if (totalCompletion >= 50) {
        result.recommendations.unshift('📈 Good progress! Add more details.');
      } else {
        result.recommendations.unshift('⚠️ Your profile needs attention.');
      }

      console.log('✅ Profile completion calculated:', {
        userId,
        completion: totalCompletion,
        skillsCount,
        socialLinksCount,
        hasPhone: !!user.phone,
        hasLocation: !!user.location,
        hasBio: !!(user.bio && user.bio.length >= 50)
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Error in getProfileCompletion:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  // Legacy/utility methods
  async getProfileByCVId(req: Request, res: Response): Promise<void> {
    res.status(501).json({ message: "Deprecated endpoint" });
  }

  async updateProfilePicture(req: Request, res: Response): Promise<void> {
    res
      .status(501)
      .json({ message: "Use POST /api/profile/upload-image instead" });
  }

  async shareProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const shareToken = crypto.randomBytes(16).toString("hex");
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
      console.error("Error in shareProfile:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

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
        res
          .status(404)
          .json({
            success: false,
            message: "Shared profile not found or expired",
          });
        return;
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("Error in getSharedProfile:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
}

export default new ProfileController();