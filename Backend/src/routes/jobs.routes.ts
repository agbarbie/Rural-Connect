// src/routes/job.routes.ts - COMPLETE FILE WITH NOTIFICATIONS
import { Router } from 'express';
import { PostJobsController } from '../controllers/postjobs.controller';
import { JobseekerJobController } from '../controllers/Jobseeker job.controller';
import { JobNotificationController } from '../controllers/job-notification.controller';
import {
   authenticateToken,
   requireEmployer,
   requireJobseeker,
   AuthenticatedRequest
} from '../middleware/auth.middleware';

const router = Router();

// Initialize controllers
const postJobsController = new PostJobsController();
const jobseekerJobController = new JobseekerJobController();
const jobNotificationController = new JobNotificationController();

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

// 🔥 NEW ROUTE ADDED HERE
// ===============================================================
// Employer updates application status (reviewed, shortlisted, etc.)
// ===============================================================
router.post(
  '/employer/applications/:applicationId/status',
  authenticateToken,
  requireEmployer,
  postJobsController.updateApplicationStatus.bind(postJobsController)
);

// ===================================================================
// JOBSEEKER ROUTES
// ===================================================================
router.get('/jobseeker/recommended', authenticateToken, requireJobseeker, jobseekerJobController.getRecommendedJobs);
router.post('/jobseeker/bookmark/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.saveJob);
router.delete('/jobseeker/bookmark/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.unsaveJob);
router.get('/jobseeker/bookmarked', authenticateToken, requireJobseeker, jobseekerJobController.getSavedJobs);
router.post('/jobseeker/apply/:jobId', authenticateToken, requireJobseeker, jobseekerJobController.applyToJob);
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
router.get('/details/:jobId', optionalAuth, jobseekerJobController.getJobDetails);
router.get('/', optionalAuth, jobseekerJobController.getAllJobs);

// TEMP DEBUG: POST /api/jobs/debug/test-notification (protected)
router.post('/debug/test-notification', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Import service dynamically
    const { JobNotificationService } = await import('../services/job-notification.service');
    const notificationService = new JobNotificationService();

    // Create test notification based on user type
    let type, message, metadata;
    if (authReq.user?.user_type === 'jobseeker') {
      type = 'application_reviewed';
      message = 'Your application for Frontend Developer has been reviewed!';
      metadata = {
        job_id: 'test-123',
        job_title: 'Frontend Developer',
        company_name: 'TechCorp',
        application_id: 'test-app-456',
        status: 'reviewed'
      };
    } else {
      type = 'application_received';
      message = 'Alice Test applied for Frontend Developer!';
      metadata = {
        job_id: 'test-123',
        job_title: 'Frontend Developer',
        applicant_name: 'Alice Test',
        application_id: 'test-app-456'
      };
    }

    await notificationService.createNotification(userId, type, message, metadata);
    return res.json({ success: true, message: `Test ${type} notification created for user ${userId}` });
  } catch (error) {
    console.error('Debug notification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create test notification' });
  }
});
export default router;
