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

  // EMPLOYER METHODS (existing)

  // Add these methods to your TrainingController class

// Training status management methods
unpublishTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const training = await this.trainingService.updateTraining(
      id, 
      { status: 'draft' }, 
      req.user!.employer_id!
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
    const training = await this.trainingService.updateTraining(
      id, 
      { status: 'suspended' }, 
      req.user!.employer_id!
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
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      status: req.query.status as string
    };

    const enrollments = await this.trainingService.getTrainingEnrollments(id, req.user!.employer_id!, params);
    
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
    const timeRange = req.query.range as string || '30days';

    const analytics = await this.trainingService.getTrainingAnalytics(id, req.user!.employer_id!, timeRange);
    
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

      const employerId = req.user?.user_type === 'employer' ? req.user.employer_id : undefined;
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
      const trainingData: CreateTrainingRequest = req.body;
      const training = await this.trainingService.createTraining(trainingData, req.user!.employer_id!);
      
      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  updateTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData: UpdateTrainingRequest = req.body;
      
      const training = await this.trainingService.updateTraining(id, updateData, req.user!.employer_id!);
      
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
      const deleted = await this.trainingService.deleteTraining(id, req.user!.employer_id!);
      
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
      const stats = await this.trainingService.getTrainingStats(req.user!.employer_id!);
      
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
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'published' }, 
        req.user!.employer_id!
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

  // JOBSEEKER METHODS (new)
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

      const updatedProgress = await this.trainingService.updateUserProgress(trainingId, userId, progressData);
      
      if (!updatedProgress) {
        res.status(404).json({
          success: false,
          message: 'Training enrollment not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Progress updated successfully',
        data: updatedProgress
      });
    } catch (error) {
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

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
        return;
      }

      const review = await this.trainingService.submitTrainingReview(trainingId, userId, {
        rating,
        review_text
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