import { Router } from "express";
import { RatingController } from "../controllers/rating.controller";
import { authenticate, requireRole } from "../middleware/auth.middleware"; // ✅ Fixed import

const router = Router();
const ratingController = new RatingController();

// Create rating - requires employer authentication
router.post(
  "/",
  authenticate,
  requireRole("employer"),
  ratingController.createRating.bind(ratingController),
);

// Update rating - requires employer authentication
router.put(
  '/:ratingId', 
  authenticate, 
  requireRole('employer'), 
  ratingController.updateRating.bind(ratingController)
);

// Get jobseeker ratings - public endpoint (no auth required)
router.get(
  "/jobseeker/:jobseekerId",
  ratingController.getJobseekerRatings.bind(ratingController),
);

// Get jobseeker rating stats - public endpoint (no auth required)
router.get(
  "/jobseeker/:jobseekerId/stats",
  ratingController.getJobseekerRatingStats.bind(ratingController),
);

console.log("✅ Rating routes registered");
export default router;