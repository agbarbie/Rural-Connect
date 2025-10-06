// src/controllers/profile.controller.ts
import { Request, Response } from 'express';
import pool from '../db/db.config';
import crypto from 'crypto';

class ProfileController {
  /**
   * @desc Get current user's profile
   * @route GET /api/profile
   */
  async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id; // ✅ fixed
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
   * @desc Get profile by CV id
   * @route GET /api/profile/cv/:cvId
   */
  async getProfileByCVId(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id; // ✅ fixed
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
      const userId = (req as any).user?.id; // ✅ fixed
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

      res.status(200).json({ success: true, message: 'Profile picture updated', data: rows[0] });
    } catch (error) {
      console.error('Error in updateProfilePicture:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /**
   * @desc Get profile completion percentage
   * @route GET /api/profile/completion
   */
  async getProfileCompletion(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id; // ✅ fixed
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const query = `
        SELECT 
          CASE 
            WHEN p.id IS NULL THEN 0
            ELSE (
              (CASE WHEN u.name IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN u.email IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN u.profile_picture IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN p.bio IS NOT NULL THEN 1 ELSE 0 END) +
              (CASE WHEN p.skills IS NOT NULL THEN 1 ELSE 0 END)
            ) * 20
          END AS completion
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const { rows } = await pool.query(query, [userId]);

      res.status(200).json({ success: true, data: { completion: rows[0]?.completion || 0 } });
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
      const userId = (req as any).user?.id; // ✅ fixed
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const shareToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
          expiresAt: rows[0].expires_at
        }
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

      // Increment view count
      await pool.query(`SELECT increment_profile_view_count($1)`, [token]);

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('Error in getSharedProfile:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
}

export default new ProfileController();
