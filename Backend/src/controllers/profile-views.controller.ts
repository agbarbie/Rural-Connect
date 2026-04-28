// src/controllers/profile-views.controller.ts - FINAL SIMPLE VERSION

import { Request, Response } from 'express';
import pool from '../db/db.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ProfileViewsController {
  getEmployerProfile: any;
  /**
   * Track profile view
   * POST /api/profile/view
   */
  async trackProfileView(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const viewer_id = req.user?.id;
      const { viewed_profile_id } = req.body;

      if (!viewer_id || !viewed_profile_id) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Don't track self-views
      if (viewer_id === viewed_profile_id) {
        return res.json({ success: true, message: 'Self-view not tracked' });
      }

      const query = `
        INSERT INTO profile_views (viewer_id, viewed_profile_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (viewer_id, viewed_profile_id) 
        DO UPDATE SET viewed_at = NOW()
        RETURNING *
      `;

      await pool.query(query, [viewer_id, viewed_profile_id]);
      
      return res.json({
        success: true,
        message: 'Profile view tracked'
      });
    } catch (error) {
      console.error('Error tracking profile view:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track profile view'
      });
    }
  }

  /**
   * Get profile viewers - SIMPLE (no images, just names)
   * GET /api/profile/viewers
   */
  async getProfileViewers(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const limit = parseInt(req.query.limit as string as string) || 50;
      const offset = parseInt(req.query.offset as string as string) || 0;

      // ✅ SIMPLE: Only get basic employer info from users table
      const query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.company_name,
          u.role_in_company,
          u.location,
          pv.viewed_at
        FROM profile_views pv
        JOIN users u ON pv.viewer_id = u.id
        WHERE pv.viewed_profile_id = $1
        ORDER BY pv.viewed_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM profile_views
        WHERE viewed_profile_id = $1
      `;

      const [viewersResult, countResult] = await Promise.all([
        pool.query(query, [user_id, limit, offset]),
        pool.query(countQuery, [user_id])
      ]);

      const viewers = viewersResult.rows.map(viewer => ({
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        company_name: viewer.company_name || 'Company',
        role_in_company: viewer.role_in_company || 'Recruiter',
        location: viewer.location,
        viewed_at: viewer.viewed_at
      }));

      return res.json({
        success: true,
        data: {
          viewers: viewers,
          total: parseInt(countResult.rows[0].total),
          limit,
          offset
        }
      });
    } catch (error) {
      console.error('Error fetching profile viewers:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch profile viewers'
      });
    }
  }

  /**
   * Get profile view count
   * GET /api/profile/view-count
   */
  async getProfileViewCount(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const user_id = req.user?.id;
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const query = `
        SELECT 
          COUNT(*) as total_views,
          COUNT(DISTINCT viewer_id) as unique_viewers,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_last_30_days
        FROM profile_views
        WHERE viewed_profile_id = $1
      `;

      const result = await pool.query(query, [user_id]);

      return res.json({
        success: true,
        data: {
          total_views: parseInt(result.rows[0].total_views),
          unique_viewers: parseInt(result.rows[0].unique_viewers),
          views_last_30_days: parseInt(result.rows[0].views_last_30_days)
        }
      });
    } catch (error) {
      console.error('Error fetching view count:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch view count'
      });
    }
  }
}

export default new ProfileViewsController();