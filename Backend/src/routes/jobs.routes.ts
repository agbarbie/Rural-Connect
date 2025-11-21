// src/routes/job.routes.ts - COMPLETE FILE WITH NOTIFICATIONS & TEST ENDPOINT
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
import pool from '../db/db.config';

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
// 🧪 TEST NOTIFICATION ENDPOINT - CRITICAL FOR DEBUGGING
// ===================================================================
router.post('/test-notification', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const userType = req.user.user_type;
    
    console.log('🧪 ========================================');
    console.log('🧪 TEST NOTIFICATION REQUEST');
    console.log('🧪 User ID:', userId);
    console.log('🧪 User Type:', userType);
    console.log('🧪 User Email:', req.user.email);
    console.log('🧪 ========================================');
    
    const notificationService = new JobNotificationService();
    
    if (userType === 'employer') {
      // EMPLOYER: Simulate receiving a job application
      const testMetadata = {
        job_id: 'test-job-' + Date.now(),
        job_title: 'Senior Software Engineer',
        applicant_name: 'John Doe',
        application_id: 'test-app-' + Date.now(),
        action: 'new_application',
        timestamp: new Date().toISOString()
      };
      
      console.log('📬 Creating application_received notification for EMPLOYER');
      console.log('📬 Metadata:', testMetadata);
      
      // Create notification
      await notificationService.createNotification(
        userId,
        'application_received',
        'TEST: John Doe applied for Senior Software Engineer',
        testMetadata
      );
      
      // Verify notification was created in database
      const verifyQuery = await pool.query(
        `SELECT 
          id, user_id, type, title, message, read, created_at 
         FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      console.log('✅ Verification query result:', verifyQuery.rows[0]);
      
      // Get all notifications for this user
      const allNotifications = await pool.query(
        `SELECT COUNT(*) as total, 
                COUNT(CASE WHEN read = false THEN 1 END) as unread
         FROM notifications 
         WHERE user_id = $1`,
        [userId]
      );
      
      res.json({
        success: true,
        message: '✅ Test notification created for EMPLOYER',
        testData: {
          userId,
          userType,
          email: req.user.email,
          notificationType: 'application_received'
        },
        createdNotification: verifyQuery.rows[0] || null,
        verificationStatus: verifyQuery.rows.length > 0 ? '✅ FOUND IN DATABASE' : '❌ NOT FOUND IN DATABASE',
        userStats: {
          totalNotifications: parseInt(allNotifications.rows[0].total),
          unreadNotifications: parseInt(allNotifications.rows[0].unread)
        },
        nextSteps: [
          '1. Go to your employer dashboard',
          '2. Check the notifications bell icon',
          '3. You should see the test notification',
          '4. If not visible, check browser console for errors'
        ]
      });
      
    } else if (userType === 'jobseeker') {
      // JOBSEEKER: Simulate being shortlisted for a job
      const testMetadata = {
        job_id: 'test-job-' + Date.now(),
        job_title: 'Frontend Developer',
        company_name: 'TechCorp',
        application_id: 'test-app-' + Date.now(),
        status: 'shortlisted',
        action: 'status_change',
        timestamp: new Date().toISOString()
      };
      
      console.log('📬 Creating application_shortlisted notification for JOBSEEKER');
      
      await notificationService.createNotification(
        userId,
        'application_shortlisted',
        'TEST: You\'ve been shortlisted for Frontend Developer at TechCorp',
        testMetadata
      );
      
      // Verify notification
      const verifyQuery = await pool.query(
        `SELECT id, user_id, type, title, message, read, created_at 
         FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );
      
      res.json({
        success: true,
        message: '✅ Test notification created for JOBSEEKER',
        testData: {
          userId,
          userType,
          email: req.user.email,
          notificationType: 'application_shortlisted'
        },
        createdNotification: verifyQuery.rows[0] || null,
        verificationStatus: verifyQuery.rows.length > 0 ? '✅ FOUND IN DATABASE' : '❌ NOT FOUND IN DATABASE',
        nextSteps: [
          '1. Go to your jobseeker dashboard',
          '2. Check the notifications bell icon',
          '3. You should see the test notification'
        ]
      });
      
    } else {
      res.json({
        success: false,
        message: '❌ Unknown user type',
        userId,
        userType,
        error: 'User must be either "employer" or "jobseeker"'
      });
    }
  } catch (error: any) {
    console.error('❌ ❌ ❌ TEST NOTIFICATION ERROR:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      errorDetails: {
        code: error.code,
        detail: error.detail
      },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===================================================================
// 🔍 DEBUG ENDPOINT - Check notification configuration
// ===================================================================
router.get('/debug-notifications', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const userType = req.user.user_type;
    
    console.log('🔍 DEBUG: Checking notification setup for user:', userId);
    
    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, email, user_type, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    
    // Check if employer record exists (if user is employer)
    let employerCheck = null;
    if (userType === 'employer') {
      employerCheck = await pool.query(
        `SELECT e.id, e.user_id, e.company_id, c.name as company_name 
         FROM employers e 
         LEFT JOIN companies c ON e.company_id = c.id 
         WHERE e.user_id = $1`,
        [userId]
      );
    }
    
    // Get all notifications for this user
    const notificationsCheck = await pool.query(
      `SELECT id, type, title, read, created_at 
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId]
    );
    
    // Get notification counts by type
    const notificationStats = await pool.query(
      `SELECT type, COUNT(*) as count, 
              COUNT(CASE WHEN read = false THEN 1 END) as unread_count
       FROM notifications 
       WHERE user_id = $1 
       GROUP BY type`,
      [userId]
    );
    
    res.json({
      success: true,
      debug: {
        user: userCheck.rows[0] || null,
        userExists: userCheck.rows.length > 0,
        employerRecord: employerCheck?.rows[0] || null,
        recentNotifications: notificationsCheck.rows,
        notificationStats: notificationStats.rows,
        totalNotifications: notificationsCheck.rows.length,
        allowedNotificationTypes: userType === 'employer' 
          ? ['application_received', 'job_updated', 'job_deleted', 'job_closed', 'job_filled']
          : ['new_job', 'job_updated', 'job_deleted', 'job_closed', 'job_filled', 
             'application_reviewed', 'application_shortlisted', 'application_rejected', 
             'application_accepted', 'interview_scheduled']
      }
    });
    
  } catch (error: any) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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

export default router;