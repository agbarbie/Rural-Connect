import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import {
  authenticateToken,
  requireEmployerWithId,
  requireJobseeker,
  requireJobseekerWithId,
  requireEmployerOrJobseeker,
  requireAnyRole,
  optionalAuth
} from '../middleware/auth.middleware';
import db from '../db/db.config';

const router = Router();
const trainingService = new TrainingService(db);
const trainingController = new TrainingController(trainingService);

// ==============================================
// PUBLIC ROUTES (no authentication required)
// ==============================================
router.get('/', optionalAuth, trainingController.getAllTrainings);
router.get('/categories', trainingController.getTrainingCategories);

// ==============================================
// PROTECTED ROUTES (require authentication)
// ==============================================
router.use(authenticateToken);

// ==============================================
// JOBSEEKER-SPECIFIC ROUTES
// ==============================================
// Training browsing and discovery
router.get('/jobseeker/available', requireJobseeker, trainingController.getJobseekerTrainings);
router.get('/jobseeker/enrolled', requireJobseekerWithId, trainingController.getEnrolledTrainings);
router.get('/jobseeker/stats', requireJobseekerWithId, trainingController.getJobseekerTrainingStats);
router.get('/jobseeker/recommendations', requireJobseekerWithId, trainingController.getRecommendedTrainings);

// Training enrollment operations (jobseeker only)
router.post('/:trainingId/enroll', requireJobseekerWithId, trainingController.enrollInTraining);
router.delete('/:trainingId/enroll', requireJobseekerWithId, trainingController.unenrollFromTraining);

// Progress tracking (jobseeker only)
router.get('/:trainingId/progress', requireJobseekerWithId, trainingController.getTrainingProgress);
router.put('/:trainingId/progress', requireJobseekerWithId, trainingController.updateTrainingProgress);

// Reviews and ratings (jobseeker only)
router.post('/:trainingId/review', requireJobseekerWithId, trainingController.submitTrainingReview);

// ==============================================
// EMPLOYER-SPECIFIC ROUTES
// ==============================================
// Training management overview
router.get('/employer/stats', requireEmployerWithId, trainingController.getTrainingStats);
router.get('/employer/my-trainings', requireEmployerWithId, trainingController.getAllTrainings);

// Training CRUD operations (employer only)
router.post('/', requireEmployerWithId, trainingController.createTraining);
router.put('/:id', requireEmployerWithId, trainingController.updateTraining);
router.delete('/:id', requireEmployerWithId, trainingController.deleteTraining);

// Training status management
router.post('/:id/publish', requireEmployerWithId, trainingController.publishTraining);
router.post('/:id/unpublish', requireEmployerWithId, trainingController.unpublishTraining);
router.post('/:id/suspend', requireEmployerWithId, trainingController.suspendTraining);

// Training analytics and management
router.get('/:id/enrollments', requireEmployerWithId, trainingController.getTrainingEnrollments);
router.get('/:id/analytics', requireEmployerWithId, trainingController.getTrainingAnalytics);

// ==============================================
// SHARED ROUTES (both employers and jobseekers)
// ==============================================
// Training details (different permissions based on user type)
router.get('/:id', requireEmployerOrJobseeker, trainingController.getTrainingById);

// Training reviews (view for both, create for jobseekers only)
router.get('/:id/reviews', requireEmployerOrJobseeker, trainingController.getTrainingReviews);

// ==============================================
// ADMIN ROUTES (future enhancement)
// ==============================================
// Uncomment these when admin functionality is needed
// router.get('/admin/all', requireAnyRole('admin'), trainingController.getAllTrainingsAdmin);
// router.post('/admin/:id/approve', requireAnyRole('admin'), trainingController.approveTraining);
// router.post('/admin/:id/reject', requireAnyRole('admin'), trainingController.rejectTraining);

export default router;