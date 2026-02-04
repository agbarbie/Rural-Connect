// routes/training.routes.ts
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { 
  validateTrainingData, 
  validateApplicationData,
  validateShortlistDecision,
  validateCompletionMarking,
  validateReviewData,
  validateId,
  validateMultipleIds
} from '../middleware/validation.middleware';
import { Pool } from 'pg';

export function createTrainingRoutes(db: Pool): Router {
  const router = Router();
  const trainingService = new TrainingService(db);
  const trainingController = new TrainingController(trainingService);

  // Bind methods to preserve 'this' context
  const bind = (fn: Function) => fn.bind(trainingController);

  // ==========================================================================
  // NOTIFICATION ROUTES - MUST BE FIRST to avoid conflicts with /:id
  // ==========================================================================

  // Get user's notifications
  router.get(
    '/notifications',
    authenticate,
    bind(trainingController.getNotifications)
  );

  // Mark notification as read
  router.patch(
    '/notifications/:id/read',
    authenticate,
    validateId,
    bind(trainingController.markNotificationRead)
  );

  // ==========================================================================
  // SPECIFIC ROUTES - MUST COME BEFORE /:id
  // ==========================================================================

  // List all categories
  router.get(
    '/categories/list',
    bind(trainingController.getCategories)
  );

  // Popular trainings
  router.get(
    '/popular/list',
    bind(trainingController.getPopularTrainings)
  );

  // Get recommended trainings (requires login)
  router.get(
    '/recommended/list',
    authenticate,
    bind(trainingController.getRecommendedTrainings)
  );

  // Get enrolled trainings
  router.get(
    '/enrolled/list',
    authenticate,
    authorize('jobseeker'),
    bind(trainingController.getEnrolledTrainings)
  );

  // Get jobseeker stats
  router.get(
    '/jobseeker/stats',
    authenticate,
    authorize('jobseeker'),
    bind(trainingController.getJobseekerStats)
  );

  // Get employer's overall training stats
  router.get(
    '/stats/overview',
    authenticate,
    authorize('employer'),
    bind(trainingController.getTrainingStats)
  );

  // Certificate verification (public endpoint)
  router.get(
    '/certificates/verify/:code',
    bind(trainingController.verifyCertificate)
  );

  // ==========================================================================
  // PUBLIC ROUTES (no authentication required)
  // ==========================================================================

  // Browse trainings (public view)
  router.get(
    '/',
    bind(trainingController.getAllTrainings)
  );

  // View single training detail - MUST COME AFTER ALL SPECIFIC ROUTES
  router.get(
    '/:id',
    validateId,
    bind(trainingController.getTrainingById)
  );

  // Training reviews (public)
  router.get(
    '/:id/reviews',
    validateId,
    bind(trainingController.getTrainingReviews)
  );

  // ==========================================================================
  // JOBSEEKER ROUTES
  // ==========================================================================

  // Apply for a training
  router.post(
    '/:id/apply',
    authenticate,
    authorize('jobseeker'),
    validateId,
    validateApplicationData,
    bind(trainingController.submitApplication)
  );

  // Submit a review
  router.post(
    '/:id/reviews',
    authenticate,
    authorize('jobseeker'),
    validateId,
    validateReviewData,
    bind(trainingController.submitReview)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Training Management
  // ==========================================================================

  // Create a new training
  router.post(
    '/',
    authenticate,
    authorize('employer'),
    validateTrainingData,
    bind(trainingController.createTraining)
  );

  // Update training
  router.put(
    '/:id',
    authenticate,
    authorize('employer'),
    validateId,
    validateTrainingData,
    bind(trainingController.updateTraining)
  );

  // Delete training
  router.delete(
    '/:id',
    authenticate,
    authorize('employer'),
    validateId,
    bind(trainingController.deleteTraining)
  );

  // Update training status (publish / suspend / close applications / etc.)
  router.patch(
    '/:id/status',
    authenticate,
    authorize('employer'),
    validateId,
    bind(trainingController.updateTrainingStatus)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Application Management
  // ==========================================================================

  // Get all applications for a training
  router.get(
    '/:id/applications',
    authenticate,
    authorize('employer'),
    validateId,
    bind(trainingController.getApplications)
  );

  // Shortlist or reject an application
  router.post(
    '/:trainingId/applications/:applicationId/shortlist',
    authenticate,
    authorize('employer'),
    validateMultipleIds(['trainingId', 'applicationId']),
    validateShortlistDecision,
    bind(trainingController.shortlistApplicant)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Enrollment & Completion Management
  // ==========================================================================

  // Get all enrollments for a training
  router.get(
    '/:id/enrollments',
    authenticate,
    authorize('employer'),
    validateId,
    bind(trainingController.getTrainingEnrollments)
  );

  // Mark a trainee's completion status
  router.put(
    '/:trainingId/enrollments/:enrollmentId/completion',
    authenticate,
    authorize('employer'),
    validateMultipleIds(['trainingId', 'enrollmentId']),
    validateCompletionMarking,
    bind(trainingController.markCompletion)
  );

  // Session attendance management
router.post(
  '/:id/sessions/:sessionId/attendance',
  authenticate,
  authorize('employer'),
  bind(trainingController.markSessionAttendance)
);

router.get(
  '/:id/sessions/:sessionId/attendance',
  authenticate,
  authorize('employer'),
  bind(trainingController.getSessionAttendance)
);
  // ==========================================================================
  // EMPLOYER ROUTES - Certificate Issuance
  // ==========================================================================

  // Issue a certificate for a completed enrollment
  router.post(
    '/:trainingId/enrollments/:enrollmentId/certificate',
    authenticate,
    authorize('employer'),
    validateMultipleIds(['trainingId', 'enrollmentId']),
    bind(trainingController.issueCertificate)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Analytics
  // ==========================================================================

  // Get analytics for a specific training
  router.get(
    '/:id/analytics',
    authenticate,
    authorize('employer'),
    validateId,
    bind(trainingController.getTrainingAnalytics)
  );

  return router;
}