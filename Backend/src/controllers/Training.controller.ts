import { Request, Response, NextFunction } from 'express';
import { TrainingService } from '../services/training.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import pool from '../db/db.config';
import { TrainingSearchParams } from '../types/training.type';
import { ParsedQs } from 'qs';
import path, { join } from 'path';
import { ParamsDictionary } from 'express-serve-static-core';

/**
 * Controller for handling training operations
 */
export class TrainingController {
  getEmployerNotificationCount(req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, next: NextFunction): void {
    throw new Error('Method not implemented.');
  }
  private trainingService: TrainingService;

  constructor(trainingService: TrainingService) {
    this.trainingService = trainingService;
    console.log('TrainingController instantiated with service:', !!this.trainingService);
  }

  // Add this route handler
async issueCertificateManually(req: Request, res: Response): Promise<void> {
  try {
    const { enrollment_id } = req.params;
    const employerId = (req as any).user?.userId;
    
    if (!employerId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }
    
    const result = await this.trainingService.manuallyIssueCertificate(enrollment_id, employerId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Error issuing certificate:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to issue certificate'
    });
  }
}

  // ================ PUBLIC METHODS ================

  /**
   * Get all trainings (public endpoint with optional auth)
   */
  async getAllTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userType = req.user?.user_type;

      // Build query based on user type
      let whereClause = '';
      let queryParams: any[] = [];

      if (userType === 'employer' && userId) {
        // For employers, get their trainings (check both user_id and employer profile id)
        const employerCheck = await pool.query(
          'SELECT id FROM employers WHERE user_id = $1',
          [userId]
        );

        if (employerCheck.rows.length > 0) {
          const employerProfileId = employerCheck.rows[0].id;
          whereClause = 'WHERE (t.provider_id = $1 OR t.provider_id = $2)';
          queryParams = [userId, employerProfileId];
        } else {
          whereClause = 'WHERE t.provider_id = $1';
          queryParams = [userId];
        }
      } else {
        // For public/jobseeker, show only published trainings
        whereClause = "WHERE t.status = 'published'";
      }

      const query = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.category,
          t.level,
          t.duration_hours,
          t.mode,
          t.cost_type,
          t.price,
          t.start_date,
          t.end_date,
          t.max_participants,
          t.current_participants,
          t.thumbnail_url,
          t.provider_name,
          t.provider_id,
          t.has_certificate,
          t.status,
          t.rating,
          t.total_students,
          t.location,
          t.created_at,
          t.updated_at,
          COUNT(v.id) AS video_count,
          COALESCE(json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview
            ) ORDER BY v.order_index
          ) FILTER (WHERE v.id IS NOT NULL), '[]') AS videos,
          COALESCE(json_agg(
            json_build_object(
              'id', o.id,
              'outcome_text', o.outcome_text,
              'order_index', o.order_index
            ) ORDER BY o.order_index
          ) FILTER (WHERE o.id IS NOT NULL), '[]') AS outcomes
        FROM trainings t
        LEFT JOIN training_videos v ON v.training_id = t.id
        LEFT JOIN training_outcomes o ON o.training_id = t.id
        ${whereClause}
        GROUP BY 
          t.id, t.title, t.description, t.category, t.level, t.duration_hours, 
          t.mode, t.cost_type, t.price, t.start_date, t.end_date, 
          t.max_participants, t.current_participants, t.thumbnail_url, 
          t.provider_name, t.provider_id, t.has_certificate, t.status,
          t.rating, t.total_students, t.location, t.created_at, t.updated_at
        ORDER BY t.created_at DESC;
      `;

      const result = await pool.query(query, queryParams);

      // Format response to match frontend expectations
      res.status(200).json({
        success: true,
        message: "Trainings retrieved successfully",
        data: {
          trainings: result.rows
        },
        pagination: {
          current_page: 1,
          total_pages: 1,
          page_size: result.rows.length,
          total_count: result.rows.length,
          has_next: false,
          has_previous: false
        }
      });

    } catch (error) {
      console.error('Error in getAllTrainings:', error);
      next(error);
    }
  }

  /**
   * Get training categories (public endpoint)
   */
  async getTrainingCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.trainingService.getTrainingCategories();

      res.status(200).json({
        success: true,
        message: 'Training categories retrieved successfully',
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get popular trainings (public endpoint)
   */
  async getPopularTrainings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 10 } = req.query;
      const query = `
        SELECT 
          t.*,
          COUNT(e.id) as enrollment_count
        FROM trainings t
        LEFT JOIN training_enrollments e ON t.id = e.training_id
        WHERE t.status = 'published'
        GROUP BY t.id
        ORDER BY enrollment_count DESC, t.rating DESC
        LIMIT $1
      `;
      const result = await pool.query(query, [parseInt(limit as string)]);

      res.status(200).json({
        success: true,
        message: 'Popular trainings retrieved successfully',
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // ================ EMPLOYER METHODS ================

  /**
   * Create a new training (employer only)
   */
  async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const trainingData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can create trainings'
        });
        return;
      }

      // Validate required fields
      if (!trainingData.title || !trainingData.description || !trainingData.category || !trainingData.level) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: title, description, category, and level are required'
        });
        return;
      }

      const newTraining = await this.trainingService.createTraining(trainingData, userId);

      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: newTraining
      });
    } catch (error: any) {
      console.error('Error in createTraining controller:', error);
      
      if (error.message === 'Employer profile not found for this user') {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found. Please complete your employer registration.'
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Update a training (employer only)
   */
  async updateTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can update trainings'
        });
        return;
      }

      const updatedTraining = await this.trainingService.updateTraining(id, updateData, userId);

      if (!updatedTraining) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training updated successfully',
        data: updatedTraining
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a training (employer only)
   */
  async deleteTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can delete trainings'
        });
        return;
      }

      const deleted = await this.trainingService.deleteTraining(id, userId) as any;

      if (deleted === false) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training statistics (employer only)
   */
  async getTrainingStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can view training statistics'
        });
        return;
      }

      // Get employer profile ID
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
        return;
      }

      const employerId = employerResult.rows[0].id;
      const stats = await this.trainingService.getTrainingStats(employerId);

      res.status(200).json({
        success: true,
        message: 'Training statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publish a training (employer only)
   */
  async publishTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can publish trainings'
        });
        return;
      }

      const updatedTraining = await this.trainingService.updateTraining(id, { status: 'published' }, userId);

      if (!updatedTraining) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training published successfully',
        data: updatedTraining
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unpublish a training (employer only)
   */
  async unpublishTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can unpublish trainings'
        });
        return;
      }

      const updatedTraining = await this.trainingService.updateTraining(id, { status: 'draft' }, userId);

      if (!updatedTraining) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training unpublished successfully',
        data: updatedTraining
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspend a training (employer only)
   */
  async suspendTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can suspend trainings'
        });
        return;
      }

      const updatedTraining = await this.trainingService.updateTraining(id, { status: 'suspended' }, userId);

      if (!updatedTraining) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training suspended successfully',
        data: updatedTraining
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training enrollments (employer only)
   */
  async getTrainingEnrollments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can view training enrollments'
        });
        return;
      }

      // Get employer profile ID
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
        return;
      }

      const employerId = employerResult.rows[0].id;

      const { page = 1, limit = 10, status } = req.query;

      const result = await this.trainingService.getTrainingEnrollments(id, employerId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string
      });

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training enrollments retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training analytics (employer only)
   */
  async getTrainingAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { range = '30days' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can view training analytics'
        });
        return;
      }

      // Get employer profile ID
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
        return;
      }

      const employerId = employerResult.rows[0].id;

      const analytics = await this.trainingService.getTrainingAnalytics(id, employerId, range as string);

      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'Training not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training reviews
   */
  async getTrainingReviews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, sort_by = 'created_at', sort_order = 'desc' } = req.query;

      const result = await this.trainingService.getTrainingReviews(id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sort_by: sort_by as string,
        sort_order: sort_order as string
      });

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Training not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training reviews retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training by ID (uses service for full details including videos)
   */
  // =============================================
// COMPLETE FIX: getTrainingById method
// Location: Backend/src/controllers/training.controller.ts
// Replace the entire method (around line 715-810)
// =============================================

/**
 * Get training by ID (uses service for full details including videos)
 */
/**
 * COMPLETE FIX: Get training by ID
 * ALL 26 columns from trainings table included in GROUP BY
 */
async getTrainingById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const userType = req.user?.user_type;

    console.log('=== Getting Training By ID ===');
    console.log('Training ID:', id);
    console.log('User ID:', userId);
    console.log('User Type:', userType);

    let training;
    
    if (!userId) {
      // ========================================
      // PUBLIC/UNAUTHENTICATED - Only published trainings
      // ========================================
      const query = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.category,
          t.level,
          t.duration_hours,
          t.cost_type,
          t.price,
          t.mode,
          t.provider_id,
          t.provider_name,
          t.has_certificate,
          t.rating,
          t.total_students,
          t.thumbnail_url,
          t.location,
          t.start_date,
          t.end_date,
          t.max_participants,
          t.current_participants,
          t.status,
          t.created_at,
          t.updated_at,
          t.duration,
          t.video_count,
          t.enrolled_count,
          COUNT(v.id) as video_count_actual,
          COALESCE(json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview
            ) ORDER BY v.order_index
          ) FILTER (WHERE v.id IS NOT NULL AND v.is_preview = true), '[]') AS videos,
          COALESCE(json_agg(
            json_build_object(
              'id', o.id,
              'outcome_text', o.outcome_text,
              'order_index', o.order_index
            ) ORDER BY o.order_index
          ) FILTER (WHERE o.id IS NOT NULL), '[]') AS outcomes
        FROM trainings t
        LEFT JOIN training_videos v ON v.training_id = t.id
        LEFT JOIN training_outcomes o ON o.training_id = t.id
        WHERE t.id = $1 AND t.status = 'published'
        GROUP BY 
          t.id, t.title, t.description, t.category, t.level, 
          t.duration_hours, t.cost_type, t.price, t.mode, 
          t.provider_id, t.provider_name, t.has_certificate, 
          t.rating, t.total_students, t.thumbnail_url, t.location, 
          t.start_date, t.end_date, t.max_participants, 
          t.current_participants, t.status, t.created_at, t.updated_at,
          t.duration, t.video_count, t.enrolled_count
      `;
      
      const result = await pool.query(query, [id]);
      training = result.rows[0] || null;
      
      if (training) {
        training.enrolled = false;
        training.can_enroll = true;
      }
      
    } else if (userType === 'jobseeker') {
      // ========================================
      // JOBSEEKER - Show if published OR enrolled
      // ========================================
      
      const enrollmentCheck = await pool.query(
        'SELECT id FROM training_enrollments WHERE training_id = $1 AND user_id = $2',
        [id, userId]
      );
      
      const isEnrolled = enrollmentCheck.rows.length > 0;
      
      console.log('🔍 Enrollment check:', { isEnrolled, userId, trainingId: id });
      
      const query = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.category,
          t.level,
          t.duration_hours,
          t.cost_type,
          t.price,
          t.mode,
          t.provider_id,
          t.provider_name,
          t.has_certificate,
          t.rating,
          t.total_students,
          t.thumbnail_url,
          t.location,
          t.start_date,
          t.end_date,
          t.max_participants,
          t.current_participants,
          t.status,
          t.created_at,
          t.updated_at,
          t.duration,
          t.video_count,
          t.enrolled_count,
          COUNT(v.id) as video_count_actual,
          COALESCE(json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview
            ) ORDER BY v.order_index
          ) FILTER (WHERE v.id IS NOT NULL ${isEnrolled ? '' : 'AND v.is_preview = true'}), '[]') AS videos,
          COALESCE(json_agg(
            json_build_object(
              'id', o.id,
              'outcome_text', o.outcome_text,
              'order_index', o.order_index
            ) ORDER BY o.order_index
          ) FILTER (WHERE o.id IS NOT NULL), '[]') AS outcomes,
          COALESCE(
            (SELECT json_build_object(
              'id', e.id,
              'status', e.status,
              'progress_percentage', e.progress_percentage,
              'enrolled_at', e.enrolled_at,
              'completed_at', e.completed_at,
              'certificate_issued', e.certificate_issued
            )
            FROM training_enrollments e
            WHERE e.training_id = t.id AND e.user_id = $2),
            NULL
          ) as enrollment
        FROM trainings t
        LEFT JOIN training_videos v ON v.training_id = t.id
        LEFT JOIN training_outcomes o ON o.training_id = t.id
        WHERE t.id = $1 
          ${isEnrolled ? '' : "AND t.status = 'published'"}
        GROUP BY 
          t.id, t.title, t.description, t.category, t.level, 
          t.duration_hours, t.cost_type, t.price, t.mode, 
          t.provider_id, t.provider_name, t.has_certificate, 
          t.rating, t.total_students, t.thumbnail_url, t.location, 
          t.start_date, t.end_date, t.max_participants, 
          t.current_participants, t.status, t.created_at, t.updated_at,
          t.duration, t.video_count, t.enrolled_count
      `;
      
      const result = await pool.query(query, [id, userId]);
      training = result.rows[0] || null;
      
      if (training) {
        training.enrolled = isEnrolled;
        training.can_enroll = !isEnrolled && training.status === 'published';
        training.enrollment_id = training.enrollment?.id || null;
        
        console.log('✅ Jobseeker training loaded:', {
          title: training.title,
          status: training.status,
          enrolled: training.enrolled,
          videos: training.videos?.length
        });
      }
      
    } else if (userType === 'employer') {
      // ========================================
      // EMPLOYER - Show own trainings regardless of status
      // ========================================
      const employerProfileCheck = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );
      
      let whereClause = 't.id = $1';
      let queryParams: any[] = [id];
      
      if (employerProfileCheck.rows.length > 0) {
        const employerProfileId = employerProfileCheck.rows[0].id;
        whereClause = 't.id = $1 AND (t.provider_id = $2 OR t.provider_id = $3)';
        queryParams = [id, userId, employerProfileId];
      } else {
        whereClause = 't.id = $1 AND t.provider_id = $2';
        queryParams = [id, userId];
      }
      
      const query = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.category,
          t.level,
          t.duration_hours,
          t.cost_type,
          t.price,
          t.mode,
          t.provider_id,
          t.provider_name,
          t.has_certificate,
          t.rating,
          t.total_students,
          t.thumbnail_url,
          t.location,
          t.start_date,
          t.end_date,
          t.max_participants,
          t.current_participants,
          t.status,
          t.created_at,
          t.updated_at,
          t.duration,
          t.video_count,
          t.enrolled_count,
          COUNT(v.id) as video_count_actual,
          COALESCE(json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview
            ) ORDER BY v.order_index
          ) FILTER (WHERE v.id IS NOT NULL), '[]') AS videos,
          COALESCE(json_agg(
            json_build_object(
              'id', o.id,
              'outcome_text', o.outcome_text,
              'order_index', o.order_index
            ) ORDER BY o.order_index
          ) FILTER (WHERE o.id IS NOT NULL), '[]') AS outcomes
        FROM trainings t
        LEFT JOIN training_videos v ON v.training_id = t.id
        LEFT JOIN training_outcomes o ON o.training_id = t.id
        WHERE ${whereClause}
        GROUP BY 
          t.id, t.title, t.description, t.category, t.level, 
          t.duration_hours, t.cost_type, t.price, t.mode, 
          t.provider_id, t.provider_name, t.has_certificate, 
          t.rating, t.total_students, t.thumbnail_url, t.location, 
          t.start_date, t.end_date, t.max_participants, 
          t.current_participants, t.status, t.created_at, t.updated_at,
          t.duration, t.video_count, t.enrolled_count
      `;
      
      const result = await pool.query(query, queryParams);
      training = result.rows[0] || null;
    }

    // ========================================
    // RESPONSE
    // ========================================
    if (!training) {
      console.log('❌ Training not found or not accessible');
      res.status(404).json({
        success: false,
        message: userType === 'employer' 
          ? "Training not found or you don't have permission to view it"
          : "Training not found or not published"
      });
      return;
    }

    console.log('✅ Training found:', {
      id: training.id,
      title: training.title,
      status: training.status,
      enrolled: training.enrolled || false,
      videos: training.videos?.length || 0
    });

    res.status(200).json({
      success: true,
      message: "Training retrieved successfully",
      data: training
    });

  } catch (error) {
    console.error('❌ Error in getTrainingById:', error);
    next(error);
  }
}

  /**
   * Get training videos count
   */
  async getTrainingVideoCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const result = await pool.query(
        'SELECT COUNT(*) as count FROM training_videos WHERE training_id = $1',
        [trainingId]
      );
      res.status(200).json({
        success: true,
        data: { video_count: parseInt(result.rows[0].count) }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training videos
   */
  async getTrainingVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const result = await pool.query(
        'SELECT * FROM training_videos WHERE training_id = $1 ORDER BY order_index',
        [trainingId]
      );
      res.status(200).json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }

  // ================ JOBSEEKER METHODS ================

  async getJobseekerTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can access this endpoint'
        });
        return;
      }

      const params: TrainingSearchParams = {
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 10, 50),
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        filters: {
          category: req.query.category as string,
          level: (req.query.level as string[]) || undefined,
          search: req.query.search as string,
          status: (req.query.status as string[]) || undefined,
          cost_type: (req.query.cost_type as string[]) || undefined,
          mode: (req.query.mode as string[]) || undefined,
          has_certificate: req.query.has_certificate ? req.query.has_certificate === 'true' : undefined
        },
        search: '',
        cost_type: '',
        level: '',
        category: ''
      };

      // Use the method that actually gets trainings, not stats
      const result = await this.trainingService.getPublishedTrainingsForJobseeker(userId, params);

      res.status(200).json({
        success: true,
        message: 'Available trainings retrieved successfully',
        data: result,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error in getJobseekerTrainings:', error);
      next(error);
    }
  }

  async getEnrolledTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('Getting enrolled trainings for user:', req.user?.id);
      
      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 12,
        sort_by: ['created_at', 'title', 'rating', 'total_students', 'start_date'].includes(req.query.sort_by as string)
          ? (req.query.sort_by as 'created_at' | 'title' | 'rating' | 'total_students' | 'start_date')
          : 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        search: '',
        mode: '',
        cost_type: '',
        level: '',
        category: ''
      };

      const result = await this.trainingService.getEnrolledTrainings(req.user!.id, params);

      res.status(200).json({
        success: true,
        data: {
          trainings: result.trainings
        },
        pagination: result.pagination,
        message: 'Enrolled trainings retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error in getEnrolledTrainings:', error);
      next(error);
    }
  }

  /**
   * Get jobseeker training statistics
   */
  async getJobseekerTrainingStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can view training statistics'
        });
        return;
      }

      const validSortFields = ['created_at', 'title', 'rating', 'total_students', 'start_date'] as const;
      type SortByType = typeof validSortFields[number];
      const sortBy = req.query.sort_by as SortByType;

      const params = {
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 10, 50),
        sort_by: validSortFields.includes(sortBy) ? sortBy : 'created_at',
        sort_order: (req.query.sort_order === 'ASC' || req.query.sort_order === 'DESC') 
          ? req.query.sort_order.toLowerCase() as 'asc' | 'desc' : 'desc',
        filters: {
          category: req.query.category as string,
          level: req.query.level ? [req.query.level as string] : undefined,
          search: req.query.search as string,
          status: req.query.status ? [req.query.status as string] : undefined,
          cost_type: req.query.cost_type ? [req.query.cost_type as string] : undefined,
          mode: req.query.mode ? [req.query.mode as string] : undefined,
          has_certificate: req.query.has_certificate ? req.query.has_certificate === 'true' : undefined
        }
      };
      const stats = await this.trainingService.getJobseekerTrainingStats(params, userId);

      res.status(200).json({
        success: true,
        message: 'Training statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recommended trainings for jobseeker
   */
  async getRecommendedTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can get training recommendations'
        });
        return;
      }

      const limit = Math.min(Number(req.query.limit) || 10, 20);
      const recommendations = await this.trainingService.getRecommendedTrainings(userId, limit);

      res.status(200).json({
        success: true,
        message: 'Training recommendations retrieved successfully',
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enroll in training (jobseeker only)
   */
  async enrollInTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can enroll in trainings'
        });
        return;
      }

      const enrollment = await this.trainingService.enrollUserInTraining(trainingId, userId);

      if (!enrollment) {
        res.status(400).json({
          success: false,
          message: 'Unable to enroll. Training may be full, not published, or you may already be enrolled.'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Successfully enrolled in training',
        data: enrollment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unenroll from training (jobseeker only)
   */
  async unenrollFromTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can unenroll from trainings'
        });
        return;
      }

      const success = await this.trainingService.unenrollUserFromTraining(trainingId, userId);

      if (!success) {
        res.status(400).json({
          success: false,
          message: 'Unable to unenroll. You may not be enrolled or the training may be completed.'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Successfully unenrolled from training'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get training progress (jobseeker only)
   */
  async getTrainingProgress(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can view training progress'
        });
        return;
      }

      const progress = await this.trainingService.getUserTrainingProgress(trainingId, userId);

      if (!progress) {
        res.status(404).json({
          success: false,
          message: 'Training enrollment not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training progress retrieved successfully',
        data: progress
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update training progress (jobseeker only)
   */
  async updateTrainingProgress(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;
      const progressData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can update training progress'
        });
        return;
      }

      const updatedProgress = await this.trainingService.updateTrainingProgress(trainingId, userId, progressData);

      if (!updatedProgress) {
        res.status(404).json({
          success: false,
          message: 'Training enrollment not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Training progress updated successfully',
        data: updatedProgress
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit training review (jobseeker only)
   */
  async submitTrainingReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;
      const reviewData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'jobseeker') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only jobseekers can submit training reviews'
        });
        return;
      }

      // Validate review data
      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
        res.status(400).json({
          success: false,
          message: 'Rating is required and must be between 1 and 5'
        });
        return;
      }

      const review = await this.trainingService.submitTrainingReview(trainingId, userId, reviewData);

      if (!review) {
        res.status(400).json({
          success: false,
          message: 'Unable to submit review. You must be enrolled in this training.'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Training review submitted successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // VIDEO MANAGEMENT (EMPLOYER)
  // ============================================

  async addVideoToTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId } = req.params;
      const userId = req.user?.id;
      const videoData = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      const video = await this.trainingService.addVideoToTraining(trainingId, videoData, userId);

      res.status(201).json({
        success: true,
        message: 'Video added successfully',
        data: video
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVideoInTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId, videoId } = req.params;
      const userId = req.user?.id;
      const videoData = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      const video = await this.trainingService.updateTrainingVideo(trainingId, videoId, videoData, userId);

      res.status(200).json({
        success: true,
        message: 'Video updated successfully',
        data: video
      });
    } catch (error) {
      next(error);
    }
  }

  /**
 * Delete a video from a training (employer only)
 * FIXED: Read employer_id from query param OR fallback to req.user.id
 */
async deleteVideoFromTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { trainingId, videoId } = req.params;
    // FIXED: Use query param if provided (for frontend compatibility), fallback to user ID
    const employerId = (req.query.employer_id as string) || req.user?.id;
    
    if (!employerId) {
      res.status(401).json({ success: false, message: 'Employer ID required' });
      return;
    }

    if (req.user?.user_type !== 'employer') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    console.log('🗑️ Controller: Deleting video:', { trainingId, videoId, employerId });

    const deleted = await this.trainingService.deleteTrainingVideo(trainingId, videoId, employerId);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Video not found or unauthorized' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ Controller error in deleteVideoFromTraining:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}

  // ============================================
  // VIDEO PROGRESS (JOBSEEKER)
  // ============================================

// In Training.controller.ts - Replace the updateVideoProgress method

async updateVideoProgress(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { trainingId, videoId } = req.params;
    const userId = req.user?.id;
    const { watch_time_seconds, is_completed } = req.body;

    console.log('🎥 updateVideoProgress called:', {
      trainingId,
      videoId,
      userId,
      watch_time_seconds,
      is_completed,
      bodyKeys: Object.keys(req.body)
    });

    if (!userId) {
      res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: User ID not found' 
      });
      return;
    }

    if (req.user?.user_type !== 'jobseeker') {
      res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Only jobseekers can update video progress' 
      });
      return;
    }

    // Validate inputs
    if (!trainingId || !videoId) {
      res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: trainingId and videoId' 
      });
      return;
    }

    // ✅ CRITICAL FIX: Pass parameters in correct order matching service method signature
    // Service method signature: updateVideoProgress(trainingId, userId, videoId, watchTimeSeconds, isCompleted)
    console.log('✅ Calling service with correct parameter order:', {
      trainingId,
      userId,
      videoId,
      watchTimeSeconds: watch_time_seconds || 0,
      isCompleted: is_completed || false
    });

    const result = await this.trainingService.updateVideoProgress(
      trainingId,           // 1st param: trainingId
      userId,               // 2nd param: userId
      videoId,              // 3rd param: videoId
      watch_time_seconds || 0,  // 4th param: watchTimeSeconds
      is_completed || false     // 5th param: isCompleted
    );

    console.log('✅ Service returned:', result);

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: result
    });
  } catch (error: any) {
    console.error('❌ Error in updateVideoProgress controller:', error);
    
    // Handle specific error cases
    if (error.message === 'User is not enrolled in this training') {
      res.status(403).json({
        success: false,
        message: 'You must be enrolled in this training to track progress'
      });
      return;
    }
    
    if (error.message === 'Video not found in this training') {
      res.status(404).json({
        success: false,
        message: 'Video not found in this training'
      });
      return;
    }
    
    next(error);
  }
}

  // ============================================
  // NOTIFICATIONS (GENERAL)
  // ============================================

async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || req.query.user_id as string || req.query.employer_id as string;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: User ID not found' 
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      let read: boolean | undefined = undefined;
      if (typeof req.query.read === 'string') {
        const r = (req.query.read as string).toLowerCase();
        if (r === 'true') read = true;
        else if (r === 'false') read = false;
      }

      console.log('🔔 Getting notifications:', {
        userId,
        userType: req.user?.user_type,
        page,
        limit,
        read
      });

      const params = { page, limit, read };
      const result = await this.trainingService.getNotifications(userId, params);

      console.log('✅ Notifications retrieved:', {
        count: result.notifications.length,
        unread: result.notifications.filter((r: any) => !r.read).length,
        total: result.pagination?.total_count || 0
      });

      res.status(200).json({ 
        success: true, 
        data: result,
        message: 'Notifications retrieved successfully'
      });
    } catch (error: any) {
      console.error('❌ Error in getNotifications:', error);
      next(error);
    }
  }

  // Duplicate downloadCertificate implementation removed; consolidated implementation retained later in this file.



async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.query.user_id as string || req.query.employer_id as string;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Unauthorized: User ID not found' 
        });
        return;
      }

      console.log('✅ Marking notification as read:', { 
        notificationId: id, 
        userId,
        userType: req.user?.user_type 
      });

      await this.trainingService.markNotificationRead(id, userId);

      res.status(200).json({ 
        success: true, 
        message: 'Notification marked as read' 
      });
    } catch (error) {
      console.error('❌ Error in markNotificationRead:', error);
      next(error);
    }
  }

  // ============================================
  // ENROLLMENT NOTIFICATIONS (EMPLOYER)
  // ============================================

async getEnrollmentNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }

      // Get employer profile ID
      const employerProfileCheck = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      let providerCondition = 't.provider_id = $1';
      let queryParams = [userId];

      if (employerProfileCheck.rows.length > 0) {
        const employerProfileId = employerProfileCheck.rows[0].id;
        providerCondition = '(t.provider_id = $1 OR t.provider_id = $2)';
        queryParams = [userId, employerProfileId];
      }

      // ✅ ENHANCED: Robust query with multiple name fallbacks
      const query = `
        SELECT
          e.id as enrollment_id,
          e.training_id,
          e.user_id,
          e.status,
          e.progress_percentage,
          e.enrolled_at,
          e.completed_at,
          e.certificate_issued,
          t.title as training_title,
          -- ✅ CRITICAL: Enhanced name extraction with multiple fallbacks
          CASE
            -- Priority 1: Full name from user table
            WHEN COALESCE(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') != ''
            THEN TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
            -- Priority 2: Parse from email (e.g., john.doe@example.com -> John Doe)
            WHEN u.email IS NOT NULL
            THEN INITCAP(REGEXP_REPLACE(
              SPLIT_PART(u.email, '@', 1),
              '[_.-]',
              ' ',
              'g'
            ))
            -- Fallback
            ELSE 'Anonymous User'
          END as jobseeker_name,
          u.first_name,
          u.last_name,
          u.email,
          -- Notification type classification
          CASE
            WHEN e.completed_at IS NOT NULL THEN 'completed'
            WHEN e.enrolled_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 'new'
            ELSE 'in_progress'
          END as notification_type
        FROM training_enrollments e
        JOIN trainings t ON e.training_id = t.id
        JOIN users u ON e.user_id = u.id
        WHERE ${providerCondition}
        ORDER BY
          CASE
            WHEN e.completed_at IS NOT NULL THEN e.completed_at
            ELSE e.enrolled_at
          END DESC
      `;

      const result = await pool.query(query, queryParams);

      console.log(`✅ Loaded ${result.rows.length} enrollment notifications with names:`, 
        result.rows.slice(0, 3).map(r => ({ 
          name: r.jobseeker_name, 
          email: r.email, 
          training: r.training_title 
        })));

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('❌ Error in getEnrollmentNotifications:', error);
      next(error);
    }
  }


  // ============================================
  // CERTIFICATE MANAGEMENT
  // ============================================

// ✅ FIXED: Robust certificate download with proper path resolution
async downloadCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.user_type;

      console.log('📥 Certificate download request:', { enrollmentId, userId, userType });

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // ✅ Query based on user_type
      let query: string;
      let queryParams: any[];

      if (userType === 'jobseeker') {
        query = `
          SELECT
            te.certificate_url,
            te.certificate_issued,
            t.title
          FROM training_enrollments te
          JOIN trainings t ON te.training_id = t.id
          WHERE te.id = $1
            AND te.user_id = $2
            AND te.certificate_issued = true
        `;
        queryParams = [enrollmentId, userId];
      } else if (userType === 'employer') {
        query = `
          SELECT
            te.certificate_url,
            te.certificate_issued,
            t.title,
            t.provider_id
          FROM training_enrollments te
          JOIN trainings t ON te.training_id = t.id
          WHERE te.id = $1
            AND te.certificate_issued = true
            AND (t.provider_id = $2 OR EXISTS (
              SELECT 1 FROM employers e WHERE e.user_id = $2 AND e.id = t.provider_id
            ))
        `;
        queryParams = [enrollmentId, userId];
      } else {
        res.status(403).json({ success: false, message: 'Forbidden: Invalid user type' });
        return;
      }

      const enrollment = await pool.query(query, queryParams);

      if (enrollment.rows.length === 0) {
        console.log('❌ Certificate not found or unauthorized for user_type:', userType);
        const msg = userType === 'jobseeker'
          ? 'Certificate not yet issued. Please complete all training videos first.'
          : 'Certificate not found or you do not own this training.';
        res.status(404).json({ success: false, message: msg });
        return;
      }

      const { certificate_url: certificateUrl, title: trainingTitle } = enrollment.rows[0];

      console.log('📜 Certificate URL from DB:', certificateUrl, 'for user_type:', userType);

      // ✅ Robust path resolution
      let certificatePath: string;
      const baseUploadPath = join(__dirname, '../../uploads');
      const path = require('path');

      if (typeof certificateUrl !== 'string' || certificateUrl.trim() === '') {
        console.error('❌ Invalid certificate URL value:', certificateUrl);
        res.status(404).json({ success: false, message: 'Invalid certificate URL format' });
        return;
      }

      // Handle different URL formats
      if (certificateUrl.startsWith('/certificates/')) {
        certificatePath = join(baseUploadPath, 'certificates', certificateUrl.replace('/certificates/', ''));
      } else if (certificateUrl.startsWith('certificates/')) {
        certificatePath = join(baseUploadPath, certificateUrl);
      } else if (certificateUrl.startsWith('/uploads/certificates/')) {
        certificatePath = join(baseUploadPath, 'certificates', certificateUrl.replace('/uploads/certificates/', ''));
      } else if (path.extname(certificateUrl) === '.pdf') {
        certificatePath = join(baseUploadPath, 'certificates', certificateUrl);
      } else {
        console.error('❌ Unrecognized certificate URL format:', certificateUrl);
        res.status(404).json({ success: false, message: 'Invalid certificate URL format' });
        return;
      }

      console.log('📂 Resolved certificate path:', certificatePath);

      // ✅ Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(certificatePath)) {
        console.error('❌ Certificate file not found at:', certificatePath);
        res.status(404).json({
          success: false,
          message: 'Certificate file not found on server. Please re-issue or contact support.',
          debug: process.env.NODE_ENV === 'development' ? { path: certificatePath, url: certificateUrl } : undefined
        });
        return;
      }

      // ✅ Set headers for PDF download
      const safeTitle = (trainingTitle || 'training').toString().replace(/[^\w\s-]/g, '').trim();
      const filename = `certificate-${safeTitle.replace(/\s+/g, '-')}-${enrollmentId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      console.log(`✅ Sending certificate to ${userType}:`, filename);

      // ✅ Stream the file
      res.download(certificatePath, filename, (err) => {
        if (err) {
          console.error('❌ Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to download certificate' });
          }
        } else {
          console.log(`✅ Certificate download successful for ${userType}: ${filename}`);
        }
      });

    } catch (error: any) {
      console.error('❌ Error in downloadCertificate:', error);
      next(error);
    }
  }

  async issueCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
      }

      if (req.user?.user_type !== 'employer') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
      }

      // Delegate certificate issuance to the service layer
      const certResult = await this.trainingService.issueCertificate(enrollmentId, userId);

      console.log(`🎓 Certificate issued for enrollment ${enrollmentId} by employer ${userId}`);

      res.status(200).json({
      success: true,
      message: 'Certificate issued successfully',
      data: certResult
      });
    } catch (error: any) {
      console.error('❌ Error in issueCertificate:', error);
      next(error);
    }
  }
}