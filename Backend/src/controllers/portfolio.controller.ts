// src/controllers/portfolio.controller.ts - FINAL WORKING VERSION
import { Request, Response } from 'express';
import pool from '../db/db.config';

export class PortfolioController {
  /**
   * ✅ FINAL WORKING VERSION
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

      // Step 1: Get user's basic data from users table
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

      // Step 2: Get profile data - use SELECT * to get all columns
      const profileQuery = `
        SELECT *
        FROM jobseeker_profiles 
        WHERE user_id = $1
      `;
      const profileResult = await pool.query(profileQuery, [userId]);

      let profileData: any = {};
      
      if (profileResult.rows.length > 0) {
        profileData = profileResult.rows[0];
        console.log('✅ Profile data loaded, columns:', Object.keys(profileData));
      } else {
        console.log('ℹ️ No profile data found, creating defaults');
        profileData = {
          user_id: userId,
          phone: null,
          location: null,
          bio: null,
          linkedin_url: null,
          github_url: null,
          portfolio_url: null,
          years_of_experience: 0,
          current_position: null,
          availability_status: 'open_to_opportunities',
          preferred_job_types: null,
          preferred_locations: null,
          salary_expectation_min: null,
          salary_expectation_max: null,
          skills: null
        };
      }

      // Parse JSONB fields safely
      const parseJsonField = (field: any): any[] => {
        if (!field) return [];
        try {
          if (typeof field === 'string') return JSON.parse(field);
          if (Array.isArray(field)) return field;
          return [];
        } catch {
          return [];
        }
      };

      const skills = parseJsonField(profileData.skills);
      const preferredJobTypes = parseJsonField(profileData.preferred_job_types);
      const preferredLocations = parseJsonField(profileData.preferred_locations);

      // Step 3: Try to get CV data (OPTIONAL)
      let cvData: any = null;
      let cvId: string | null = null;

      try {
        const cvQuery = `
          SELECT id::text, status, cv_data, created_at, updated_at
          FROM cvs
          WHERE user_id = $1
          ORDER BY 
            CASE WHEN status = 'final' THEN 0 ELSE 1 END,
            updated_at DESC
          LIMIT 1
        `;
        
        const cvResult = await pool.query(cvQuery, [userId]);

        if (cvResult.rows.length > 0) {
          const cv = cvResult.rows[0];
          cvId = cv.id;
          
          cvData = typeof cv.cv_data === 'string' 
            ? JSON.parse(cv.cv_data) 
            : cv.cv_data;
            
          console.log('✅ CV data found:', cvId);
        } else {
          console.log('ℹ️ No CV found - using profile data only');
        }
      } catch (cvError) {
        console.warn('⚠️ CV query failed:', cvError);
      }

      // Step 4: Get portfolio settings
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

      // Step 5: Get testimonials
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
        WHERE user_id = $1 AND is_approved = true
        ORDER BY created_at DESC
      `;
      const testimonialsResult = await pool.query(testimonialsQuery, [userId]);

      // Step 6: Get view count
      const viewCountQuery = `
        SELECT COUNT(*) as count FROM portfolio_views WHERE user_id = $1
      `;
      const viewCountResult = await pool.query(viewCountQuery, [userId]);
      const viewCount = parseInt(viewCountResult.rows[0]?.count || '0');

      // ✅ FIXED: Use helper function instead of this.categorizeSkill
      const categorizeSkill = (skillName: string): string => {
        const tech = skillName.toLowerCase();
        
        const technicalKeywords = [
          'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go',
          'react', 'angular', 'vue', 'node', 'sql', 'mongodb', 'aws', 'docker',
          'kubernetes', 'typescript', 'html', 'css', 'git', 'linux'
        ];

        const softKeywords = [
          'communication', 'leadership', 'teamwork', 'management', 'problem solving',
          'analytical', 'critical thinking', 'creativity', 'adaptability'
        ];

        if (technicalKeywords.some(kw => tech.includes(kw))) {
          return 'Technical';
        }
        if (softKeywords.some(kw => tech.includes(kw))) {
          return 'Soft Skills';
        }
        
        return 'General';
      };

      // Step 7: Build portfolio response
      const portfolioResponse = {
        success: true,
        message: 'Portfolio retrieved successfully',
        data: {
          userId: userId,
          cvId: cvId,

          // Personal info (combine users + profile data)
          personalInfo: {
            fullName: userData.name,
            email: userData.email,
            phone: profileData.phone || '',
            location: profileData.location || '',
            profileImage: userData.profile_picture || null,
            bio: profileData.bio || '',
            linkedIn: profileData.linkedin_url || '',
            github: profileData.github_url || '',
            website: profileData.portfolio_url || '',
            yearsOfExperience: profileData.years_of_experience || 0,
            currentPosition: profileData.current_position || '',
            availabilityStatus: profileData.availability_status || 'open_to_opportunities'
          },

          // Skills from profile
          skills: skills.map((skillName: string) => ({
            skill_name: skillName,
            name: skillName,
            category: categorizeSkill(skillName), // ✅ FIXED: Use local function
            skill_level: 'Intermediate'
          })),

          // Career preferences
          careerPreferences: {
            preferredJobTypes: preferredJobTypes,
            preferredLocations: preferredLocations,
            salaryMin: profileData.salary_expectation_min,
            salaryMax: profileData.salary_expectation_max
          },

          // CV sections (optional)
          workExperience: cvData?.work_experience || [],
          education: cvData?.education || [],
          projects: cvData?.projects || [],
          certifications: cvData?.certifications || [],

          // CV data for compatibility
          cvData: cvData || {
            personal_info: {
              full_name: userData.name,
              email: userData.email,
              phone: profileData.phone,
              professional_summary: profileData.bio
            },
            skills: skills.map((s: string) => ({
              skill_name: s,
              category: categorizeSkill(s) // ✅ FIXED: Use local function
            })),
            work_experience: [],
            education: [],
            projects: [],
            certifications: []
          },

          // Complete profile data
          profileData: {
            name: userData.name,
            email: userData.email,
            ...profileData,
            profile_image: userData.profile_picture,
            profile_picture: userData.profile_picture
          },

          // Portfolio metadata
          settings: settings,
          testimonials: testimonialsResult.rows,
          viewCount: viewCount,
          createdAt: profileData.created_at || new Date(),
          updatedAt: profileData.updated_at || new Date()
        }
      };

      console.log('✅ Portfolio assembled successfully');
      res.json(portfolioResponse);

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

      try {
        const viewQuery = `
          INSERT INTO portfolio_views (user_id, viewed_at, viewer_ip)
          VALUES ($1, NOW(), $2)
        `;
        await pool.query(viewQuery, [userId, req.ip]);
      } catch (viewError) {
        console.warn('Failed to track view:', viewError);
      }

      (req as any).user = { id: userId };
      await this.getMyPortfolio(req, res);

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