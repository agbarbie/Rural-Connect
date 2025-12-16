// src/routes/cv-builder.routes.ts - FIXED VERSION
import { Router } from 'express';
import { cvBuilderController } from '../controllers/cv-builder.controller';
import { authenticateToken, requireJobseeker } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure upload directories exist
const cvUploadDir = path.join(__dirname, '../../uploads/cvs');
const profileImageDir = path.join(__dirname, '../../uploads/profile-images');

[cvUploadDir, profileImageDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Configure multer for CV file uploads
const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, cvUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// Configure multer for profile image uploads
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileImageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

// File filters
const cvFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
  }
};

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Multer upload instances
const uploadCV = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

const uploadProfileImage = multer({
  storage: profileImageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
});

// All routes require authentication
router.use(authenticateToken);
router.use(requireJobseeker);

/**
 * @route POST /api/cv/create
 * @desc Create a new CV
 * @access Private (Jobseeker)
 */
router.post('/create', cvBuilderController.createCV);

/**
 * @route GET /api/cv/my-cvs
 * @desc Get all CVs for current user
 * @access Private (Jobseeker)
 */
router.get('/my-cvs', cvBuilderController.getMyCVs);

/**
 * @route GET /api/cv/:id
 * @desc Get specific CV by ID
 * @access Private (Jobseeker)
 */
router.get('/:id', cvBuilderController.getCVById);

/**
 * @route PUT /api/cv/:id
 * @desc Update CV
 * @access Private (Jobseeker)
 */
router.put('/:id', cvBuilderController.updateCV);

/**
 * @route DELETE /api/cv/:id
 * @desc Delete CV
 * @access Private (Jobseeker)
 */
router.delete('/:id', cvBuilderController.deleteCV);

/**
 * @route POST /api/cv/upload
 * @desc Upload and parse CV file
 * @access Private (Jobseeker)
 * FIXED: Single middleware call with proper error handling
 */
router.post('/upload', (req, res, next) => {
  console.log('📤 CV Upload request received');
  
  const uploadHandler = uploadCV.single('cv');
  
  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'File size exceeds 10MB limit'
          });
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          res.status(400).json({
            success: false,
            message: 'Unexpected field name. Expected "cv" field.'
          });
          return;
        }
      }
      
      // Other errors (like file type)
      res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
      });
      return;
    }
    
    // Check if file was uploaded
    if (!req.file) {
      console.error('❌ No file in request');
      res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a file.'
      });
      return;
    }
    
    console.log('✅ File uploaded:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    // Pass to controller
    cvBuilderController.uploadCV(req as any, res, next);
  });
});

/**
 * @route POST /api/cv/upload-profile-image
 * @desc Upload profile image for CV
 * @access Private (Jobseeker)
 */
router.post(
  '/upload-profile-image',
  uploadProfileImage.single('profileImage'),
  (req, res, next) => {
    console.log('📸 Profile image upload request');
    
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
      return;
    }
    
    console.log('✅ Image uploaded:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    });
    
    cvBuilderController.uploadProfileImage(req as any, res, next);
  }
);

/**
 * @route POST /api/cv/:id/draft
 * @desc Save CV as draft
 * @access Private (Jobseeker)
 */
router.post('/:id/draft', cvBuilderController.saveAsDraft);

/**
 * @route POST /api/cv/:id/final
 * @desc Save CV as final
 * @access Private (Jobseeker)
 */
router.post('/:id/final', cvBuilderController.saveAsFinal);

/**
 * @route GET /api/cv/:id/export/pdf
 * @desc Export CV to PDF
 * @access Private (Jobseeker)
 */
router.get('/:id/export/pdf', cvBuilderController.exportToPDF);

/**
 * @route GET /api/cv/:id/export/docx
 * @desc Export CV to Word
 * @access Private (Jobseeker)
 */
router.get('/:id/export/docx', cvBuilderController.exportToWord);

/**
 * @route POST /api/cv/:id/set-active
 * @desc Set CV as active/primary
 * @access Private (Jobseeker)
 */
router.post('/:id/set-active', cvBuilderController.setActiveCV);

console.log('✅ CV Builder routes registered');

export default router;