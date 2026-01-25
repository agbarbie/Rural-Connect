// src/controllers/profile-views.controller.ts - FIXED VERSION

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

      console.log('📊 Tracking profile view:', { viewer_id, viewed_profile_id });

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

      const result = await pool.query(query, [viewer_id, viewed_profile_id]);
      console.log('✅ Profile view tracked successfully');
      
      return res.json({
        success: true,
        message: 'Profile view tracked',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('❌ Error tracking profile view:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to track profile view',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get profile viewers - FIXED with proper JOIN
   * GET /api/profile/viewers
   */
  async getProfileViewers(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const user_id = req.user?.id;
      
      console.log('👀 Getting profile viewers for user:', user_id);
      
      if (!user_id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // ✅ FIXED: JOIN with employer_profiles table to get company info
      const query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.user_type,
          u.location,
          u.profile_picture,
          ep.company_name,
          ep.role_in_company,
          ep.company_description,
          ep.company_industry,
          ep.company_size,
          ep.company_website,
          ep.company_logo,
          pv.viewed_at
        FROM profile_views pv
        JOIN users u ON pv.viewer_id = u.id
        LEFT JOIN employer_profiles ep ON u.id = ep.user_id
        WHERE pv.viewed_profile_id = $1
          AND u.user_type = 'Employer'
        ORDER BY pv.viewed_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM profile_views pv
        JOIN users u ON pv.viewer_id = u.id
        WHERE pv.viewed_profile_id = $1
          AND u.user_type = 'Employer'
      `;

      console.log('📊 Executing viewers query for user:', user_id);
      
      const [viewersResult, countResult] = await Promise.all([
        pool.query(query, [user_id, limit, offset]),
        pool.query(countQuery, [user_id])
      ]);

      console.log('✅ Query executed. Found viewers:', viewersResult.rows.length);

      const viewers = viewersResult.rows.map(viewer => ({
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        user_type: viewer.user_type || 'Employer',
        profile_image: viewer.profile_picture,
        company_name: viewer.company_name || 'Company',
        role_in_company: viewer.role_in_company || 'Recruiter',
        company_description: viewer.company_description,
        company_industry: viewer.company_industry,
        company_size: viewer.company_size,
        company_website: viewer.company_website,
        company_logo: viewer.company_logo,
        location: viewer.location,
        viewed_at: viewer.viewed_at
      }));

      console.log('✅ Processed viewers:', viewers.length);
      if (viewers.length > 0) {
        console.log('👀 First viewer:', JSON.stringify(viewers[0], null, 2));
      }

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
      console.error('❌ Error fetching profile viewers:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch profile viewers',
        error: error instanceof Error ? error.message : 'Unknown error'
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
        FROM profile_views pv
        JOIN users u ON pv.viewer_id = u.id
        WHERE pv.viewed_profile_id = $1
          AND u.user_type = 'Employer'
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