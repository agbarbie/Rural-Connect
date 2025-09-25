import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import {
  authenticateToken,
  requireEmployer,
  requireJobseeker,
  requireEmployerOrJobseeker,
  AuthenticatedRequest
} from '../middleware/auth.middleware';
import db from '../db/db.config';

const router = Router();
const trainingService = new TrainingService(db);
const trainingController = new TrainingController(trainingService);

// Optional auth middleware - allows both authenticated and non-authenticated users
const optionalAuth = (req: AuthenticatedRequest, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // No token provided - continue without user info
    next();
    return;
  }

  // If token exists, try to verify it
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
      // Invalid token - continue without user info
      next();
    }
  });
};

// Middleware to require either employer or jobseeker role
const requireEmployerOrJobseekerLocal = (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  if (req.user.user_type !== 'employer' && req.user.user_type !== 'jobseeker') {
    res.status(403).json({
      success: false,
      message: 'Access denied. Employer or jobseeker role required.',
      currentRole: req.user.user_type
    });
    return;
  }

  next();
};

// Basic validation function (temporary)
const validateBasicTrainingData = (req: AuthenticatedRequest, res: any, next: any) => {
  const { title, description, category, level } = req.body;
  
  if (!title || !description || !category || !level) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields: title, description, category, level'
    });
    return;
  }
  
  next();
};

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
// SPECIFIC NAMED ROUTES (MUST COME BEFORE /:id PATTERNS)
// ==============================================

// JOBSEEKER-SPECIFIC ROUTES
router.get('/jobseeker/available', requireJobseeker, trainingController.getJobseekerTrainings);
router.get('/jobseeker/enrolled', requireJobseeker, trainingController.getEnrolledTrainings);
router.get('/jobseeker/stats', requireJobseeker, trainingController.getJobseekerTrainingStats);
router.get('/jobseeker/recommendations', requireJobseeker, trainingController.getRecommendedTrainings);

// EMPLOYER-SPECIFIC ROUTES  
router.get('/employer/stats', requireEmployer, trainingController.getTrainingStats);
router.get('/employer/my-trainings', requireEmployer, trainingController.getAllTrainings);
router.get('/stats/overview', requireEmployer, trainingController.getTrainingStats); // ADD THIS LINE
// ==============================================
// PARAMETERIZED ROUTES (MUST COME AFTER NAMED ROUTES)
// ==============================================

// Training enrollment operations (jobseeker only)
router.post('/:trainingId/enroll', requireJobseeker, trainingController.enrollInTraining);
router.delete('/:trainingId/enroll', requireJobseeker, trainingController.unenrollFromTraining);

// Progress tracking (jobseeker only)
router.get('/:trainingId/progress', requireJobseeker, trainingController.getTrainingProgress);
router.put('/:trainingId/progress', requireJobseeker, trainingController.updateTrainingProgress);

// Reviews and ratings (jobseeker only)
router.post('/:trainingId/review', requireJobseeker, trainingController.submitTrainingReview);

// Training CRUD operations (employer only)
router.post('/', validateBasicTrainingData, requireEmployer, trainingController.createTraining);
router.put('/:id', requireEmployer, trainingController.updateTraining);
router.delete('/:id', requireEmployer, trainingController.deleteTraining);

// Training status management (employer only)
router.post('/:id/publish', requireEmployer, trainingController.publishTraining);
router.post('/:id/unpublish', requireEmployer, trainingController.unpublishTraining);
router.post('/:id/suspend', requireEmployer, trainingController.suspendTraining);

// Training analytics and management (employer only)
router.get('/:id/enrollments', requireEmployer, trainingController.getTrainingEnrollments);
router.get('/:id/analytics', requireEmployer, trainingController.getTrainingAnalytics);

// Training reviews (view for both user types)
router.get('/:id/reviews', requireEmployerOrJobseekerLocal, trainingController.getTrainingReviews);

// ==============================================
// CATCH-ALL ROUTES (MUST BE LAST)
// ==============================================

// Training details (accessible by both employers and jobseekers) - MUST BE LAST
router.get('/:id', requireEmployerOrJobseekerLocal, trainingController.getTrainingById);

export default router;