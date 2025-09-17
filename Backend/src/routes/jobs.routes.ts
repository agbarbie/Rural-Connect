// src/routes/job.routes.ts
import { Router } from 'express';
import { PostJobsController } from '../controllers/postjobs.controller';
import { JobseekerJobController } from '../controllers/Jobseeker job.controller'; // Fixed import
import {
   authenticateToken,
   requireEmployer,
   requireEmployerWithId,
   requireJobseeker,
   optionalAuth,
   AuthenticatedRequest
} from '../middleware/auth.middleware';

// Extend Express Request type to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = Router();

// Initialize controllers
const postJobsController = new PostJobsController();
const jobseekerJobController = new JobseekerJobController();

// Middleware logging
router.use((req, res, next) => {
  console.log(`Job routes - ${req.method} ${req.url}`);
  console.log('User from auth:', req.user ? 'Authenticated' : 'Not authenticated');
  next();
});

// ==============================================
// PUBLIC & JOBSEEKER ROUTES
// ==============================================

// Public route - get all jobs with optional filters (for job explorer)
router.get('/', optionalAuth, jobseekerJobController.getAllJobs);

// Public route - get specific job details
router.get('/details/:jobId', optionalAuth, jobseekerJobController.getJobDetails);

// Jobseeker-specific routes (require authentication)
router.use('/jobseeker', authenticateToken, requireJobseeker);

// Get recommended jobs for jobseeker
router.get('/jobseeker/recommended', jobseekerJobController.getRecommendedJobs);

// Job bookmarking (save/unsave)
router.post('/jobseeker/bookmark/:jobId', jobseekerJobController.saveJob);
router.delete('/jobseeker/bookmark/:jobId', jobseekerJobController.unsaveJob);

// Get saved/bookmarked jobs
router.get('/jobseeker/bookmarked', jobseekerJobController.getSavedJobs);

// Job applications
router.post('/jobseeker/apply/:jobId', jobseekerJobController.applyToJob);
router.get('/jobseeker/applications', jobseekerJobController.getAppliedJobs);


// Get application status for a specific job
router.get('/jobseeker/application-status/:jobId', jobseekerJobController.getApplicationStatus);

// Update/manage applications
router.put('/jobseeker/application/:applicationId', jobseekerJobController.updateApplication);
router.patch('/jobseeker/application/:applicationId/withdraw', jobseekerJobController.withdrawApplication);

// Get jobseeker's statistics and dashboard data
router.get('/jobseeker/stats', jobseekerJobController.getJobseekerStats);

// ==============================================
// EMPLOYER ROUTES
// ==============================================

// Job creation route - requires employer with ID populated
router.post('/', requireEmployerWithId, postJobsController.createJob.bind(postJobsController));

// Routes that need employer authentication but don't need employer_id populated
router.get('/my-jobs', authenticateToken, requireEmployer, postJobsController.getMyJobs.bind(postJobsController));
router.get('/employer/stats', authenticateToken, requireEmployer, postJobsController.getJobStats.bind(postJobsController));

// Routes that need employer authentication and employer_id for ownership checks
router.get('/employer/:jobId', requireEmployerWithId, postJobsController.getJobById.bind(postJobsController));
router.put('/employer/:jobId', requireEmployerWithId, postJobsController.updateJob.bind(postJobsController));
router.delete('/employer/:jobId', requireEmployerWithId, postJobsController.deleteJob.bind(postJobsController));
router.get('/employer/:jobId/views', requireEmployerWithId, postJobsController.getJobViews.bind(postJobsController));
router.patch('/employer/:jobId/toggle-status', requireEmployerWithId, postJobsController.toggleJobStatus.bind(postJobsController));
router.patch('/employer/:jobId/mark-filled', requireEmployerWithId, postJobsController.markJobAsFilled.bind(postJobsController));
router.post('/employer/:jobId/duplicate', requireEmployerWithId, postJobsController.duplicateJob.bind(postJobsController));

// Get job applications (for employers)
router.get('/employer/:jobId/applications', requireEmployerWithId, postJobsController.getJobApplications.bind(postJobsController));

export default router;