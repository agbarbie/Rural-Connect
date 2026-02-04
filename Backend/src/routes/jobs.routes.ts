// src/routes/jobs.routes.ts - FIXED VERSION
import { Router } from 'express';
import { PostJobsController } from '../controllers/postjobs.controller';
import { JobseekerJobController } from '../controllers/Jobseeker job.controller';
import { JobNotificationController } from '../controllers/job-notification.controller';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { authorize, requireEmployer, requireJobseeker } from '../middleware/role.middleware';
import { JobNotificationService } from '../services/job-notification.service';
import pool from '../db/db.config';

const router = Router();

// Initialize controllers
const postJobsController = new PostJobsController();
const jobseekerJobController = new JobseekerJobController();
const jobNotificationController = new JobNotificationController();

// ===================================================================
// NOTIFICATION ROUTES (Both Employer and Jobseeker)
// ===================================================================
router.get('/notifications', authenticate, jobNotificationController.getNotifications);
router.get('/notifications/unread-count', authenticate, jobNotificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', authenticate, jobNotificationController.markNotificationRead);
router.put('/notifications/mark-all-read', authenticate, jobNotificationController.markAllNotificationsRead);
router.delete('/notifications/:notificationId', authenticate, jobNotificationController.deleteNotification);

// ===================================================================
// IMPORTANT: /stats route MUST be before any :jobId routes
// ===================================================================
router.get('/stats', authenticate, requireEmployer, postJobsController.getJobStats.bind(postJobsController));

// ===================================================================
// JOB CREATION
// ===================================================================
router.post('/', authenticate, requireEmployer, postJobsController.createJob.bind(postJobsController));

// ===================================================================
// EMPLOYER ROUTES
// ===================================================================
router.get('/my-jobs', authenticate, requireEmployer, postJobsController.getMyJobs.bind(postJobsController));

router.post(
  '/employer/applications/:applicationId/status',
  authenticate,
  requireEmployer,
  postJobsController.updateApplicationStatus.bind(postJobsController)
);

// ===================================================================
// JOBSEEKER ROUTES - CRITICAL FIX: WITHDRAW BEFORE OTHER :jobId ROUTES
// ===================================================================
router.get('/jobseeker/recommended', authenticate, requireJobseeker, jobseekerJobController.getRecommendedJobs);
router.post('/jobseeker/bookmark/:jobId', authenticate, requireJobseeker, jobseekerJobController.saveJob);
router.delete('/jobseeker/bookmark/:jobId', authenticate, requireJobseeker, jobseekerJobController.unsaveJob);
router.get('/jobseeker/bookmarked', authenticate, requireJobseeker, jobseekerJobController.getSavedJobs);
router.post('/jobseeker/apply/:jobId', authenticate, requireJobseeker, jobseekerJobController.applyToJob);

// 🔥 CRITICAL FIX: This must be BEFORE the generic :jobId routes
router.delete(
  '/jobseeker/withdraw/:jobId',
  authenticate,
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

router.get('/jobseeker/applications', authenticate, requireJobseeker, jobseekerJobController.getAppliedJobs);
router.get('/jobseeker/application-status/:jobId', authenticate, requireJobseeker, jobseekerJobController.getApplicationStatus);
router.put('/jobseeker/application/:applicationId', authenticate, requireJobseeker, jobseekerJobController.updateApplication);
router.patch('/jobseeker/application/:applicationId/withdraw', authenticate, requireJobseeker, jobseekerJobController.withdrawApplication);
router.get('/jobseeker/stats', authenticate, requireJobseeker, jobseekerJobController.getJobseekerStats);

// ===================================================================
// EMPLOYER JOB MANAGEMENT (Must be after /stats)
// ===================================================================
router.get('/employer/:jobId', authenticate, requireEmployer, postJobsController.getJobById.bind(postJobsController));
router.put('/employer/:jobId', authenticate, requireEmployer, postJobsController.updateJob.bind(postJobsController));
router.delete('/employer/:jobId', authenticate, requireEmployer, postJobsController.deleteJob.bind(postJobsController));
router.get('/employer/:jobId/views', authenticate, requireEmployer, postJobsController.getJobViews.bind(postJobsController));
router.get('/employer/:jobId/applications', authenticate, requireEmployer, postJobsController.getJobApplications.bind(postJobsController));
router.patch('/employer/:jobId/toggle-status', authenticate, requireEmployer, postJobsController.toggleJobStatus.bind(postJobsController));
router.patch('/employer/:jobId/mark-filled', authenticate, requireEmployer, postJobsController.markJobAsFilled.bind(postJobsController));
router.post('/employer/:jobId/duplicate', authenticate, requireEmployer, postJobsController.duplicateJob.bind(postJobsController));

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