// controllers/training.controller.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TrainingService } from '../services/training.service';
import {
  CreateTrainingRequest,
  UpdateTrainingRequest,
  TrainingSearchParams,
  SubmitApplicationRequest,
  ShortlistDecisionRequest,
  MarkCompletionRequest,
} from '../types/training.type';

export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  // ==========================================================================
  // 1. TRAINING CRUD (Employer-only)
  // ==========================================================================

  /**
   * POST /api/trainings
   * Employer creates a new training with sessions and outcomes
   */
  async createTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.user?.id;
      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const data: CreateTrainingRequest = req.body;
      const training = await this.trainingService.createTraining(data, employerId);

      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: training,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PUT /api/trainings/:id
   * Employer updates training (metadata, sessions, outcomes)
   */
  async updateTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const employerId = req.user?.id;
      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const data: UpdateTrainingRequest = req.body;
      const training = await this.trainingService.updateTraining(id, data, employerId);

      if (!training) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({
        success: true,
        message: 'Training updated successfully',
        data: training,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * DELETE /api/trainings/:id
   * Employer deletes a training
   */
  async deleteTraining(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const employerId = req.user?.id;
      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const deleted = await this.trainingService.deleteTraining(id, employerId);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({ success: true, message: 'Training deleted successfully' });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/trainings/:id/status
   * Employer updates training status (publish / suspend / close applications / etc.)
   */
  async updateTrainingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required' });
        return;
      }

      const training = await this.trainingService.updateTrainingStatus(id, employerId, status);
      if (!training) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({ success: true, message: 'Training status updated', data: training });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 2. TRAINING RETRIEVAL
  // ==========================================================================

  /**
   * GET /api/trainings/:id
   * Get training detail (includes sessions, outcomes, user's application/enrollment status)
   */
  async getTrainingById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.user_type || 'guest';

      let training;
      if (userId) {
        training = await this.trainingService.getTrainingByIdForUser(id, userId, userType);
      } else {
        training = await this.trainingService.getTrainingById(id);
      }

      if (!training) {
        res.status(404).json({ success: false, message: 'Training not found' });
        return;
      }

      res.json({ success: true, data: training });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings
   * List trainings (employer sees own trainings, jobseeker sees published trainings)
   */
  async getAllTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userType = req.user?.user_type;

      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        search: req.query.search as string,
        category: req.query.category as string,
        level: req.query.level as string,
        cost_type: req.query.cost_type as string,
        mode: req.query.mode as string,
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : {},
      };

      let result;
      if (userType === 'jobseeker' && userId) {
        result = await this.trainingService.getPublishedTrainingsForJobseeker(userId, params);
      } else if (userType === 'employer' && userId) {
        result = await this.trainingService.getAllTrainings(params, userId);
      } else {
        // guest or unauthenticated
        result = await this.trainingService.getAllTrainings(params);
      }

      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/enrolled
   * Jobseeker's enrolled trainings
   */
  async getEnrolledTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
      };

      const result = await this.trainingService.getEnrolledTrainings(userId, params);
      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 3. APPLICATION FLOW
  // ==========================================================================

  /**
   * POST /api/trainings/:id/apply
   * Jobseeker submits an application for a training
   */
  async submitApplication(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const body: SubmitApplicationRequest = req.body;
      const result = await this.trainingService.submitApplication(trainingId, userId, body);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/:id/applications
   * Employer retrieves all applications for a training
   */
  async getApplications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as string,
      };

      const result = await this.trainingService.getApplications(trainingId, employerId, params);
      if (!result) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * POST /api/trainings/:trainingId/applications/:applicationId/shortlist
   * Employer shortlists or rejects an application (auto-creates enrollment if shortlisted)
   */
  async shortlistApplicant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const body: ShortlistDecisionRequest = req.body;
      const result = await this.trainingService.shortlistApplicant(applicationId, employerId, body);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 4. COMPLETION MARKING
  // ==========================================================================

  /**
   * PUT /api/trainings/:trainingId/enrollments/:enrollmentId/completion
   * Employer marks a trainee as completed or not_completed
   */
  async markCompletion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const body: MarkCompletionRequest = req.body;
      const result = await this.trainingService.markTraineeCompletion(enrollmentId, employerId, body);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/:id/enrollments
   * Employer retrieves all enrollments for a training (for completion-marking UI)
   */
  async getTrainingEnrollments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as string,
      };

      const result = await this.trainingService.getTrainingEnrollments(trainingId, employerId, params);
      if (!result) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 5. CERTIFICATE ISSUANCE & VERIFICATION
  // ==========================================================================

  /**
   * POST /api/trainings/:trainingId/enrollments/:enrollmentId/certificate
   * Employer issues a certificate for a completed enrollment
   */
  async issueCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enrollmentId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await this.trainingService.issueCertificate(enrollmentId, employerId);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/certificates/verify/:code
   * Public endpoint: verify a certificate by its verification code
   */
  async verifyCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const result = await this.trainingService.verifyCertificate(code);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 6. STATS & ANALYTICS
  // ==========================================================================

  /**
   * GET /api/trainings/stats
   * Employer: overall training stats (applications, enrollments, completions)
   */
  async getTrainingStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.user?.id;
      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const stats = await this.trainingService.getTrainingStats(employerId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/:id/analytics
   * Employer: per-training analytics (application/enrollment metrics)
   */
  async getTrainingAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const employerId = req.user?.id;
      const timeRange = (req.query.time_range as string) || '30days';

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const analytics = await this.trainingService.getTrainingAnalytics(trainingId, employerId, timeRange);
      if (!analytics) {
        res.status(404).json({ success: false, message: 'Training not found or unauthorized' });
        return;
      }

      res.json({ success: true, data: analytics });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/jobseeker/training-stats
   * Jobseeker: personal training stats (applied, enrolled, completed, certificates)
   */
  async getJobseekerStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const stats = await this.trainingService.getJobseekerTrainingStats(userId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 7. REVIEWS
  // ==========================================================================

  /**
   * GET /api/trainings/:id/reviews
   * Get all reviews for a training
   */
  async getTrainingReviews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: req.query.sort_by as string || 'created_at',
        sort_order: req.query.sort_order as string || 'desc',
      };

      const result = await this.trainingService.getTrainingReviews(trainingId, params);
      if (!result) {
        res.status(404).json({ success: false, message: 'Training not found' });
        return;
      }

      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * POST /api/trainings/:id/reviews
   * Jobseeker submits/updates a review for a training (must be enrolled)
   */
  async submitReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { rating, review_text } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        return;
      }

      const review = await this.trainingService.submitTrainingReview(trainingId, userId, { rating, review_text });
      if (!review) {
        res.status(403).json({ success: false, message: 'You must be enrolled to leave a review' });
        return;
      }

      res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 8. CATEGORIES & RECOMMENDATIONS
  // ==========================================================================

  /**
   * GET /api/trainings/categories
   * List all training categories with stats
   */
  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.trainingService.getTrainingCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/popular
   * Get popular trainings (by application count & rating)
   */
  async getPopularTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const trainings = await this.trainingService.getPopularTrainings(limit);
      res.json({ success: true, data: trainings });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/recommended
   * Get recommended trainings for the current user
   */
  async getRecommendedTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const trainings = await this.trainingService.getRecommendedTrainings(userId, limit);
      res.json({ success: true, data: trainings });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 9. NOTIFICATIONS
  // ==========================================================================

  /**
   * GET /api/notifications
   * Get user's notifications
   */
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const params = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        read: req.query.read as string | boolean,
      };

      const result = await this.trainingService.getNotifications(userId, params);
      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read
   */
  async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: notificationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      await this.trainingService.markNotificationRead(notificationId, userId);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
      next(error);
    }
  }
}