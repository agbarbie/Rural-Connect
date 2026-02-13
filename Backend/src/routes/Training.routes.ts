// routes/training.routes.ts - FIXED VERSION WITH IFRAME ROUTE
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.middleware';
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

  router.get(
    '/notifications',
    authenticate,
    bind(trainingController.getNotifications)
  );

  router.patch(
    '/notifications/:id/read',
    authenticate,
    bind(trainingController.markNotificationRead)
  );

  // ==========================================================================
  // ✅ CRITICAL FIX: SESSION ROUTES - MUST COME BEFORE /:id
  // ==========================================================================

  // ✅ NEW: Get iframe URL for employer to start meeting
  router.get(
    '/sessions/:sessionId/iframe',
    authenticate,
    requireRole('employer'),
    bind(trainingController.getSessionIframeUrl)
  );

  // ✅ EXISTING: Join session as participant or moderator
  router.get(
    '/sessions/:sessionId/join',
    authenticate,
    bind(trainingController.joinSession)
  );

  // ==========================================================================
  // SPECIFIC ROUTES - MUST COME BEFORE /:id
  // ==========================================================================

  // Get applicant profile from application
  router.get(
    '/:trainingId/applications/:applicationId/profile',
    authenticate,
    requireRole('employer'),
    bind(trainingController.getApplicantProfile)
  );

  // List all categories (public)
  router.get(
    '/categories/list',
    bind(trainingController.getCategories)
  );

  // Popular trainings (public)
  router.get(
    '/popular/list',
    bind(trainingController.getPopularTrainings)
  );

  // Meeting validation endpoint
  router.get(
    '/meeting/:trainingId/:sessionId/:roomCode',
    optionalAuthenticate,
    bind(trainingController.getMeetingDetails)
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
    requireRole('jobseeker'),
    bind(trainingController.getEnrolledTrainings)
  );

  // Get jobseeker stats
  router.get(
    '/jobseeker/stats',
    authenticate,
    requireRole('jobseeker'),
    bind(trainingController.getJobseekerStats)
  );

  // Get employer's overall training stats
  router.get(
    '/stats/overview',
    authenticate,
    requireRole('employer'),
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

  // Browse trainings (public view, but optional auth for personalization)
  router.get(
    '/',
    optionalAuthenticate,
    bind(trainingController.getAllTrainings)
  );

  // View single training detail (public, but optional auth)
  router.get(
    '/:id',
    optionalAuthenticate,
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
    requireRole('jobseeker'),
    validateId,
    validateApplicationData,
    bind(trainingController.submitApplication)
  );

  // Submit a review
  router.post(
    '/:id/reviews',
    authenticate,
    requireRole('jobseeker'),
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
    requireRole('employer'),
    validateTrainingData,
    bind(trainingController.createTraining)
  );

  // Update training
  router.put(
    '/:id',
    authenticate,
    requireRole('employer'),
    validateId,
    validateTrainingData,
    bind(trainingController.updateTraining)
  );

  // Delete training
  router.delete(
    '/:id',
    authenticate,
    requireRole('employer'),
    validateId,
    bind(trainingController.deleteTraining)
  );

  // Update training status
  router.patch(
    '/:id/status',
    authenticate,
    requireRole('employer'),
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
    requireRole('employer'),
    validateId,
    bind(trainingController.getApplications)
  );

  // Shortlist or reject an application
  router.post(
    '/:trainingId/applications/:applicationId/shortlist',
    authenticate,
    requireRole('employer'),
    validateMultipleIds(['trainingId', 'applicationId']),
    validateShortlistDecision,
    bind(trainingController.shortlistApplicant)
  );

  // Enroll a shortlisted applicant
  router.post(
    '/:trainingId/applications/:applicationId/enroll',
    authenticate,
    requireRole('employer'),
    validateMultipleIds(['trainingId', 'applicationId']),
    bind(trainingController.enrollShortlistedApplicant)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Enrollment & Completion Management
  // ==========================================================================

  // Get all enrollments for a training
  router.get(
    '/:id/enrollments',
    authenticate,
    requireRole('employer'),
    validateId,
    bind(trainingController.getTrainingEnrollments)
  );

  // Mark a trainee's completion status
  router.put(
    '/:trainingId/enrollments/:enrollmentId/completion',
    authenticate,
    requireRole('employer'),
    validateMultipleIds(['trainingId', 'enrollmentId']),
    validateCompletionMarking,
    bind(trainingController.markCompletion)
  );

  // Session attendance management - Mark attendance
  router.post(
    '/:id/sessions/:sessionId/attendance',
    authenticate,
    requireRole('employer'),
    bind(trainingController.markSessionAttendance)
  );

  // Session attendance management - Get attendance
  router.get(
    '/:id/sessions/:sessionId/attendance',
    authenticate,
    requireRole('employer'),
    bind(trainingController.getSessionAttendance)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Certificate Issuance
  // ==========================================================================

  // Issue a certificate for a completed enrollment
  router.post(
    '/:trainingId/enrollments/:enrollmentId/certificate',
    authenticate,
    requireRole('employer'),
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
    requireRole('employer'),
    validateId,
    bind(trainingController.getTrainingAnalytics)
  );

  return router;
}