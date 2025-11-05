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

// Optional auth middleware for public routes that benefit from user context
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
// PUBLIC ROUTES (No auth required)
// ==============================================
router.get('/categories', (req, res, next) => trainingController.getTrainingCategories(req, res, next));
router.get('/popular', (req, res, next) => trainingController.getPopularTrainings(req, res, next));
router.get('/recent', (req, res, next) => trainingController.getRecommendedTrainings(req, res, next));
router.get('/browse', optionalAuth, (req, res, next) => {
  req.query.status = 'published';
  trainingController.getAllTrainings(req, res, next);
});

// ==============================================
// CRITICAL: AUTHENTICATED ROUTES BEFORE WILDCARD
// Apply authentication to all subsequent routes
// ==============================================
router.use(authenticateToken);

// ==============================================
// JOBSEEKER ROUTES (BEFORE WILDCARD :id ROUTES)
// ==============================================
router.get('/jobseeker/available', requireJobseeker, (req, res, next) => {
  req.query.status = 'published';
  trainingController.getJobseekerTrainings(req, res, next);
});

router.get('/jobseeker/enrolled', requireJobseeker, (req, res, next) =>
  trainingController.getEnrolledTrainings(req, res, next)
);

router.get('/jobseeker/stats', requireJobseeker, (req, res, next) =>
  trainingController.getJobseekerTrainingStats(req, res, next)
);

router.get('/jobseeker/recommendations', requireJobseeker, (req, res, next) =>
  trainingController.getRecommendedTrainings(req, res, next)
);

// ==============================================
// EMPLOYER ROUTES (BEFORE WILDCARD :id ROUTES)
// ==============================================
router.get('/employer/my-trainings', requireEmployer, (req, res, next) =>
  trainingController.getAllTrainings(req, res, next)
);

router.get('/employer/stats', requireEmployer, (req, res, next) =>
  trainingController.getTrainingStats(req, res, next)
);

router.get('/stats/overview', requireEmployer, (req, res, next) =>
  trainingController.getTrainingStats(req, res, next)
);

router.get('/employer/enrollment-notifications', requireEmployer, (req, res, next) => {
  console.log('🔔 Route: GET /trainings/employer/enrollment-notifications');
  trainingController.getEnrollmentNotifications(req, res, next);
});

// ==============================================
// NOTIFICATIONS ROUTES (BEFORE WILDCARD)
// ==============================================
router.get('/notifications', (req, res, next) => {
  console.log('🔔 Route: GET /trainings/notifications (JOBSEEKER)');
  trainingController.getNotifications(req, res, next);
});

router.put('/notifications/:id/read', (req, res, next) => {
  console.log('🔔 Route: PUT /trainings/notifications/:id/read');
  trainingController.markNotificationRead(req, res, next);
});

// ==============================================
// ENROLLMENT ROUTES (BEFORE WILDCARD)
// ==============================================
router.post('/enrollments/:enrollmentId/issue-certificate', requireEmployer, (req, res, next) => {
  console.log('🎓 Route: POST /trainings/enrollments/:enrollmentId/issue-certificate');
  trainingController.issueCertificate(req, res, next);
});

router.get('/enrollments/:enrollmentId/certificate', requireJobseeker, (req, res, next) => {
  console.log('🎓 Route: GET /trainings/enrollments/:enrollmentId/certificate');
  trainingController.downloadCertificate(req, res, next);
});

// ==============================================
// TRAINING CRUD (EMPLOYER ONLY) - SPECIFIC ROUTES FIRST
// ==============================================
router.post('/', requireEmployer, (req, res, next) => {
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

// ==============================================
// GENERAL ROUTES WITH OPTIONAL AUTH
// ==============================================
router.get('/', optionalAuth, (req, res, next) => trainingController.getAllTrainings(req, res, next));

// ==============================================
// WILDCARD :id ROUTES (MUST BE LAST)
// ==============================================

// Video routes for specific training
router.post('/:trainingId/videos', requireEmployer, (req, res, next) => 
  trainingController.addVideoToTraining(req, res, next)
);

router.put('/:trainingId/videos/:videoId', requireEmployer, (req: AuthenticatedRequest, res: any, next: any) => {
  console.log('✏️ UPDATE video request:', {
    trainingId: req.params.trainingId,
    videoId: req.params.videoId,
    userId: req.user?.id,
    body: req.body
  });
  trainingController.updateVideoInTraining(req, res, next);
});

router.delete('/:trainingId/videos/:videoId', requireEmployer, (req: AuthenticatedRequest, res: any, next: any) => {
  console.log('🗑️ DELETE video request:', {
    trainingId: req.params.trainingId,
    videoId: req.params.videoId,
    userId: req.user?.id,
    queryParams: req.query
  });
  trainingController.deleteVideoFromTraining(req, res, next);
});

// Video progress (jobseeker) - MUST come before other video routes
router.put('/:trainingId/videos/:videoId/progress', requireJobseeker, (req: AuthenticatedRequest, res: any, next: any) => {
  console.log('🎥 Route: PUT /trainings/:trainingId/videos/:videoId/progress');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  console.log('User ID:', req.user?.id);
  trainingController.updateVideoProgress(req, res, next);
});

// Enrollment operations
router.post('/:trainingId/enroll', requireJobseeker, (req, res, next) =>
  trainingController.enrollInTraining(req, res, next)
);

router.delete('/:trainingId/enroll', requireJobseeker, (req, res, next) =>
  trainingController.unenrollFromTraining(req, res, next)
);

// Progress tracking
router.get('/:trainingId/progress', requireJobseeker, (req, res, next) =>
  trainingController.getTrainingProgress(req, res, next)
);

router.put('/:trainingId/progress', requireJobseeker, (req, res, next) =>
  trainingController.updateTrainingProgress(req, res, next)
);

// Reviews
router.post('/:trainingId/review', requireJobseeker, (req, res, next) =>
  trainingController.submitTrainingReview(req, res, next)
);

// Training status management (employer)
router.post('/:id/publish', requireEmployer, (req, res, next) =>
  trainingController.publishTraining(req, res, next)
);

router.post('/:id/unpublish', requireEmployer, (req, res, next) =>
  trainingController.unpublishTraining(req, res, next)
);

router.post('/:id/suspend', requireEmployer, (req, res, next) =>
  trainingController.suspendTraining(req, res, next)
);

// Analytics (employer)
router.get('/:id/enrollments', requireEmployer, (req, res, next) =>
  trainingController.getTrainingEnrollments(req, res, next)
);

router.get('/:id/analytics', requireEmployer, (req, res, next) =>
  trainingController.getTrainingAnalytics(req, res, next)
);

// Shared routes with optional auth
router.get('/:id/reviews', optionalAuth, (req, res, next) => 
  trainingController.getTrainingReviews(req, res, next)
);

router.get('/:id/videos', optionalAuth, (req, res, next) => 
  trainingController.getTrainingVideos(req, res, next)
);

router.get('/:id/video-count', optionalAuth, (req, res, next) => 
  trainingController.getTrainingVideoCount(req, res, next)
);

// CRUD operations (must be at the end)
router.put('/:id', requireEmployer, (req, res, next) =>
  trainingController.updateTraining(req, res, next)
);

router.delete('/:id', requireEmployer, (req, res, next) =>
  trainingController.deleteTraining(req, res, next)
);

// GET by ID must be ABSOLUTE LAST
router.get('/:id', optionalAuth, (req, res, next) => 
  trainingController.getTrainingById(req, res, next)
);

console.log('✅ Training routes loaded with correct order (specific before wildcard)');
export default router;