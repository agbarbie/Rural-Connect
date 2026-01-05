// src/controllers/rating.controller.ts
// ✅ UPDATED VERSION - Matches your database migration
// Replace your entire rating.controller.ts file with this

import { Response } from 'express';
import pool from '../db/db.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class RatingController {
  /**
   * Create a new rating with complete employer and company information
   */
  async createRating(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const employer_id = req.user?.id;
      const {
        jobseeker_id,
        job_id,
        application_id,
        rating,
        feedback,
        would_hire_again,
        skills_rating,
        task_description,
        is_public = true
      } = req.body;

      console.log('📝 Creating rating:', {
        employer_id,
        jobseeker_id,
        job_id: job_id || 'none',
        rating
      });

      if (!employer_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // Validate required fields
      if (!jobseeker_id || !rating || !feedback) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: jobseeker_id, rating, feedback'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }

      // Check for duplicate rating
      if (job_id) {
        const existingRating = await pool.query(
          'SELECT id FROM ratings WHERE employer_id = $1 AND jobseeker_id = $2 AND job_id = $3',
          [employer_id, jobseeker_id, job_id]
        );
        if (existingRating.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'You have already rated this candidate for this job'
          });
        }
      } else {
        const existingRating = await pool.query(
          'SELECT id FROM ratings WHERE employer_id = $1 AND jobseeker_id = $2 AND job_id IS NULL',
          [employer_id, jobseeker_id]
        );
        if (existingRating.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'You have already rated this candidate'
          });
        }
      }

      // ✅ Get complete employer and company info using YOUR database column names
      const employerInfoQuery = `
        SELECT 
          u.id,
          u.name as employer_name,
          u.email as employer_email,
          u.user_type,
          u.profile_picture as employer_image,
          e.role_in_company,
          c.name as company_name,
          c.logo_url as company_logo,
          c.description as company_description,
          c.industry as company_industry,
          c.company_size as company_size,
          c.website_url as company_website,
          c.headquarters as company_location
        FROM users u
        LEFT JOIN employers e ON u.id = e.user_id
        LEFT JOIN companies c ON e.company_id = c.id
        WHERE u.id = $1
      `;
      
      const employerResult = await pool.query(employerInfoQuery, [employer_id]);
      const emp = employerResult.rows[0] || {
        employer_name: 'Employer',
        employer_email: '',
        user_type: 'Employer',
        employer_image: null,
        role_in_company: null,
        company_name: 'Company',
        company_logo: null,
        company_description: null,
        company_industry: null,
        company_size: null,
        company_website: null,
        company_location: null
      };

      console.log('✅ Complete employer info retrieved:', {
        name: emp.employer_name,
        company: emp.company_name,
        role: emp.role_in_company,
        industry: emp.company_industry,
        location: emp.company_location
      });

      // Get job title if job_id provided
      let job_title = null;
      if (job_id) {
        const jobResult = await pool.query('SELECT title FROM jobs WHERE id = $1', [job_id]);
        job_title = jobResult.rows[0]?.title || null;
      }

      // ✅ Insert rating with ALL employer and company information
      const insertQuery = `
        INSERT INTO ratings (
          employer_id, jobseeker_id, job_id, application_id, job_title,
          employer_name, employer_email, employer_image, user_type,
          company_name, company_logo, role_in_company,
          company_description, company_industry, company_size, 
          company_website, company_location,
          rating, feedback, would_hire_again, skills_rating, 
          task_description, is_public, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, NOW()
        ) RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        employer_id, jobseeker_id, job_id || null, application_id || null, job_title,
        emp.employer_name, emp.employer_email, emp.employer_image, emp.user_type,
        emp.company_name, emp.company_logo, emp.role_in_company,
        emp.company_description, emp.company_industry, emp.company_size,
        emp.company_website, emp.company_location,
        rating, feedback, would_hire_again || false, 
        JSON.stringify(skills_rating || {}), task_description || null, is_public
      ]);

      console.log('✅ Rating created successfully:', result.rows[0].id);

      // Create notification for jobseeker
      try {
        const notificationMessage = job_title 
          ? `${emp.employer_name} from ${emp.company_name} gave you a ${rating}-star rating for ${job_title}`
          : `${emp.employer_name} from ${emp.company_name} gave you a ${rating}-star rating`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
           VALUES ($1, 'rating_received', 'New Rating Received', $2, $3, NOW())`,
          [jobseeker_id, notificationMessage, JSON.stringify({ 
            rating_id: result.rows[0].id, 
            job_id: job_id || null, 
            job_title: job_title || null, 
            rating,
            employer_name: emp.employer_name,
            company_name: emp.company_name
          })]
        );
        console.log('✅ Notification sent to jobseeker');
      } catch (err) {
        console.error('Failed to create notification (non-critical):', err);
      }

      return res.status(201).json({
        success: true,
        message: 'Rating submitted successfully',
        data: {
          ...result.rows[0],
          skills_rating: typeof result.rows[0].skills_rating === 'string'
            ? JSON.parse(result.rows[0].skills_rating)
            : result.rows[0].skills_rating
        }
      });

    } catch (error) {
      console.error('❌ Error creating rating:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create rating',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get jobseeker ratings with complete employer and company details
   */
  async getJobseekerRatings(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { jobseekerId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const public_only = req.query.public_only === 'true';
      const offset = (page - 1) * limit;

      console.log('📊 Fetching ratings for jobseeker:', jobseekerId);

      // ✅ Query with all employer and company information
      let query = `
        SELECT 
          r.*,
          COALESCE(r.employer_name, u.name) as employer_name,
          COALESCE(r.employer_email, u.email) as employer_email,
          COALESCE(r.employer_image, u.profile_picture) as employer_image
        FROM ratings r
        LEFT JOIN users u ON r.employer_id = u.id
        WHERE r.jobseeker_id = $1
      `;

      const queryParams: any[] = [jobseekerId];

      if (public_only) {
        query += ' AND r.is_public = true';
      }

      query += ' ORDER BY r.created_at DESC LIMIT $2 OFFSET $3';
      queryParams.push(limit, offset);

      const countQuery = `
        SELECT COUNT(*) as total FROM ratings 
        WHERE jobseeker_id = $1 ${public_only ? 'AND is_public = true' : ''}
      `;

      const [ratingsResult, countResult] = await Promise.all([
        pool.query(query, queryParams),
        pool.query(countQuery, [jobseekerId])
      ]);

      // ✅ Process ratings with all company details
      const ratings = ratingsResult.rows.map(row => ({
        ...row,
        skills_rating: typeof row.skills_rating === 'string' 
          ? JSON.parse(row.skills_rating || '{}') 
          : row.skills_rating || {},
        employer_name: row.employer_name || 'Employer',
        employer_email: row.employer_email || '',
        company_name: row.company_name || 'Company',
        company_logo: row.company_logo || null,
        company_description: row.company_description || null,
        company_industry: row.company_industry || null,
        company_size: row.company_size || null,
        company_website: row.company_website || null,
        company_location: row.company_location || null,
        role_in_company: row.role_in_company || null
      }));

      const total = parseInt(countResult.rows[0].total);

      console.log(`✅ Retrieved ${ratings.length} ratings with complete employer details`);

      return res.json({
        success: true,
        data: {
          ratings,
          pagination: { 
            page, 
            limit, 
            total, 
            total_pages: Math.ceil(total / limit) 
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching ratings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ratings'
      });
    }
  }

  /**
   * Get jobseeker rating statistics
   */
  async getJobseekerRatingStats(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { jobseekerId } = req.params;

      const statsQuery = `
        SELECT 
          COUNT(*) as total_ratings,
          AVG(rating) as average_rating,
          COUNT(*) FILTER (WHERE rating = 5) as five_star,
          COUNT(*) FILTER (WHERE rating = 4) as four_star,
          COUNT(*) FILTER (WHERE rating = 3) as three_star,
          COUNT(*) FILTER (WHERE rating = 2) as two_star,
          COUNT(*) FILTER (WHERE rating = 1) as one_star,
          COUNT(*) FILTER (WHERE would_hire_again = true) as would_hire_again_count
        FROM ratings WHERE jobseeker_id = $1 AND is_public = true
      `;

      const skillsStatsQuery = `
        SELECT 
          AVG((skills_rating->>'technical')::numeric) as avg_technical,
          AVG((skills_rating->>'communication')::numeric) as avg_communication,
          AVG((skills_rating->>'professionalism')::numeric) as avg_professionalism,
          AVG((skills_rating->>'quality')::numeric) as avg_quality,
          AVG((skills_rating->>'timeliness')::numeric) as avg_timeliness
        FROM ratings
        WHERE jobseeker_id = $1 AND is_public = true
          AND skills_rating IS NOT NULL AND skills_rating != '{}'::jsonb
      `;

      const [statsResult, skillsResult] = await Promise.all([
        pool.query(statsQuery, [jobseekerId]),
        pool.query(skillsStatsQuery, [jobseekerId])
      ]);

      const stats = statsResult.rows[0];
      const skillsStats = skillsResult.rows[0];

      return res.json({
        success: true,
        data: {
          total_ratings: parseInt(stats.total_ratings) || 0,
          average_rating: parseFloat(stats.average_rating) || 0,
          rating_distribution: {
            5: parseInt(stats.five_star) || 0,
            4: parseInt(stats.four_star) || 0,
            3: parseInt(stats.three_star) || 0,
            2: parseInt(stats.two_star) || 0,
            1: parseInt(stats.one_star) || 0
          },
          would_hire_again_percentage: stats.total_ratings > 0
            ? Math.round((parseInt(stats.would_hire_again_count) / parseInt(stats.total_ratings)) * 100)
            : 0,
          skills_average: {
            technical: parseFloat(skillsStats.avg_technical) || 0,
            communication: parseFloat(skillsStats.avg_communication) || 0,
            professionalism: parseFloat(skillsStats.avg_professionalism) || 0,
            quality: parseFloat(skillsStats.avg_quality) || 0,
            timeliness: parseFloat(skillsStats.avg_timeliness) || 0
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching rating stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rating statistics'
      });
    }
  }
}

export default new RatingController();