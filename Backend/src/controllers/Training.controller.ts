import { Request, Response, NextFunction } from 'express';
import { TrainingService } from '../services/training.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import pool from '../db/db.config';
import { TrainingSearchParams } from '../types/training.type';
import { ParsedQs } from 'qs';

/**
 * Controller for handling training operations
 */
export class TrainingController {
  getTrainingVideoCount(req: Request, res: Response, next: NextFunction) {
    throw new Error('Method not implemented.');
  }
  getTrainingVideos(req: Request, res: Response, next: NextFunction) {
    throw new Error('Method not implemented.');
  }
  getPopularTrainings(req: Request, res: Response, next: NextFunction): void {
    throw new Error('Method not implemented.');
  }
  private trainingService: TrainingService;

  constructor(trainingService: TrainingService) {
    this.trainingService = trainingService;
    console.log('TrainingController instantiated with service:', !!this.trainingService);
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

      const deleted = await this.trainingService.deleteTraining(id, userId);

      if (!deleted) {
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

  // FIXED: Replace your getTrainingById method in Training.controller.ts

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
      // Public/unauthenticated - ONLY show published trainings
      const query = `
        SELECT 
          t.*,
          COUNT(v.id) as video_count,
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
        GROUP BY t.id
      `;
      
      const result = await pool.query(query, [id]);
      training = result.rows[0] || null;
      
      if (training) {
        training.enrolled = false;
        training.can_enroll = true;
      }
      
    } else if (userType === 'jobseeker') {
      // FIXED: Jobseeker - Show published trainings with enrollment status
      const query = `
        SELECT 
          t.*,
          CASE WHEN e.id IS NOT NULL THEN true ELSE false END as enrolled,
          COALESCE(e.progress_percentage, 0) as progress,
          e.status as enrollment_status,
          e.id as enrollment_id,
          COUNT(v.id) as video_count,
          COALESCE(json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'description', v.description,
              'video_url', v.video_url,
              'duration_minutes', v.duration_minutes,
              'order_index', v.order_index,
              'is_preview', v.is_preview,
              'accessible', CASE 
                WHEN e.id IS NOT NULL THEN true 
                WHEN v.is_preview = true THEN true 
                ELSE false 
              END
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
        LEFT JOIN training_enrollments e ON t.id = e.training_id AND e.user_id = $2
        LEFT JOIN training_videos v ON v.training_id = t.id
        LEFT JOIN training_outcomes o ON o.training_id = t.id
        WHERE t.id = $1 AND t.status = 'published'
        GROUP BY t.id, e.id, e.progress_percentage, e.status
      `;
      
      const result = await pool.query(query, [id, userId]);
      training = result.rows[0] || null;
      
      if (training) {
        training.can_enroll = !training.enrolled && training.status === 'published';
      }
      
    } else if (userType === 'employer') {
      // Employer - Check ownership and show ALL statuses (draft, published, suspended)
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
          t.*,
          COUNT(v.id) as video_count,
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
        GROUP BY t.id
      `;
      
      const result = await pool.query(query, queryParams);
      training = result.rows[0] || null;
    }

    if (!training) {
      console.log('Training not found or not accessible');
      res.status(404).json({
        success: false,
        message: userType === 'employer' 
          ? "Training not found or you don't have permission to view it"
          : "Training not found or not published"
      });
      return;
    }

    console.log('Training found:', training.title);
    console.log('Videos count:', training.videos?.length || training.video_count || 0);
    console.log('Status:', training.status);
    console.log('Enrolled:', training.enrolled || false);

    res.status(200).json({
      success: true,
      message: "Training retrieved successfully",
      data: training
    });

  } catch (error) {
    console.error('Error in getTrainingById:', error);
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

    const params = {
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 10, 50),
      sort_by: (req.query.sort_by as any) || 'created_at',
      sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      // Move filters to top level to match TrainingSearchParams interface
      category: req.query.category as string,
      level: req.query.level as string,
      search: req.query.search as string,
      cost_type: req.query.cost_type as string,
      mode: req.query.mode as string,
      has_certificate: req.query.has_certificate ? req.query.has_certificate === 'true' : undefined,
      status: req.query.status as string,
      filters: {} // Keep empty filters object for compatibility
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
}