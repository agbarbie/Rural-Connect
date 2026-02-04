
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// ============================================================================
// DIRECTORY SETUP - Ensure all upload directories exist
// ============================================================================

const uploadDirs = {
  cvs: path.join(__dirname, '../../uploads/cvs'),
  trainingThumbnails: path.join(__dirname, '../../uploads/training-thumbnails'),
  certificates: path.join(__dirname, '../../uploads/certificates')
};

// Create all directories if they don't exist
Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created upload directory: ${dir}`);
  }
});

// ============================================================================
// CV UPLOAD (for job applications)
// ============================================================================

// Configure storage for CVs
const cvStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDirs.cvs);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter for CVs (PDF, DOC, DOCX, TXT)
const cvFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
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

// Configure multer for CV uploads
export const uploadMiddleware = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Legacy export (for backward compatibility)
export const uploadCV = uploadMiddleware;

// ============================================================================
// TRAINING THUMBNAIL UPLOAD (for training posts)
// ============================================================================

// Configure storage for training thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDirs.trainingThumbnails);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `training-${uniqueSuffix}${ext}`);
  }
});

// File filter for images only (thumbnails)
const imageFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
  }
};

// Configure multer for training thumbnails
export const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size for images
  }
});

// ============================================================================
// CERTIFICATE DIRECTORY MANAGEMENT
// ============================================================================

/**
 * Ensure certificate directory exists and is writable
 * Called during certificate generation in training.service.ts
 */
export const ensureCertificateDirectory = (): string => {
  if (!fs.existsSync(uploadDirs.certificates)) {
    fs.mkdirSync(uploadDirs.certificates, { recursive: true });
  }
  return uploadDirs.certificates;
};

/**
 * Get certificate directory path
 */
export const getCertificateDirectory = (): string => {
  return uploadDirs.certificates;
};

/**
 * Clean up old certificate files (optional - for maintenance)
 * Can be called periodically to remove certificates older than X days
 */
export const cleanupOldCertificates = (daysOld: number = 90): void => {
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;

  fs.readdir(uploadDirs.certificates, (err, files) => {
    if (err) {
      console.error('Error reading certificate directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(uploadDirs.certificates, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Error getting file stats:', err);
          return;
        }

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('Error deleting old certificate:', err);
            } else {
              console.log('Deleted old certificate:', file);
            }
          });
        }
      });
    });
  });
};

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Middleware to clean up uploaded files on error
 * Prevents orphaned files when request processing fails
 */
export const cleanupUploadedFile = (req: Request, res: any, next: any): void => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    // If error occurred and a file was uploaded, delete it
    if (res.statusCode >= 400 && req.file) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up uploaded file due to error:', req.file.filename);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware to handle multer errors
 */
export const handleUploadError = (err: any, req: Request, res: any, next: any): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'File too large',
        details: err.field === 'thumbnail' 
          ? 'Maximum file size is 5MB for images'
          : 'Maximum file size is 10MB'
      });
      return;
    }
    
    res.status(400).json({
      success: false,
      message: 'File upload error',
      details: err.message
    });
    return;
  }
  
  if (err) {
    res.status(400).json({
      success: false,
      message: 'Upload failed',
      details: err.message
    });
    return;
  }
  
  next();
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the public URL for an uploaded file
 */
export const getFileUrl = (filename: string, type: 'cv' | 'thumbnail' | 'certificate'): string => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  const folderMap = {
    cv: 'cvs',
    thumbnail: 'training-thumbnails',
    certificate: 'certificates'
  };
  
  const folder = folderMap[type];
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

/**
 * Delete a file from the filesystem
 */
export const deleteFile = (filepath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(filepath, (err) => {
      if (err) {
        // File might not exist - that's okay
        if (err.code === 'ENOENT') {
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
};

/**
 * Delete a CV by filename
 */
export const deleteCV = async (filename: string): Promise<void> => {
  const filepath = path.join(uploadDirs.cvs, filename);
  await deleteFile(filepath);
};

/**
 * Delete a training thumbnail by filename
 */
export const deleteThumbnail = async (filename: string): Promise<void> => {
  const filepath = path.join(uploadDirs.trainingThumbnails, filename);
  await deleteFile(filepath);
};

/**
 * Delete a certificate by filename
 */
export const deleteCertificate = async (filename: string): Promise<void> => {
  const filepath = path.join(uploadDirs.certificates, filename);
  await deleteFile(filepath);
};

/**
 * Get file size in a human-readable format
 */
export const getFileSize = (filepath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.stat(filepath, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      
      const bytes = stats.size;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) {
        resolve('0 Bytes');
        return;
      }
      
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      const size = (bytes / Math.pow(1024, i)).toFixed(2);
      resolve(`${size} ${sizes[i]}`);
    });
  });
};

/**
 * Check if file exists
 */
export const fileExists = (filepath: string): Promise<boolean> => {
  return new Promise((resolve) => {
    fs.access(filepath, fs.constants.F_OK, (err) => {
      resolve(!err);
    });
  });
};