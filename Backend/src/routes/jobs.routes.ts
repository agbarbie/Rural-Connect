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
import { JobNotificationService } from '../services/job-notification.service';

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

router.post('/test-job-application-notification', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const userType = req.user.user_type;
    
    const notificationService = new JobNotificationService();
    
    if (userType === 'employer') {
      // Create realistic job application notification
      await notificationService.createNotification(
        userId,
        'application_received',
        'John Smith applied for Senior Software Engineer position',
        {
          job_id: 'test-job-' + Date.now(),
          job_title: 'Senior Software Engineer',
          applicant_name: 'John Smith',
          application_id: 'test-app-' + Date.now(),
          action: 'new_application',
          timestamp: new Date().toISOString()
        }
      );
      
      res.json({ 
        success: true, 
        message: '✅ Job application notification created for employer',
        userId,
        userType,
        notificationType: 'application_received'
      });
    } else if (userType === 'jobseeker') {
      // Create realistic application status notification
      await notificationService.createNotification(
        userId,
        'application_shortlisted',
        'Congratulations! You\'ve been shortlisted for Frontend Developer at TechCorp',
        {
          job_id: 'test-job-' + Date.now(),
          job_title: 'Frontend Developer',
          company_name: 'TechCorp',
          application_id: 'test-app-' + Date.now(),
          status: 'shortlisted',
          action: 'status_change',
          timestamp: new Date().toISOString()
        }
      );
      
      res.json({ 
        success: true, 
        message: '✅ Application status notification created for jobseeker',
        userId,
        userType,
        notificationType: 'application_shortlisted'
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Unknown user type',
        userId,
        userType 
      });
    }
  } catch (error: any) {
    console.error('Test notification error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


export default router;
