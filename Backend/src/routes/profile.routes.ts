// src/routes/profile.routes.ts - Fixed version
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import profileController from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { isJobseeker } from '../middleware/role.middleware';

const router = Router();

// Configure multer for image uploads
const uploadDir = path.join(__dirname, '../../uploads/profiles');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads/profiles directory');
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP)'));
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

/**
 * @route   GET /api/profile
 * @desc    Get current user's profile
 * @access  Private (Jobseeker)
 */
router.get(
  '/',
  authenticateToken,
  isJobseeker,
  profileController.getMyProfile.bind(profileController)
);

/**
 * @route   PATCH /api/profile
 * @desc    Update current user's profile
 * @access  Private (Jobseeker)
 */
router.patch(
  '/',
  authenticateToken,
  isJobseeker,
  profileController.updateMyProfile.bind(profileController)
);

/**
 * @route   POST /api/profile/upload-image
 * @desc    Upload profile image
 * @access  Private (Jobseeker)
 */
router.post(
  '/upload-image',
  authenticateToken,
  isJobseeker,
  upload.single('image'),
  profileController.uploadProfileImage.bind(profileController)
);

/**
 * @route   GET /api/profile/cv/:cvId
 * @desc    Get profile by specific CV ID
 * @access  Private (Jobseeker)
 */
router.get(
  '/cv/:cvId',
  authenticateToken,
  isJobseeker,
  profileController.getProfileByCVId.bind(profileController)
);

/**
 * @route   GET /api/profile/completion
 * @desc    Get profile completion status
 * @access  Private (Jobseeker)
 */
router.get(
  '/completion',
  authenticateToken,
  isJobseeker,
  profileController.getProfileCompletion.bind(profileController)
);

/**
 * @route   PUT /api/profile/picture
 * @desc    Update profile picture (legacy endpoint)
 * @access  Private (Jobseeker)
 */
router.put(
  '/picture',
  authenticateToken,
  isJobseeker,
  profileController.updateProfilePicture.bind(profileController)
);

/**
 * @route   POST /api/profile/share
 * @desc    Generate shareable profile link
 * @access  Private (Jobseeker)
 */
router.post(
  '/share',
  authenticateToken,
  isJobseeker,
  profileController.shareProfile.bind(profileController)
);

/**
 * @route   GET /api/profile/shared/:token
 * @desc    Get shared profile (public access)
 * @access  Public
 */
router.get(
  '/shared/:token',
  profileController.getSharedProfile.bind(profileController)
);

console.log('✅ Profile routes registered');

export default router;