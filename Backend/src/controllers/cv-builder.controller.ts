// src/controllers/cv-builder.controller.ts
import { Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CVBuilderService } from '../services/cv-builder.service';
import { CVData, CVExportOptions } from '../types/cv.type';
import { validate as isValidUUID } from 'uuid';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export class CVBuilderController {
  private cvBuilderService: CVBuilderService;

  constructor() {
    this.cvBuilderService = new CVBuilderService();
  }

  // Upload profile image
  uploadProfileImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, message: 'No image file uploaded' });
        return;
      }

      const imageUrl = `/uploads/profile-images/${req.file.filename}`;

      res.status(200).json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: {
          imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error: any) {
      console.error('Upload profile image controller error:', error);
      next(error);
    }
  };

  // Create a new CV
  createCV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      // Validate user ID
      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      // Validate body
      const cvData: CVData = req.body;
      if (!cvData || Object.keys(cvData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'CV data is required'
        });
        return;
      }

      // Call service
      const createdCV = await this.cvBuilderService.createCV(userId, cvData);

      if (!createdCV) {
        res.status(500).json({
          success: false,
          message: 'CV could not be created'
        });
        return;
      }

      // Respond with created CV
      res.status(201).json({
        success: true,
        message: 'CV created successfully',
        data: createdCV
      });
    } catch (error) {
      console.error('Create CV error:', error);
      next(error);
    }
  };

  // Get all CVs for current user
  getMyCVs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      const cvs = await this.cvBuilderService.getUserCVs(userId);

      res.status(200).json({
        success: true,
        data: cvs,
        count: cvs.length
      });
    } catch (error) {
      console.error('Get my CVs error:', error);
      next(error);
    }
  };

  // Get specific CV by ID
  getCVById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const cv = await this.cvBuilderService.getCVById(cvId, userId);

      if (!cv) {
        res.status(404).json({
          success: false,
          message: 'CV not found or access denied'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: cv
      });
    } catch (error) {
      console.error('Get CV by ID error:', error);
      next(error);
    }
  };

  // Update CV
  updateCV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const cvData: CVData = req.body;

      const result = await this.cvBuilderService.updateCV(cvId, userId, cvData);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'CV not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'CV updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Update CV error:', error);
      next(error);
    }
  };

  // Delete CV
  deleteCV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const result = await this.cvBuilderService.deleteCV(cvId, userId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'CV not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'CV deleted successfully'
      });
    } catch (error) {
      console.error('Delete CV error:', error);
      next(error);
    }
  };

  // Upload and parse CV file
  uploadCV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const result = await this.cvBuilderService.parseAndCreateCV(
        userId,
        req.file.path,
        req.file.originalname,
        req.file.mimetype
      );

      // parseAndCreateCV should return a CV object
      res.status(201).json({
        success: true,
        message: 'CV uploaded and parsed successfully',
        data: result
      });
    } catch (error) {
      console.error('Upload CV error:', error);
      next(error);
    }
  };

  // Save CV as draft
  saveAsDraft = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const result = await this.cvBuilderService.updateCVStatus(cvId, userId, 'draft');

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'CV not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'CV saved as draft',
        data: result
      });
    } catch (error) {
      console.error('Save as draft error:', error);
      next(error);
    }
  };

  // Save CV as final
  saveAsFinal = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const result = await this.cvBuilderService.updateCVStatus(cvId, userId, 'final');

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'CV not found'
        });
        return;
      }

      // Update user's active CV
      await this.cvBuilderService.setActiveCV(userId, cvId);

      res.status(200).json({
        success: true,
        message: 'CV saved as final',
        data: result
      });
    } catch (error) {
      console.error('Save as final error:', error);
      next(error);
    }
  };

  // Export CV to PDF
  exportToPDF = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({ success: false, message: 'Invalid or missing user ID' });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({ success: false, message: 'Invalid CV ID' });
        return;
      }

      const pdfBuffer = await this.cvBuilderService.exportToPDF(cvId, userId);

      if (!pdfBuffer) {
        res.status(404).json({ success: false, message: 'CV not found or export failed' });
        return;
      }

      // Get CV to generate filename
      const cv = await this.cvBuilderService.getCVById(cvId, userId);
      const fullName = cv?.cv_data?.personal_info?.full_name || 'CV';
      const filename = `${fullName}_${Date.now()}.pdf`
        .replace(/\s+/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export to PDF error:', error);
      next(error);
    }
  };

  // Export CV to Word
  exportToWord = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({ success: false, message: 'Invalid or missing user ID' });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({ success: false, message: 'Invalid CV ID' });
        return;
      }

      const docBuffer = await this.cvBuilderService.exportToWord(cvId, userId);

      if (!docBuffer) {
        res.status(404).json({ success: false, message: 'CV not found or export failed' });
        return;
      }

      const cv = await this.cvBuilderService.getCVById(cvId, userId);
      const filename = `${cv?.cv_data?.personal_info?.full_name || 'CV'}_${Date.now()}.docx`
        .replace(/\s+/g, '_');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', docBuffer.length.toString());
      res.send(docBuffer);
    } catch (error) {
      console.error('Export to Word error:', error);
      next(error);
    }
  };

  // Set active CV
  setActiveCV = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const cvId = req.params.id;

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      if (!cvId || !isValidUUID(cvId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CV ID'
        });
        return;
      }

      const result = await this.cvBuilderService.setActiveCV(userId, cvId);

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Failed to set active CV'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'CV set as active successfully'
      });
    } catch (error) {
      console.error('Set active CV error:', error);
      next(error);
    }
  };
}

export const cvBuilderController = new CVBuilderController();