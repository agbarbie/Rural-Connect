// rating.controller.ts - FIXED: Make job_id optional

import { Response } from 'express';
import pool from '../db/db.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class RatingController {
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
        task_description
      } = req.body;

      if (!employer_id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // ✅ FIXED: Only jobseeker_id, rating, and feedback are required
      // job_id is now optional
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

      // ✅ FIXED: Check for duplicate - only if job_id is provided
      if (job_id) {
        const existingRatingQuery = `
          SELECT id FROM ratings 
          WHERE employer_id = $1 AND jobseeker_id = $2 AND job_id = $3
        `;
        const existingRating = await pool.query(existingRatingQuery, [
          employer_id,
          jobseeker_id,
          job_id
        ]);

        if (existingRating.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'You have already rated this candidate for this job'
          });
        }
      } else {
        // Check if employer already rated this jobseeker (without specific job)
        const existingRatingQuery = `
          SELECT id FROM ratings 
          WHERE employer_id = $1 AND jobseeker_id = $2 AND job_id IS NULL
        `;
        const existingRating = await pool.query(existingRatingQuery, [
          employer_id,
          jobseeker_id
        ]);

        if (existingRating.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'You have already rated this candidate'
          });
        }
      }

      // ✅ FIXED: Get job title only if job_id is provided
      let job_title = null;
      if (job_id) {
        const jobQuery = `SELECT title FROM jobs WHERE id = $1`;
        const jobResult = await pool.query(jobQuery, [job_id]);
        job_title = jobResult.rows[0]?.title || null;
      }

      // Get employer name
      const employerQuery = `SELECT name FROM users WHERE id = $1`;
      const employerResult = await pool.query(employerQuery, [employer_id]);
      const employer_name = employerResult.rows[0]?.name || 'Employer';

      // ✅ FIXED: Insert rating with optional job_id
      const insertQuery = `
        INSERT INTO ratings (
          employer_id, jobseeker_id, job_id, job_title, employer_name,
          rating, feedback, would_hire_again, skills_rating, task_description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        employer_id,
        jobseeker_id,
        job_id || null, // ✅ Allow NULL
        job_title,
        employer_name,
        rating,
        feedback,
        would_hire_again || false,
        JSON.stringify(skills_rating || {}),
        task_description || null
      ]);

      // Create notification
      try {
        const notificationMessage = job_title 
          ? `You received a ${rating}-star rating from ${employer_name} for ${job_title}`
          : `You received a ${rating}-star rating from ${employer_name}`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, metadata)
           VALUES ($1, 'rating_received', 'New Rating Received', $2, $3)`,
          [
            jobseeker_id,
            notificationMessage,
            JSON.stringify({ 
              rating_id: result.rows[0].id, 
              job_id: job_id || null, 
              job_title: job_title || null, 
              rating 
            })
          ]
        );
      } catch (notifError) {
        console.error('Failed to create notification (non-critical):', notifError);
      }

      console.log('✅ Rating created successfully:', {
        rating_id: result.rows[0].id,
        employer_id,
        jobseeker_id,
        job_id: job_id || 'none',
        rating
      });

      return res.status(201).json({
        success: true,
        message: 'Rating submitted successfully',
        data: result.rows[0]
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

  async getJobseekerRatings(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const { jobseekerId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const query = `
        SELECT r.*, u.name as employer_name, j.title as job_title
        FROM ratings r
        LEFT JOIN users u ON r.employer_id = u.id
        LEFT JOIN jobs j ON r.job_id = j.id
        WHERE r.jobseeker_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `SELECT COUNT(*) as total FROM ratings WHERE jobseeker_id = $1`;

      const [ratingsResult, countResult] = await Promise.all([
        pool.query(query, [jobseekerId, limit, offset]),
        pool.query(countQuery, [jobseekerId])
      ]);

      const ratings = ratingsResult.rows.map(row => ({
        ...row,
        skills_rating: typeof row.skills_rating === 'string' 
          ? JSON.parse(row.skills_rating) 
          : row.skills_rating
      }));

      const total = parseInt(countResult.rows[0].total);

      return res.json({
        success: true,
        data: {
          ratings,
          pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
        }
      });

    } catch (error) {
      console.error('Error fetching jobseeker ratings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch ratings'
      });
    }
  }

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
        FROM ratings WHERE jobseeker_id = $1
      `;

      const skillsStatsQuery = `
        SELECT 
          AVG((skills_rating->>'technical')::numeric) as avg_technical,
          AVG((skills_rating->>'communication')::numeric) as avg_communication,
          AVG((skills_rating->>'professionalism')::numeric) as avg_professionalism,
          AVG((skills_rating->>'quality')::numeric) as avg_quality,
          AVG((skills_rating->>'timeliness')::numeric) as avg_timeliness
        FROM ratings
        WHERE jobseeker_id = $1 AND skills_rating IS NOT NULL AND skills_rating != '{}'::jsonb
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
      console.error('Error fetching rating stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rating statistics'
      });
    }
  }
}

export default new RatingController();