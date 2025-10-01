// src/routes/cv-builder.routes.ts
import { Router } from 'express';
import { cvBuilderController } from '../controllers/cv-builder.controller';
import { authenticateToken, requireJobseeker } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/cvs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for CV file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// All CV routes require authentication and jobseeker role
router.use(authenticateToken);
router.use(requireJobseeker);

/**
 * @route POST /api/cv/create
 * @desc Create a new CV
 * @access Private (Jobseeker only)
 */
router.post('/create', cvBuilderController.createCV);

/**
 * @route GET /api/cv/my-cvs
 * @desc Get all CVs for current user
 * @access Private (Jobseeker only)
 */
router.get('/my-cvs', cvBuilderController.getMyCVs);

/**
 * @route GET /api/cv/:id
 * @desc Get specific CV by ID
 * @access Private (Jobseeker only)
 */
router.get('/:id', cvBuilderController.getCVById);

/**
 * @route PUT /api/cv/:id
 * @desc Update CV
 * @access Private (Jobseeker only)
 */
router.put('/:id', cvBuilderController.updateCV);

/**
 * @route DELETE /api/cv/:id
 * @desc Delete CV
 * @access Private (Jobseeker only)
 */
router.delete('/:id', cvBuilderController.deleteCV);

/**
 * @route POST /api/cv/upload
 * @desc Upload and parse CV file
 * @access Private (Jobseeker only)
 */
router.post('/upload', upload.single('cvFile'), cvBuilderController.uploadCV);

/**
 * @route POST /api/cv/:id/draft
 * @desc Save CV as draft
 * @access Private (Jobseeker only)
 */
router.post('/:id/draft', cvBuilderController.saveAsDraft);

/**
 * @route POST /api/cv/:id/final
 * @desc Save CV as final
 * @access Private (Jobseeker only)
 */
router.post('/:id/final', cvBuilderController.saveAsFinal);

/**
 * @route GET /api/cv/:id/export/pdf
 * @desc Export CV to PDF
 * @access Private (Jobseeker only)
 */
router.get('/:id/export/pdf', cvBuilderController.exportToPDF);

/**
 * @route POST /api/cv/:id/set-active
 * @desc Set CV as active/primary
 * @access Private (Jobseeker only)
 */
router.post('/:id/set-active', cvBuilderController.setActiveCV);

console.log('CV Builder routes registered');

export default router;