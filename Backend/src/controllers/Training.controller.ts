// controllers/training.controller.ts - FIXED VERSION WITH IFRAME ENDPOINT
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

  async getAllTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userType = req.user?.user_type;

      console.log('🔍 Controller getAllTrainings:', { userId, userType });

      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 10,
        sort_by: (req.query.sort_by as string as any) || 'created_at',
        sort_order: (req.query.sort_order as string as 'asc' | 'desc') || 'desc',
        search: req.query.search as string as string,
        category: req.query.category as string as string,
        level: req.query.level as string as string,
        cost_type: req.query.cost_type as string as string,
        mode: req.query.mode as string as string,
        status: req.query.status as string as string,
        filters: req.query.filters as string ? JSON.parse(req.query.filters as string as string) : {},
      };

      let result;
      
      if (userType === 'jobseeker' && userId) {
        console.log('👤 Jobseeker request - fetching published trainings');
        result = await this.trainingService.getPublishedTrainingsForJobseeker(userId, params);
      } else if (userType === 'employer' && userId) {
        console.log('🏢 EMPLOYER REQUEST - FILTERING BY EMPLOYER ID:', userId);
        result = await this.trainingService.getAllTrainings(params, userId);
        console.log('📦 EMPLOYER TRAININGS FOUND:', result.trainings?.length || 0);
      } else {
        console.log('👁️ Guest request - fetching published trainings');
        params.status = 'published';
        result = await this.trainingService.getAllTrainings(params);
      }

      res.json({ 
        success: true, 
        data: {
          trainings: result.trainings
        },
        pagination: result.pagination 
      });
    } catch (error: any) {
      console.error('❌ Controller error:', error);
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
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 10,
        sort_by: (req.query.sort_by as string as any) || 'created_at',
        sort_order: (req.query.sort_order as string as 'asc' | 'desc') || 'desc',
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

      if (result && result.success === false) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/trainings/:trainingId/applications/:applicationId/profile
   * Employer views an applicant's full profile
   */
  async getApplicantProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      console.log('👤 Fetching applicant profile:', { applicationId, employerId });

      const profile = await this.trainingService.getApplicantProfile(applicationId, employerId);

      if (!profile) {
        res.status(404).json({ success: false, message: 'Applicant not found or unauthorized' });
        return;
      }

      res.status(200).json({ success: true, data: profile });
    } catch (error: any) {
      console.error('❌ Error fetching applicant profile:', error);
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
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 20,
        status: req.query.status as string as string,
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
   * Employer shortlists or rejects an application
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

  /**
   * POST /api/trainings/:trainingId/applications/:applicationId/enroll
   * Employer enrolls a shortlisted applicant
   */
  async enrollShortlistedApplicant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      console.log('🎓 Enrolling shortlisted applicant:', { applicationId, employerId });

      const result = await this.trainingService.enrollShortlistedApplicant(
        applicationId,
        employerId
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('❌ Error enrolling applicant:', error.message);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to enroll applicant'
      });
    }
  }

  // ==========================================================================
  // ✅ NEW: SESSION & MEETING ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/trainings/sessions/:sessionId/join
   * Get join URL for participant or moderator
   */
  async joinSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.user_type;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      console.log('🎥 User joining session:', { sessionId, userId, userType });

      const isModerator = userType === 'employer';

      const joinUrl = await this.trainingService.getSessionJoinUrl(
        sessionId,
        userId,
        isModerator
      );

      res.status(200).json({
        success: true,
        data: {
          joinUrl,
          role: isModerator ? 'moderator' : 'attendee'
        }
      });
    } catch (error: any) {
      console.error('❌ Error joining session:', error);
      next(error);
    }
  }

  /**
   * ✅ CRITICAL FIX: GET /api/trainings/sessions/:sessionId/iframe
   * Get iframe URL for employer to start meeting directly
   */
  async getSessionIframeUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const employerId = req.user?.id;
      const userType = req.user?.user_type;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      if (userType !== 'employer') {
        res.status(403).json({ 
          success: false, 
          message: 'Only employers can start meetings directly' 
        });
        return;
      }

      console.log('🎥 Getting iframe URL for employer:', { sessionId, employerId });

      const iframeUrl = await this.trainingService.getSessionIframeUrl(
        sessionId,
        employerId
      );

      res.status(200).json({
        success: true,
        data: {
          iframeUrl
        }
      });
    } catch (error: any) {
      console.error('❌ Error getting iframe URL:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get iframe URL'
      });
    }
  }

  /**
   * GET /api/trainings/meeting/:trainingId/:sessionId/:roomCode
   * Get meeting details for validation
   */
  async getMeetingDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { trainingId, sessionId, roomCode } = req.params;
      
      const details = await this.trainingService.getMeetingDetails(
        trainingId,
        sessionId,
        roomCode
      );
      
      res.json(details);
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
   * Employer retrieves all enrollments for a training
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
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 20,
        status: req.query.status as string as string,
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

  async getTrainingAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const employerId = req.user?.id;
      const timeRange = (req.query.time_range as string as string) || '30days';

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

  async getTrainingReviews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId } = req.params;
      const params = {
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 10,
        sort_by: req.query.sort_by as string as string || 'created_at',
        sort_order: req.query.sort_order as string as string || 'desc',
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

  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await this.trainingService.getTrainingCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      next(error);
    }
  }

  async getPopularTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string as string) || 10;
      const trainings = await this.trainingService.getPopularTrainings(limit);
      res.json({ success: true, data: trainings });
    } catch (error: any) {
      next(error);
    }
  }

  async getRecommendedTrainings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const limit = parseInt(req.query.limit as string as string) || 10;
      const trainings = await this.trainingService.getRecommendedTrainings(userId, limit);
      res.json({ success: true, data: trainings });
    } catch (error: any) {
      next(error);
    }
  }

  // ==========================================================================
  // 9. NOTIFICATIONS
  // ==========================================================================

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const params = {
        page: parseInt(req.query.page as string as string) || 1,
        limit: parseInt(req.query.limit as string as string) || 10,
        read: req.query.read as string as string | boolean,
      };

      const result = await this.trainingService.getNotifications(userId, params);
      res.json({ success: true, ...result });
    } catch (error: any) {
      next(error);
    }
  }

  async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      console.log('📧 Marking notification as read:', { notificationId, userId });

      await this.trainingService.markNotificationRead(notificationId, userId);
      
      res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
      console.error('❌ Error marking notification as read:', error);
      next(error);
    }
  }

  // ==========================================================================
  // 10. SESSION ATTENDANCE
  // ==========================================================================

  async markSessionAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: trainingId, sessionId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { attendance } = req.body;

      if (!Array.isArray(attendance)) {
        res.status(400).json({ success: false, message: 'Attendance data must be an array' });
        return;
      }

      const result = await this.trainingService.markSessionAttendance(
        sessionId,
        attendance.map((a: any) => a.enrollment_id),
        attendance,
        employerId
      );

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async getSessionAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const result = await this.trainingService.getSessionAttendance(sessionId, employerId);

      if (!result) {
        res.status(404).json({ success: false, message: 'Session not found or unauthorized' });
        return;
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      next(error);
    }
  }
}