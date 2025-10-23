// Training routes with correct order - replace the routes section in training.routes.ts

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

router.get('/categories', (req, res, next) => trainingController.getTrainingCategories(req, res, next));
router.get('/popular', (req, res, next) => trainingController.getPopularTrainings(req, res, next));
router.get('/recent', (req, res, next) => trainingController.getRecommendedTrainings(req, res, next));

// Public browse - shows published trainings only
router.get('/browse', optionalAuth, (req, res, next) => {
  req.query.status = 'published';
  trainingController.getAllTrainings(req, res, next);
});

// ==============================================
// PROTECTED ROUTES (require authentication)
// ==============================================
router.use(authenticateToken);

// ==============================================
// JOBSEEKER-SPECIFIC ROUTES (MUST BE BEFORE /:id)
// ==============================================

router.get('/jobseeker/available', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: GET /jobseeker/available');
  req.query.status = 'published';
  trainingController.getJobseekerTrainings(req, res, next);
});

router.get('/jobseeker/enrolled', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: GET /jobseeker/enrolled');
  trainingController.getEnrolledTrainings(req, res, next);
});

router.get('/jobseeker/stats', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: GET /jobseeker/stats');
  trainingController.getJobseekerTrainingStats(req, res, next);
});

router.get('/jobseeker/recommendations', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: GET /jobseeker/recommendations');
  trainingController.getRecommendedTrainings(req, res, next);
});

// ==============================================
// EMPLOYER-SPECIFIC ROUTES (MUST BE BEFORE /:id)
// ==============================================

router.get('/employer/my-trainings', requireEmployer, (req, res, next) => {
  console.log('📚 Route: GET /employer/my-trainings');
  trainingController.getAllTrainings(req, res, next);
});

router.get('/employer/stats', requireEmployer, (req, res, next) => {
  console.log('📚 Route: GET /employer/stats');
  trainingController.getTrainingStats(req, res, next);
});

router.get('/stats/overview', requireEmployer, (req, res, next) => {
  console.log('📚 Route: GET /stats/overview');
  trainingController.getTrainingStats(req, res, next);
});

// ==============================================
// TRAINING CRUD OPERATIONS (EMPLOYER ONLY)
// ==============================================

router.post('/', requireEmployer, (req, res, next) => {
  console.log('📚 Route: POST /trainings');
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

router.put('/:id', requireEmployer, (req, res, next) => {
  console.log('📚 Route: PUT /trainings/:id', req.params.id);
  trainingController.updateTraining(req, res, next);
});

router.delete('/:id', requireEmployer, (req, res, next) => {
  console.log('📚 Route: DELETE /trainings/:id', req.params.id);
  trainingController.deleteTraining(req, res, next);
});

// ==============================================
// TRAINING STATUS MANAGEMENT (EMPLOYER ONLY)
// ==============================================

router.post('/:id/publish', requireEmployer, (req, res, next) => {
  console.log('📚 Route: POST /trainings/:id/publish', req.params.id);
  trainingController.publishTraining(req, res, next);
});

router.post('/:id/unpublish', requireEmployer, (req, res, next) => {
  console.log('📚 Route: POST /trainings/:id/unpublish', req.params.id);
  trainingController.unpublishTraining(req, res, next);
});

router.post('/:id/suspend', requireEmployer, (req, res, next) => {
  console.log('📚 Route: POST /trainings/:id/suspend', req.params.id);
  trainingController.suspendTraining(req, res, next);
});

// ==============================================
// ENROLLMENT OPERATIONS (JOBSEEKER ONLY)
// ==============================================

router.post('/:trainingId/enroll', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: POST /trainings/:trainingId/enroll', req.params.trainingId);
  trainingController.enrollInTraining(req, res, next);
});

router.delete('/:trainingId/enroll', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: DELETE /trainings/:trainingId/enroll', req.params.trainingId);
  trainingController.unenrollFromTraining(req, res, next);
});

// ==============================================
// PROGRESS TRACKING (JOBSEEKER ONLY)
// ==============================================

router.get('/:trainingId/progress', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: GET /trainings/:trainingId/progress', req.params.trainingId);
  trainingController.getTrainingProgress(req, res, next);
});

router.put('/:trainingId/progress', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: PUT /trainings/:trainingId/progress', req.params.trainingId);
  trainingController.updateTrainingProgress(req, res, next);
});

// ==============================================
// REVIEWS AND RATINGS (JOBSEEKER ONLY)
// ==============================================

router.post('/:trainingId/review', requireJobseeker, (req, res, next) => {
  console.log('📚 Route: POST /trainings/:trainingId/review', req.params.trainingId);
  trainingController.submitTrainingReview(req, res, next);
});

// ==============================================
// ANALYTICS AND MANAGEMENT (EMPLOYER ONLY)
// ==============================================

router.get('/:id/enrollments', requireEmployer, (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id/enrollments', req.params.id);
  trainingController.getTrainingEnrollments(req, res, next);
});

router.get('/:id/analytics', requireEmployer, (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id/analytics', req.params.id);
  trainingController.getTrainingAnalytics(req, res, next);
});

// ==============================================
// SHARED ROUTES (BOTH USER TYPES)
// ==============================================

router.get('/:id/reviews', (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id/reviews', req.params.id);
  trainingController.getTrainingReviews(req, res, next);
});

router.get('/:id/videos', (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id/videos', req.params.id);
  trainingController.getTrainingVideos(req, res, next);
});

router.get('/:id/video-count', (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id/video-count', req.params.id);
  trainingController.getTrainingVideoCount(req, res, next);
});

// ==============================================
// GENERAL ROUTES (MUST BE LAST)
// ==============================================

// Get all trainings - handles both employer and jobseeker views
router.get('/', (req, res, next) => {
  console.log('📚 Route: GET /trainings (all)');
  trainingController.getAllTrainings(req, res, next);
});

// CRITICAL: This must be LAST to avoid catching specific routes
router.get('/:id', (req, res, next) => {
  console.log('📚 Route: GET /trainings/:id (details)', req.params.id);
  trainingController.getTrainingById(req, res, next);
});

console.log('✅ Training routes loaded with enhanced logging');

export default router;