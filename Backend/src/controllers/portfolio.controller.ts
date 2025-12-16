// src/controllers/portfolio.controller.ts - FINAL VERSION with SELECT * for CVs
import { Request, Response } from 'express';
import pool from '../db/db.config';

export class PortfolioController {
  /**
   * GET /api/portfolio/my-portfolio
   * Returns merged profile + CV data for authenticated user
   */
  async getMyPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      console.log('📂 Fetching portfolio for user:', userId);

      // 1. Get user's basic data
      const userQuery = `
        SELECT id, name, email, profile_picture
        FROM users 
        WHERE id = $1
      `;
      const userResult = await pool.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const userData = userResult.rows[0];
      console.log('✅ User data loaded');

      // 2. Get profile data from jobseeker_profiles table
      const profileQuery = `
        SELECT *
        FROM jobseeker_profiles 
        WHERE user_id = $1
      `;
      const profileResult = await pool.query(profileQuery, [userId]);
      
      const profileData = profileResult.rows.length > 0 
        ? profileResult.rows[0] 
        : {};

      console.log('✅ Profile data loaded');

      // 3. Get user's latest CV - USE SELECT * to get all columns
      const cvQuery = `
        SELECT *
        FROM cvs
        WHERE user_id = $1
        ORDER BY 
          CASE WHEN status = 'final' THEN 0 ELSE 1 END,
          updated_at DESC
        LIMIT 1
      `;
      const cvResult = await pool.query(cvQuery, [userId]);

      if (cvResult.rows.length === 0) {
        console.log('⚠️ No CV found for user');
        res.status(404).json({
          success: false,
          message: 'No CV found. Please create a CV in the CV Builder first.',
          profileData: {
            ...userData,
            ...profileData
          }
        });
        return;
      }

      const cv = cvResult.rows[0];
      console.log('✅ CV data loaded:', cv.id);
      console.log('📋 CV columns available:', Object.keys(cv));

      // 4. Get portfolio settings
      const settingsQuery = `
        SELECT * FROM portfolio_settings WHERE user_id = $1
      `;
      const settingsResult = await pool.query(settingsQuery, [userId]);
      
      const settings = settingsResult.rows.length > 0 
        ? {
            ...settingsResult.rows[0],
            is_public: settingsResult.rows[0].privacy_level === 'public'
          }
        : {
            user_id: userId,
            theme: 'default',
            is_public: false,
            privacy_level: 'private',
            analytics_enabled: true,
            social_links: []
          };

      // 5. Get testimonials
      const testimonialsQuery = `
        SELECT 
          id, 
          testimonial_text as text,
          testimonial_text as content,
          author_name as author, 
          author_position as position,
          author_company as company,
          created_at
        FROM portfolio_testimonials 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const testimonialsResult = await pool.query(testimonialsQuery, [userId]);

      // 6. Get view count
      const viewCountQuery = `
        SELECT COUNT(*) as count FROM portfolio_views WHERE user_id = $1
      `;
      const viewCountResult = await pool.query(viewCountQuery, [userId]);
      const viewCount = parseInt(viewCountResult.rows[0]?.count || '0');

      // 7. Merge all data
      const mergedProfileData = {
        // From users table
        id: userData.id,
        name: userData.name,
        email: userData.email,
        profile_image: userData.profile_picture,
        profile_picture: userData.profile_picture,
        
        // From jobseeker_profiles table (all columns)
        ...profileData
      };

      // 8. Extract CV data - handle different possible column names
      let cvData = null;
      
      // Try common CV data column names
      if (cv.data) {
        cvData = cv.data;
      } else if (cv.cv_data) {
        cvData = cv.cv_data;
      } else if (cv.extracted_data) {
        cvData = cv.extracted_data;
      } else if (cv.parsed_data) {
        cvData = cv.parsed_data;
      } else {
        // If no data column found, return the whole CV object
        console.log('⚠️ No standard CV data column found, using entire CV object');
        cvData = cv;
      }

      console.log('📊 CV data type:', typeof cvData);

      // 9. Return enhanced portfolio data
      const enhancedPortfolioData = {
        success: true,
        message: 'Portfolio retrieved successfully',
        data: {
          cvId: cv.id,
          userId: userId,
          cvData: cvData, // Whatever CV data we found
          profileData: mergedProfileData,
          settings: settings,
          testimonials: testimonialsResult.rows,
          viewCount: viewCount,
          createdAt: cv.created_at,
          updatedAt: cv.updated_at
        }
      };

      console.log('✅ Enhanced portfolio data prepared');
      res.json(enhancedPortfolioData);

    } catch (error) {
      console.error('❌ Error fetching portfolio:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load portfolio',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/portfolio/public/:identifier
   */
  async getPublicPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const { identifier } = req.params;
      console.log('📂 Fetching public portfolio for:', identifier);

      const userQuery = `
        SELECT id FROM users WHERE email = $1 OR id::text = $1
      `;
      const userResult = await pool.query(userQuery, [identifier]);

      if (userResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Portfolio not found'
        });
        return;
      }

      const userId = userResult.rows[0].id;

      const settingsQuery = `
        SELECT privacy_level FROM portfolio_settings WHERE user_id = $1
      `;
      const settingsResult = await pool.query(settingsQuery, [userId]);

      if (settingsResult.rows.length === 0 || settingsResult.rows[0].privacy_level !== 'public') {
        res.status(403).json({
          success: false,
          message: 'This portfolio is private'
        });
        return;
      }

      const viewQuery = `
        INSERT INTO portfolio_views (user_id, viewed_at, viewer_ip)
        VALUES ($1, NOW(), $2)
      `;
      await pool.query(viewQuery, [userId, req.ip]);

      const userDataQuery = `
        SELECT 
          u.id, u.name, u.email, u.profile_picture,
          p.*
        FROM users u
        LEFT JOIN jobseeker_profiles p ON u.id = p.user_id
        WHERE u.id = $1
      `;
      const userDataResult = await pool.query(userDataQuery, [userId]);
      const profileData = userDataResult.rows[0];

      const cvQuery = `
        SELECT *
        FROM cvs
        WHERE user_id = $1
        ORDER BY 
          CASE WHEN status = 'final' THEN 0 ELSE 1 END,
          updated_at DESC
        LIMIT 1
      `;
      const cvResult = await pool.query(cvQuery, [userId]);

      if (cvResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No portfolio found for this user'
        });
        return;
      }

      const cv = cvResult.rows[0];

      // Extract CV data using same logic
      let cvData = cv.data || cv.cv_data || cv.extracted_data || cv.parsed_data || cv;

      const testimonialsQuery = `
        SELECT 
          id, 
          testimonial_text as text,
          author_name as author, 
          author_position as position,
          author_company as company,
          created_at
        FROM portfolio_testimonials 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const testimonialsResult = await pool.query(testimonialsQuery, [userId]);

      const viewCountQuery = `
        SELECT COUNT(*) as count FROM portfolio_views WHERE user_id = $1
      `;
      const viewCountResult = await pool.query(viewCountQuery, [userId]);
      const viewCount = parseInt(viewCountResult.rows[0]?.count || '0');

      res.json({
        success: true,
        message: 'Public portfolio retrieved successfully',
        data: {
          cvId: cv.id,
          userId: userId,
          cvData: cvData,
          profileData: {
            ...profileData,
            profile_image: profileData.profile_picture
          },
          testimonials: testimonialsResult.rows,
          viewCount: viewCount,
          createdAt: cv.created_at,
          updatedAt: cv.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error fetching public portfolio:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load portfolio',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/portfolio/settings
   */
  async getPortfolioSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      const query = `SELECT * FROM portfolio_settings WHERE user_id = $1`;
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        res.json({
          success: true,
          data: {
            user_id: userId,
            theme: 'default',
            is_public: false,
            privacy_level: 'private',
            analytics_enabled: true,
            social_links: []
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          is_public: result.rows[0].privacy_level === 'public'
        }
      });
    } catch (error) {
      console.error('❌ Error fetching portfolio settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load settings'
      });
    }
  }

  /**
   * PUT /api/portfolio/settings
   */
  async updatePortfolioSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const settings = req.body;
      const privacyLevel = settings.is_public ? 'public' : 'private';

      const checkQuery = `SELECT id FROM portfolio_settings WHERE user_id = $1`;
      const checkResult = await pool.query(checkQuery, [userId]);

      let query: string;
      let values: any[];

      if (checkResult.rows.length === 0) {
        query = `
          INSERT INTO portfolio_settings 
          (user_id, theme, privacy_level, analytics_enabled, social_links)
          VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        values = [
          userId,
          settings.theme || 'default',
          privacyLevel,
          settings.analytics_enabled !== false,
          JSON.stringify(settings.social_links || [])
        ];
      } else {
        query = `
          UPDATE portfolio_settings 
          SET theme = COALESCE($2, theme),
              privacy_level = COALESCE($3, privacy_level),
              analytics_enabled = COALESCE($4, analytics_enabled),
              social_links = COALESCE($5, social_links),
              updated_at = NOW()
          WHERE user_id = $1 RETURNING *
        `;
        values = [
          userId,
          settings.theme,
          privacyLevel,
          settings.analytics_enabled,
          settings.social_links ? JSON.stringify(settings.social_links) : null
        ];
      }

      const result = await pool.query(query, values);
      res.json({
        success: true,
        data: {
          ...result.rows[0],
          is_public: result.rows[0].privacy_level === 'public'
        },
        message: 'Settings updated successfully'
      });
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings'
      });
    }
  }

  /**
   * GET /api/portfolio/analytics
   */
  async getPortfolioAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { startDate, endDate } = req.query;

      let query = `
        SELECT DATE(viewed_at) as date, COUNT(*) as views,
               COUNT(DISTINCT viewer_ip) as unique_visitors
        FROM portfolio_views WHERE user_id = $1
      `;
      const values: any[] = [userId];

      if (startDate && endDate) {
        query += ` AND viewed_at BETWEEN $2 AND $3`;
        values.push(startDate, endDate);
      }

      query += ` GROUP BY DATE(viewed_at) ORDER BY date DESC LIMIT 30`;
      const result = await pool.query(query, values);

      const totalQuery = `
        SELECT COUNT(*) as total_views,
               COUNT(DISTINCT viewer_ip) as total_unique_visitors
        FROM portfolio_views WHERE user_id = $1
      `;
      const totalResult = await pool.query(totalQuery, [userId]);

      res.json({
        success: true,
        data: {
          dailyStats: result.rows,
          totalStats: totalResult.rows[0]
        }
      });
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load analytics'
      });
    }
  }

  async exportPortfolioPDF(req: Request, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      message: 'PDF export feature coming soon'
    });
  }

  async addTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { text, author, position, company } = req.body;

      if (!text || !author) {
        res.status(400).json({
          success: false,
          message: 'Text and author are required'
        });
        return;
      }

      const query = `
        INSERT INTO portfolio_testimonials 
        (user_id, testimonial_text, author_name, author_position, author_company)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, testimonial_text as text, author_name as author,
                  author_position as position, author_company as company, created_at
      `;
      const result = await pool.query(query, [
        userId, text, author, position || '', company || ''
      ]);

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Testimonial added successfully'
      });
    } catch (error) {
      console.error('❌ Error adding testimonial:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add testimonial'
      });
    }
  }

  async deleteTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { testimonialId } = req.params;

      const query = `
        DELETE FROM portfolio_testimonials 
        WHERE id = $1 AND user_id = $2 RETURNING id
      `;
      const result = await pool.query(query, [testimonialId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Testimonial not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Testimonial deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting testimonial:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete testimonial'
      });
    }
  }
}

export default new PortfolioController();