import { Router } from 'express';
import { RatingController } from '../controllers/rating.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const ratingController = new RatingController();

router.post('/', authenticateToken, requireRole('employer'), 
  ratingController.createRating.bind(ratingController));

router.get('/jobseeker/:jobseekerId', 
  ratingController.getJobseekerRatings.bind(ratingController));

router.get('/jobseeker/:jobseekerId/stats', 
  ratingController.getJobseekerRatingStats.bind(ratingController));

console.log('✅ Rating routes registered');
export default router;