// src/routes/jobs.routes.ts - FIXED VERSION
import { Router } from 'express';
import { PostJobsController } from '../controllers/postjobs.controller';
import { JobseekerJobController } from '../controllers/Jobseeker job.controller';
import { JobNotificationController } from '../controllers/job-notification.controller';
import {
   authenticateToken,
   requireEmployer,
   requireJobseeker,
   AuthenticatedRequest,
   authenticate
} from '../middleware/auth.middleware';
import { JobNotificationService } from '../services/job-notification.service';
import pool from '../db/db.config';
import { authorize } from '../middleware/role.middleware';

const router = Router();

// Initialize controllers
const postJobsController = new PostJobsController();
const jobseekerJobController = new JobseekerJobController();
const jobNotificationController = new JobNotificationController();

// ===================================================================
// NOTIFICATION ROUTES (Both Employer and Jobseeker)
// ===================================================================
router.get('/notifications', authenticateToken, jobNotificationController.getNotifications);
router.get('/notifications/unread-count', authenticateToken, jobNotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', authenticateToken, jobNotificationController.markNotificationRead);
router.put('/notifications/mark-all-read', authenticateToken, jobNotificationController.markAllNotificationsRead);
router.delete('/notifications/:notificationId', authenticateToken, jobNotificationController.deleteNotification);

// ===================================================================
// IMPORTANT: /stats route MUST be before any :jobId routes
// ===================================================================
router.get('/stats', authenticateToken, requireEmployer, postJobsController.getJobStats.bind(postJobsController));

// ===================================================================
// JOB CREATION
// ===================================================================
router.post('/', authenticateToken, requireEmployer, postJobsController.createJob.bind(postJobsController));

// ===================================================================
// EMPLOYER ROUTES
// ===================================================================
router.get('/my-jobs', authenticateToken, requireEmployer, postJobsController.getMyJobs.bind(postJobsController));

router.post(
  '/employer/applications/:applicationId/status',
  authenticateToken,
  requireEmployer,
  postJobsController.updateApplicationStatus.bind(postJobsController)
);

// ===================================================================
// JOBSEEKER ROUTES - CRITICAL FIX: WITHDRAW BEFORE OTHER :jobId ROUTES
// ===================================================================
router.get('/jobseeker/recommended', authenticateToken, requireJobseeker, jobseekerJobController.getRecommendedJobs);
router.post('/jobseeker/bookmark/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.saveJob);
router.delete('/jobseeker/bookmark/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.unsaveJob);
router.get('/jobseeker/bookmarked', authenticateToken, requireJobseeker, jobseekerJobController.getSavedJobs);
router.post('/jobseeker/apply/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.applyToJob);

// 🔥 CRITICAL FIX: This must be BEFORE the generic :jobId routes
router.delete(
  '/jobseeker/withdraw/:jobId',
  authenticateToken,
  requireJobseeker,
  async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      console.log('🔥 WITHDRAW ROUTE HIT - Job ID:', jobId, 'User ID:', userId);

      // Validate UUID
      const { validate: isValidUUID } = await import('uuid');
      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      // Call service method
      const result = await jobseekerJobController['jobseekerJobService'].withdrawApplicationByJob(userId, jobId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully'
      });
    } catch (error: any) {
      console.error('❌ WITHDRAW ROUTE ERROR:', error);
      next(error);
    }
  }
);

router.get('/jobseeker/applications', authenticateToken, requireJobseeker, jobseekerJobController.getAppliedJobs);
router.get('/jobseeker/application-status/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.getApplicationStatus);
router.put('/jobseeker/application/:applicationId', authenticateToken, requireJobseeker, jobseekerJobController.updateApplication);
router.patch('/jobseeker/application/:applicationId/withdraw', authenticateToken, requireJobseeker, jobseekerJobController.withdrawApplication);
router.get('/jobseeker/stats', authenticateToken, requireJobseeker, jobseekerJobController.getJobseekerStats);

// ===================================================================
// EMPLOYER JOB MANAGEMENT (Must be after /stats)
// ===================================================================
router.get('/employer/:jobId', authenticateToken, requireEmployer, postJobsController.getJobById.bind(postJobsController));
router.put('/employer/:jobId', authenticateToken, requireEmployer, postJobsController.updateJob.bind(postJobsController));
router.delete('/employer/:jobId', authenticateToken, requireEmployer, postJobsController.deleteJob.bind(postJobsController));
router.get('/employer/:jobId/views', authenticateToken, requireEmployer, postJobsController.getJobViews.bind(postJobsController));
router.get('/employer/:jobId/applications', authenticateToken, requireEmployer, postJobsController.getJobApplications.bind(postJobsController));
router.patch('/employer/:jobId/toggle-status', authenticateToken, requireEmployer, postJobsController.toggleJobStatus.bind(postJobsController));
router.patch('/employer/:jobId/mark-filled', authenticateToken, requireEmployer, postJobsController.markJobAsFilled.bind(postJobsController));
router.post('/employer/:jobId/duplicate', authenticateToken, requireEmployer, postJobsController.duplicateJob.bind(postJobsController));

// ===================================================================
// PUBLIC ROUTES (MUST BE LAST)
// ===================================================================
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

router.get('/details/:jobId', optionalAuth, jobseekerJobController.getJobDetails);
router.get('/', optionalAuth, jobseekerJobController.getAllJobs);

export default router;