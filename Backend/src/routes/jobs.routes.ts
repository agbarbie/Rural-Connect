// src/routes/job.routes.ts
import { Router } from 'express';
import { PostJobsController } from '../controllers/postjobs.controller';
import { 
  authenticateToken, 
  requireEmployer, 
  requireEmployerWithId,
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

// Middleware logging
router.use((req, res, next) => {
  console.log(`Job routes - ${req.method} ${req.url}`);
  console.log('User from auth:', req.user ? 'Authenticated' : 'Not authenticated');
  next();
});

// Job creation route - requires employer with ID populated
router.post('/', requireEmployerWithId, postJobsController.createJob.bind(postJobsController));

// Routes that need employer authentication but don't need employer_id populated
router.get('/my-jobs', authenticateToken, requireEmployer, postJobsController.getMyJobs.bind(postJobsController));
router.get('/stats', authenticateToken, requireEmployer, postJobsController.getJobStats.bind(postJobsController));

// Routes that need employer authentication and employer_id for ownership checks
router.get('/:jobId', requireEmployerWithId, postJobsController.getJobById.bind(postJobsController));
router.put('/:jobId', requireEmployerWithId, postJobsController.updateJob.bind(postJobsController));
router.delete('/:jobId', requireEmployerWithId, postJobsController.deleteJob.bind(postJobsController));
router.get('/:jobId/views', requireEmployerWithId, postJobsController.getJobViews.bind(postJobsController));
router.patch('/:jobId/toggle-status', requireEmployerWithId, postJobsController.toggleJobStatus.bind(postJobsController));
router.patch('/:jobId/mark-filled', requireEmployerWithId, postJobsController.markJobAsFilled.bind(postJobsController));
router.post('/:jobId/duplicate', requireEmployerWithId, postJobsController.duplicateJob.bind(postJobsController));

export default router;