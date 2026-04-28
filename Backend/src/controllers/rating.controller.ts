// src/controllers/rating.controller.ts
// ✅ COMPLETE FIXED VERSION - Stores ALL company information when creating ratings

import { Response } from 'express';
import pool from '../db/db.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class RatingController {
  /**
   * ✅ FIXED: Create rating with COMPLETE employer and company information
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
        would_hire_again = false,
        skills_rating = {},
        task_description,
        is_public = true
      } = req.body;

      console.log('Creating rating for:', { employer_id, jobseeker_id, rating });

      if (!employer_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      if (!jobseeker_id || rating == null || !feedback?.trim()) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
      }

      // Duplicate check
      if (job_id) {
        const dupCheck = await pool.query(
          'SELECT 1 FROM ratings WHERE employer_id = $1 AND jobseeker_id = $2 AND job_id = $3 LIMIT 1',
          [employer_id, jobseeker_id, job_id]
        );
        if (dupCheck.rowCount && dupCheck.rowCount > 0) {
          return res.status(409).json({ 
            success: false, 
            message: 'You already rated this candidate for this job' 
          });
        }
      }

      // ✅ FIX: Get COMPLETE employer and company information
      const employerQuery = await pool.query(
        `SELECT 
           u.name AS employer_name,
           u.email AS employer_email,
           u.profile_picture AS employer_image,
           u.user_type,
           -- ✅ Get company info - prefer employers.company_name, fallback to companies.name
           COALESCE(e.company_name, c.name) AS company_name,
           e.role_in_company,
           c.industry AS company_industry,
           c.headquarters AS company_location,
           c.description AS company_description,
           c.company_size,
           c.website_url AS company_website,
           c.logo_url AS company_logo,
           c.is_verified AS verified_employer
         FROM users u
         LEFT JOIN employers e ON u.id = e.user_id
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE u.id = $1`,
        [employer_id]
      );

      if (!employerQuery.rowCount || employerQuery.rowCount === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Employer profile not found' 
        });
      }

      const employerData = employerQuery.rows[0];
      
      console.log('✅ Fetched employer data:', {
        employer_name: employerData.employer_name,
        company_name: employerData.company_name,
        role_in_company: employerData.role_in_company
      });

      // Get job title if job_id provided
      let job_title: string | null = null;
      if (job_id) {
        const jobQuery = await pool.query('SELECT title FROM jobs WHERE id = $1', [job_id]);
        if (jobQuery.rowCount && jobQuery.rowCount > 0) {
          job_title = jobQuery.rows[0].title;
        }
      }

      // ✅ FIX: Insert rating with COMPLETE company information
      const result = await pool.query(
        `INSERT INTO ratings (
          employer_id, 
          jobseeker_id, 
          job_id, 
          application_id,
          rating, 
          feedback, 
          would_hire_again, 
          skills_rating,
          task_description, 
          is_public,
          -- Employer info
          employer_name, 
          employer_email, 
          employer_image,
          user_type,
          -- ✅ Complete company info
          company_name,
          role_in_company,
          company_industry,
          company_location,
          company_description,
          company_size,
          company_website,
          company_logo,
          verified_employer,
          -- Job info
          job_title,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, NOW(), NOW()
        )
        RETURNING id, rating, feedback, created_at`,
        [
          employer_id,
          jobseeker_id,
          job_id || null,
          application_id || null,
          rating,
          feedback.trim(),
          would_hire_again,
          JSON.stringify(skills_rating),
          task_description?.trim() || null,
          is_public,
          // Employer info
          employerData.employer_name || 'Employer',
          employerData.employer_email || '',
          employerData.employer_image || null,
          employerData.user_type || 'employer',
          // ✅ Complete company info
          employerData.company_name || 'Company',
          employerData.role_in_company || null,
          employerData.company_industry || null,
          employerData.company_location || null,
          employerData.company_description || null,
          employerData.company_size || null,
          employerData.company_website || null,
          employerData.company_logo || null,
          employerData.verified_employer || false,
          // Job info
          job_title
        ]
      );

      console.log('✅ Rating created successfully with company:', employerData.company_name);

      return res.status(201).json({
        success: true,
        message: 'Rating submitted successfully!',
        data: result.rows[0]
      });

    } catch (error: any) {
      console.error('❌ Rating creation failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit rating'
      });
    }
  }

  /**
   * Update an existing rating
   */
  async updateRating(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const employer_id = req.user?.id;
      const { ratingId } = req.params;
      const {
        rating,
        feedback,
        would_hire_again,
        skills_rating,
        task_description,
        is_public,
      } = req.body;

      if (!employer_id || !ratingId) {
        return res.status(400).json({ success: false, message: 'Missing required data' });
      }

      if (!rating || !feedback) {
        return res.status(400).json({ success: false, message: 'Rating and feedback required' });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
      }

      // Check ownership
      const check = await pool.query(
        'SELECT employer_id FROM ratings WHERE id = $1',
        [ratingId]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Rating not found' });
      }
      if (check.rows[0].employer_id !== employer_id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const result = await pool.query(
        `UPDATE ratings
         SET rating = $1, 
             feedback = $2, 
             would_hire_again = $3,
             skills_rating = $4, 
             task_description = $5, 
             is_public = $6,
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          rating,
          feedback.trim(),
          would_hire_again ?? false,
          skills_rating ? JSON.stringify(skills_rating) : null,
          task_description?.trim() || null,
          is_public ?? true,
          ratingId,
        ]
      );

      const updated = result.rows[0];

      return res.json({
        success: true,
        message: 'Rating updated successfully',
        data: {
          ...updated,
          skills_rating: updated.skills_rating ? JSON.parse(updated.skills_rating) : {},
        },
      });
    } catch (error) {
      console.error('❌ Update rating error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update rating' });
    }
  }

  /**
   * ✅ Get jobseeker ratings with proper company info fallback
   */
  async getJobseekerRatings(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { jobseekerId } = req.params;
      const page = parseInt(req.query.page as string as string) || 1;
      const limit = parseInt(req.query.limit as string as string) || 10;
      const public_only = req.query.public_only as string === 'true';
      const offset = (page - 1) * limit;

      console.log('📊 Fetching ratings for jobseeker:', jobseekerId);

      // ✅ Query with COALESCE to prioritize stored data, fallback to related tables
      let query = `
        SELECT 
          r.id,
          r.employer_id,
          r.jobseeker_id,
          r.job_id,
          r.application_id,
          r.job_title,
          r.rating,
          r.feedback,
          r.would_hire_again,
          r.skills_rating,
          r.task_description,
          r.is_public,
          r.created_at,
          r.updated_at,
          -- ✅ Employer info: use stored data first, fallback to users table
          COALESCE(r.employer_name, u.name) as employer_name,
          COALESCE(r.employer_email, u.email) as employer_email,
          COALESCE(r.employer_image, u.profile_picture) as employer_image,
          COALESCE(r.user_type, u.user_type) as user_type,
          -- ✅ Company info: use stored data first, fallback to companies table
          COALESCE(r.company_name, e.company_name, c.name) as company_name,
          COALESCE(r.role_in_company, e.role_in_company) as role_in_company,
          COALESCE(r.company_industry, c.industry) as company_industry,
          COALESCE(r.company_location, c.headquarters) as company_location,
          COALESCE(r.company_description, c.description) as company_description,
          COALESCE(r.company_size, c.company_size) as company_size,
          COALESCE(r.company_website, c.website_url) as company_website,
          COALESCE(r.company_logo, c.logo_url) as company_logo,
          COALESCE(r.verified_employer, c.is_verified) as verified_employer
        FROM ratings r
        LEFT JOIN users u ON r.employer_id = u.id
        LEFT JOIN employers e ON u.id = e.user_id
        LEFT JOIN companies c ON e.company_id = c.id
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

      // Process ratings
      const ratings = ratingsResult.rows.map(row => ({
        ...row,
        skills_rating: typeof row.skills_rating === 'string' 
          ? JSON.parse(row.skills_rating || '{}') 
          : row.skills_rating || {}
      }));

      const total = parseInt(countResult.rows[0].total);

      console.log(`✅ Retrieved ${ratings.length} ratings`);
      if (ratings.length > 0) {
        console.log('Sample rating data:', {
          employer_name: ratings[0].employer_name,
          company_name: ratings[0].company_name,
          role_in_company: ratings[0].role_in_company
        });
      }

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