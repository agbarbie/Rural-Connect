import { Router } from "express";
import { RatingController } from "../controllers/rating.controller";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
const ratingController = new RatingController();

router.post(
  "/",
  authenticate,
  requireRole("employer"),
  ratingController.createRating.bind(ratingController),
);

router.put('/:ratingId', authenticate, requireRole('employer'), 
  ratingController.updateRating.bind(ratingController));

router.get(
  "/jobseeker/:jobseekerId",
  ratingController.getJobseekerRatings.bind(ratingController),
);

router.get(
  "/jobseeker/:jobseekerId/stats",
  ratingController.getJobseekerRatingStats.bind(ratingController),
);

console.log("✅ Rating routes registered");
export default router;
