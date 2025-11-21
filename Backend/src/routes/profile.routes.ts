// src/routes/profile.routes.ts
import { Router } from "express";
import profileController from "../controllers/profile.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

/**
 * @route   GET /api/profile
 * @desc    Get current user's profile
 * @access  Private (Jobseeker)
 */
router.get(
  "/",
  authenticate,
  authorize("jobseeker"),
  profileController.getMyProfile.bind(profileController)
);

/**
 * @route   PATCH /api/profile
 * @desc    Update current user's profile
 * @access  Private (Jobseeker)
 */
router.patch(
  "/",
  authenticate,
  authorize("jobseeker"),
  profileController.updateMyProfile.bind(profileController)
);

/**
 * @route   GET /api/profile/cv/:cvId
 * @desc    Get profile by specific CV ID
 * @access  Private (Jobseeker)
 */
router.get(
  "/cv/:cvId",
  authenticate,
  authorize("jobseeker"),
  profileController.getProfileByCVId.bind(profileController)
);

/**
 * @route   GET /api/profile/completion
 * @desc    Get profile completion status
 * @access  Private (Jobseeker)
 */
router.get(
  "/completion",
  authenticate,
  authorize("jobseeker"),
  profileController.getProfileCompletion.bind(profileController)
);

/**
 * @route   PUT /api/profile/picture
 * @desc    Update profile picture
 * @access  Private (Jobseeker)
 */
router.put(
  "/picture",
  authenticate,
  authorize("jobseeker"),
  profileController.updateProfilePicture.bind(profileController)
);

/**
 * @route   POST /api/profile/share
 * @desc    Generate shareable profile link
 * @access  Private (Jobseeker)
 */
router.post(
  "/share",
  authenticate,
  authorize("jobseeker"),
  profileController.shareProfile.bind(profileController)
);

/**
 * @route   GET /api/profile/shared/:token
 * @desc    Get shared profile (public access)
 * @access  Public
 */
router.get(
  "/shared/:token",
  profileController.getSharedProfile.bind(profileController)
);

export default router;