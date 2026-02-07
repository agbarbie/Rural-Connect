// routes/training.routes.ts - FIXED VERSION
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import { protect } from '../middleware/protect'; // ✅ USE YOUR ACTUAL AUTH MIDDLEWARE
import { checkRole } from '../middleware/protect'; // ✅ USE YOUR ACTUAL ROLE MIDDLEWARE
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
    protect, // ✅ CHANGED
    bind(trainingController.getNotifications)
  );

  // Mark notification as read
  router.patch(
    '/notifications/:id/read',
    protect, // ✅ CHANGED
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
    protect, // ✅ CHANGED
    bind(trainingController.getRecommendedTrainings)
  );

  // Get enrolled trainings
  router.get(
    '/enrolled/list',
    protect, // ✅ CHANGED
    checkRole(['jobseeker']), // ✅ CHANGED
    bind(trainingController.getEnrolledTrainings)
  );

  // Get jobseeker stats
  router.get(
    '/jobseeker/stats',
    protect, // ✅ CHANGED
    checkRole(['jobseeker']), // ✅ CHANGED
    bind(trainingController.getJobseekerStats)
  );

  // Get employer's overall training stats
  router.get(
    '/stats/overview',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
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

  // View single training detail
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

  // Apply for a training - ✅ THIS IS THE ROUTE YOU'RE TESTING
  router.post(
    '/:id/apply',
    protect, // ✅ CHANGED - This is the critical fix
    checkRole(['jobseeker']), // ✅ CHANGED
    validateId,
    validateApplicationData,
    bind(trainingController.submitApplication)
  );

  // Submit a review
  router.post(
    '/:id/reviews',
    protect, // ✅ CHANGED
    checkRole(['jobseeker']), // ✅ CHANGED
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
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateTrainingData,
    bind(trainingController.createTraining)
  );

  // Update training
  router.put(
    '/:id',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    validateTrainingData,
    bind(trainingController.updateTraining)
  );

  // Delete training
  router.delete(
    '/:id',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    bind(trainingController.deleteTraining)
  );

  // Update training status
  router.patch(
    '/:id/status',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    bind(trainingController.updateTrainingStatus)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Application Management
  // ==========================================================================

  // Get all applications for a training
  router.get(
    '/:id/applications',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    bind(trainingController.getApplications)
  );

  // Shortlist or reject an application
  router.post(
    '/:trainingId/applications/:applicationId/shortlist',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
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
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    bind(trainingController.getTrainingEnrollments)
  );

  // Mark a trainee's completion status
  router.put(
    '/:trainingId/enrollments/:enrollmentId/completion',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateMultipleIds(['trainingId', 'enrollmentId']),
    validateCompletionMarking,
    bind(trainingController.markCompletion)
  );

  // Session attendance management
  router.post(
    '/:id/sessions/:sessionId/attendance',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    bind(trainingController.markSessionAttendance)
  );

  router.get(
    '/:id/sessions/:sessionId/attendance',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    bind(trainingController.getSessionAttendance)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Certificate Issuance
  // ==========================================================================

  // Issue a certificate for a completed enrollment
  router.post(
    '/:trainingId/enrollments/:enrollmentId/certificate',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateMultipleIds(['trainingId', 'enrollmentId']),
    bind(trainingController.issueCertificate)
  );

  // ==========================================================================
  // EMPLOYER ROUTES - Analytics
  // ==========================================================================

  // Get analytics for a specific training
  router.get(
    '/:id/analytics',
    protect, // ✅ CHANGED
    checkRole(['employer']), // ✅ CHANGED
    validateId,
    bind(trainingController.getTrainingAnalytics)
  );

  return router;
}