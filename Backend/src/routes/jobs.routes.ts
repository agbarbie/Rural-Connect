// src/routes/job.routes.ts
import { Router } from 'express';
import { Pool } from 'pg';
import { JobService } from '../services/job.service';
import { PostJobsController } from '../controllers/postjobs.controller';
import { requireEmployer } from '../middleware/auth.middleware';

const router = Router();

// Database connection
const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Initialize services and controllers
const jobService = new JobService(db);
const postJobsController = new PostJobsController(jobService);

// All routes require employer authentication
router.use(requireEmployer);

// Job management routes
router.post('/', postJobsController.createJob.bind(postJobsController));
router.get('/my-jobs', postJobsController.getMyJobs.bind(postJobsController));
router.get('/stats', postJobsController.getJobStats.bind(postJobsController));
router.get('/:jobId', postJobsController.getJobById.bind(postJobsController));
router.put('/:jobId', postJobsController.updateJob.bind(postJobsController));
router.delete('/:jobId', postJobsController.deleteJob.bind(postJobsController));
router.get('/:jobId/views', postJobsController.getJobViews.bind(postJobsController));
router.patch('/:jobId/toggle-status', postJobsController.toggleJobStatus.bind(postJobsController));
router.patch('/:jobId/mark-filled', postJobsController.markJobAsFilled.bind(postJobsController));
router.post('/:jobId/duplicate', postJobsController.duplicateJob.bind(postJobsController));

export default router;