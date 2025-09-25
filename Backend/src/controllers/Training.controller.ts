// controllers/training.controller.ts
import { Response, NextFunction } from 'express';
import { TrainingService } from '../services/training.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { 
  CreateTrainingRequest, 
  UpdateTrainingRequest,
  TrainingSearchParams
} from '../types/training.type';

export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  // EMPLOYER METHODS

  // Training status management methods
  unpublishTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'draft' }, 
        userId
      );
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training unpublished successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  suspendTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'suspended' }, 
        userId
      );
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training suspended successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  // Training enrollment management (for employers)
  getTrainingEnrollments = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        status: req.query.status as string
      };

      const enrollments = await this.trainingService.getTrainingEnrollments(id, userId, params);
      
      if (!enrollments) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: enrollments
      });
    } catch (error) {
      next(error);
    }
  };

  // Training analytics (for employers)
  getTrainingAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const timeRange = req.query.range as string || '30days';

      const analytics = await this.trainingService.getTrainingAnalytics(id, userId, timeRange);
      
      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  };

  // Training reviews (view for both user types)
  getTrainingReviews = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as string) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc'
      };

      const reviews = await this.trainingService.getTrainingReviews(id, params);
      
      if (!reviews) {
        res.status(404).json({
          success: false,
          message: 'Training not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: reviews
      });
    } catch (error) {
      next(error);
    }
  }; 

  getAllTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        filters: {
          category: req.query.category as string,
          level: req.query.level ? [req.query.level as string] : undefined,
          search: req.query.search as string
        }
      };

      const employerId = req.user?.user_type === 'employer' ? req.user.id : undefined;
      const result = await this.trainingService.getAllTrainings(params, employerId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getTrainingById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.user_type === 'jobseeker' ? req.user.id : undefined;
      const training = await this.trainingService.getTrainingById(id);
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  createTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('=== TRAINING CREATION START ===');
      console.log('Request User Info:', {
        id: req.user?.id,
        email: req.user?.email,
        user_type: req.user?.user_type
      });
      
      const trainingData: CreateTrainingRequest = req.body;
      const userId = req.user!.id;
      
      console.log('Training Data Summary:', {
        title: trainingData.title,
        category: trainingData.category,
        level: trainingData.level,
        provider_name: trainingData.provider_name,
        duration_hours: trainingData.duration_hours,
        cost_type: trainingData.cost_type,
        price: trainingData.price,
        mode: trainingData.mode,
        has_videos: trainingData.videos?.length || 0,
        has_outcomes: trainingData.outcomes?.length || 0
      });
      
      const training = await this.trainingService.createTraining(trainingData, userId);
      
      console.log('=== TRAINING CREATION SUCCESS ===');
      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: training
      });
    } catch (error: any) {
      console.error('=== TRAINING CREATION ERROR ===');
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Handle specific database constraint errors
      if (error.code === '23503') {
        // Foreign key constraint violation
        if (error.constraint?.includes('provider_id') || error.message?.includes('provider_id')) {
          res.status(400).json({
            success: false,
            message: 'Invalid user account',
            details: 'The user account does not exist or is not properly configured as an employer'
          });
          return;
        }
        
        res.status(400).json({
          success: false,
          message: 'Database reference error',
          details: 'One or more referenced resources do not exist'
        });
        return;
      }
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          message: 'Training already exists',
          details: 'A training with this information already exists'
        });
        return;
      }
      
      // Handle check constraint violations
      if (error.code === '23514') {
        res.status(400).json({
          success: false,
          message: 'Invalid data format',
          details: error.detail || 'The provided data does not meet the required format'
        });
        return;
      }
      
      // Handle user validation errors from service layer
      if (error.message?.includes('does not exist in the database')) {
        res.status(404).json({
          success: false,
          message: 'User account not found',
          details: 'Please ensure you are logged in with a valid employer account'
        });
        return;
      }
      
      if (error.message?.includes('not an employer')) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          details: 'Only employer accounts can create trainings'
        });
        return;
      }
      
      if (error.message?.includes('Employer reference error')) {
        res.status(400).json({
          success: false,
          message: 'Account verification failed',
          details: error.message
        });
        return;
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          details: error.message
        });
        return;
      }
      
      // Default error handling
      console.error('Unhandled training creation error:', error);
      next(error);
    }
  };

  updateTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updateData: UpdateTrainingRequest = req.body;
      
      const training = await this.trainingService.updateTraining(id, updateData, userId);
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training updated successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const deleted = await this.trainingService.deleteTraining(id, userId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
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
  };

  getTrainingStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.trainingService.getTrainingStats(userId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  publishTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'published' }, 
        userId
      );
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training published successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  // JOBSEEKER METHODS

  getJobseekerTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        filters: {
          category: req.query.category as string,
          level: req.query.level ? [req.query.level as string] : undefined,
          search: req.query.search as string,
          cost_type: req.query.cost_type ? [req.query.cost_type as string] : undefined,
          mode: req.query.mode ? [req.query.mode as string] : undefined,
          has_certificate: req.query.has_certificate === 'true' ? true : undefined,
          status: ['published']
        }
      };

      const userId = req.user?.id;
      const result = await this.trainingService.getJobseekerTrainings(params, userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getEnrolledTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'enrolled_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc'
      };

      const result = await this.trainingService.getEnrolledTrainings(userId, params);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  enrollInTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { trainingId } = req.params;
      const userId = req.user!.id;

      const enrollment = await this.trainingService.enrollUserInTraining(trainingId, userId);
      
      if (!enrollment) {
        res.status(400).json({
          success: false,
          message: 'Unable to enroll in training. Training may not exist, you may already be enrolled, or it may be at capacity.'
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
  };

  unenrollFromTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { trainingId } = req.params;
      const userId = req.user!.id;

      const success = await this.trainingService.unenrollUserFromTraining(trainingId, userId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Enrollment not found or already cancelled'
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
  };

  updateTrainingProgress = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { trainingId } = req.params;
      const userId = req.user!.id;
      const progressData = req.body;

      // Validate required fields
      if (progressData.progress_percentage === undefined || progressData.progress_percentage === null) {
        res.status(400).json({
          success: false,
          message: 'Progress percentage is required'
        });
        return;
      }

      // Validate progress percentage range
      const progress = parseFloat(progressData.progress_percentage);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        res.status(400).json({
          success: false,
          message: 'Progress percentage must be a number between 0 and 100'
        });
        return;
      }

      const updatedProgress = await this.trainingService.updateTrainingProgress(trainingId, userId, {
        ...progressData,
        progress_percentage: progress
      });
      
      res.status(200).json({
        success: true,
        message: 'Progress updated successfully',
        data: updatedProgress
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Training enrollment not found') {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  };

  getTrainingProgress = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { trainingId } = req.params;
      const userId = req.user!.id;

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
        data: progress
      });
    } catch (error) {
      next(error);
    }
  };

  submitTrainingReview = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { trainingId } = req.params;
      const userId = req.user!.id;
      const { rating, review_text } = req.body;

      // Validate rating
      const ratingInt = parseInt(rating);
      if (!ratingInt || ratingInt < 1 || ratingInt > 5 || !Number.isInteger(ratingInt)) {
        res.status(400).json({
          success: false,
          message: 'Rating must be an integer between 1 and 5'
        });
        return;
      }

      // Validate review text length if provided
      if (review_text && typeof review_text === 'string' && review_text.length > 1000) {
        res.status(400).json({
          success: false,
          message: 'Review text cannot exceed 1000 characters'
        });
        return;
      }

      const review = await this.trainingService.submitTrainingReview(trainingId, userId, {
        rating: ratingInt,
        review_text: review_text?.trim() || null
      });
      
      if (!review) {
        res.status(400).json({
          success: false,
          message: 'Unable to submit review. You may not be enrolled in this training.'
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  };

  getJobseekerTrainingStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.trainingService.getJobseekerTrainingStats(userId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  getRecommendedTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Validate limit parameter
      if (limit < 1 || limit > 50) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 50'
        });
        return;
      }
      
      const recommendations = await this.trainingService.getRecommendedTrainings(userId, limit);
      
      res.status(200).json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  };

  getTrainingCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.trainingService.getTrainingCategories();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  };
}