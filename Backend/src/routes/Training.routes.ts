// Replace your existing routes with this complete version
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import {
  authenticateToken,
  requireEmployer,
  requireJobseeker,
  AuthenticatedRequest
} from '../middleware/auth.middleware';
import db from '../db/db.config';

const router = Router();

const trainingService = new TrainingService(db);
const trainingController = new TrainingController(trainingService);

// Optional auth middleware
const optionalAuth = (req: AuthenticatedRequest, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  import('jsonwebtoken').then((jwt) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        user_type: decoded.user_type
      };
      next();
    } catch (error) {
      next();
    }
  });
};

// ==============================================
// PUBLIC ROUTES (no authentication required)
// ==============================================

// Public browse - shows published trainings only
router.get('/browse', optionalAuth, (req, res, next) => {
  // Set status filter to published for public browsing
  req.query.status = 'published';
  trainingController.getAllTrainings(req, res, next);
});

router.get('/categories', (req, res, next) => trainingController.getTrainingCategories(req, res, next));
router.get('/popular', (req, res, next) => trainingController.getPopularTrainings(req, res, next));
router.get('/recent', (req, res, next) => trainingController.getRecommendedTrainings(req, res, next));

// ==============================================
// PROTECTED ROUTES (require authentication)
// ==============================================
router.use(authenticateToken);

// ==============================================
// JOBSEEKER-SPECIFIC ROUTES
// ==============================================

// Available trainings for jobseekers (published only)
router.get('/jobseeker/available', requireJobseeker, (req, res, next) => {
  req.query.status = 'published'; // Force published status
  trainingController.getJobseekerTrainings(req, res, next);
});

// Enrolled trainings for jobseekers
router.get('/jobseeker/enrolled', requireJobseeker, (req, res, next) => {
  trainingController.getEnrolledTrainings(req, res, next);
});

// Jobseeker stats
router.get('/jobseeker/stats', requireJobseeker, (req, res, next) => {
  trainingController.getJobseekerTrainingStats(req, res, next);
});

// Recommendations for jobseekers
router.get('/jobseeker/recommendations', requireJobseeker, (req, res, next) => {
  trainingController.getRecommendedTrainings(req, res, next);
});

// ==============================================
// EMPLOYER-SPECIFIC ROUTES  
// ==============================================

// Employer's own trainings (all statuses)
router.get('/employer/my-trainings', requireEmployer, (req, res, next) => {
  trainingController.getAllTrainings(req, res, next);
});

// Employer stats
router.get('/employer/stats', requireEmployer, (req, res, next) => {
  trainingController.getTrainingStats(req, res, next);
});

router.get('/stats/overview', requireEmployer, (req, res, next) => {
  trainingController.getTrainingStats(req, res, next);
});

// ==============================================
// TRAINING CRUD OPERATIONS (EMPLOYER ONLY)
// ==============================================

// Create training
router.post('/', requireEmployer, (req, res, next) => {
  // Basic validation
  const { title, description, category, level } = req.body;
  if (!title || !description || !category || !level) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: title, description, category, level'
    });
    return;
  }
  trainingController.createTraining(req, res, next);
});

// Update training
router.put('/:id', requireEmployer, (req, res, next) => {
  trainingController.updateTraining(req, res, next);
});

// Delete training
router.delete('/:id', requireEmployer, (req, res, next) => {
  trainingController.deleteTraining(req, res, next);
});

// ==============================================
// TRAINING STATUS MANAGEMENT (EMPLOYER ONLY)
// ==============================================

router.post('/:id/publish', requireEmployer, (req, res, next) => {
  trainingController.publishTraining(req, res, next);
});

router.post('/:id/unpublish', requireEmployer, (req, res, next) => {
  trainingController.unpublishTraining(req, res, next);
});

router.post('/:id/suspend', requireEmployer, (req, res, next) => {
  trainingController.suspendTraining(req, res, next);
});

// ==============================================
// ENROLLMENT OPERATIONS (JOBSEEKER ONLY)
// ==============================================

router.post('/:trainingId/enroll', requireJobseeker, (req, res, next) => {
  trainingController.enrollInTraining(req, res, next);
});

router.delete('/:trainingId/enroll', requireJobseeker, (req, res, next) => {
  trainingController.unenrollFromTraining(req, res, next);
});

// ==============================================
// PROGRESS TRACKING (JOBSEEKER ONLY)
// ==============================================

router.get('/:trainingId/progress', requireJobseeker, (req, res, next) => {
  trainingController.getTrainingProgress(req, res, next);
});

router.put('/:trainingId/progress', requireJobseeker, (req, res, next) => {
  trainingController.updateTrainingProgress(req, res, next);
});

// ==============================================
// REVIEWS AND RATINGS (JOBSEEKER ONLY)
// ==============================================

router.post('/:trainingId/review', requireJobseeker, (req, res, next) => {
  trainingController.submitTrainingReview(req, res, next);
});

// ==============================================
// ANALYTICS AND MANAGEMENT (EMPLOYER ONLY)
// ==============================================

router.get('/:id/enrollments', requireEmployer, (req, res, next) => {
  trainingController.getTrainingEnrollments(req, res, next);
});

router.get('/:id/analytics', requireEmployer, (req, res, next) => {
  trainingController.getTrainingAnalytics(req, res, next);
});

// ==============================================
// SHARED ROUTES (BOTH USER TYPES)
// ==============================================

// Get training reviews (both employers and jobseekers can view)
router.get('/:id/reviews', (req, res, next) => {
  trainingController.getTrainingReviews(req, res, next);
});

// ==============================================
// GENERAL ROUTES (MUST BE LAST)
// ==============================================

// Get all trainings - handles both employer (their own) and jobseeker (published) views
router.get('/', (req, res, next) => {
  trainingController.getAllTrainings(req, res, next);
});

// Get specific training by ID
router.get('/:id', (req, res, next) => {
  trainingController.getTrainingById(req, res, next);
});


export default router;