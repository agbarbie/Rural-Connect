// src/controllers/cv-builder.controller.ts - FIXED VERSION
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import CVBuilderService from '../services/cv-builder.service';
import { CVData } from '../types/cv.type';
import { validate as isValidUUID } from 'uuid';

export class CVBuilderController {

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

      if (!userId || !isValidUUID(userId)) {
        res.status(401).json({
          success: false,
          message: 'Invalid or missing user ID'
        });
        return;
      }

      const cvData: CVData = req.body;
      if (!cvData || Object.keys(cvData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'CV data is required'
        });
        return;
      }

      const createdCV = await CVBuilderService.createCV(userId, cvData);

      if (!createdCV) {
        res.status(500).json({
          success: false,
          message: 'CV could not be created'
        });
        return;
      }

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

      const cvs = await CVBuilderService.getUserCVs(userId);

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

      const cv = await CVBuilderService.getCVById(cvId, userId);

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

      const result = await CVBuilderService.updateCV(cvId, userId, cvData);

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

      const result = await CVBuilderService.deleteCV(cvId, userId);

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
    console.log('📤 CV Upload - Request received');
    
    // 1. Validate user authentication
    const userId = req.user?.id;
    if (!userId || !isValidUUID(userId)) {
      res.status(401).json({
        success: false,
        message: 'Invalid or missing user ID'
      });
      return;
    }

    console.log('✅ User authenticated:', userId);

    // 2. Validate file upload
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a CV file.'
      });
      return;
    }

    console.log('✅ File received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // 3. Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'
      });
      return;
    }

    // 4. Validate file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        message: 'File size exceeds 10MB limit'
      });
      return;
    }

    console.log('✅ File validation passed');

    // 5. Parse and create CV
    console.log('🔄 Starting CV parsing...');
    
    const result = await CVBuilderService.parseAndCreateCV(
      userId,
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    if (!result || !result.cv_data) {
      console.error('❌ CV parsing/creation failed - no result or cv_data');
      res.status(500).json({
        success: false,
        message: 'Failed to process CV file. The file may be corrupted or in an unsupported format.'
      });
      return;
    }

    console.log('✅ CV parsed and created successfully:', result.id);
    console.log('📊 CV Data:', JSON.stringify(result.cv_data, null, 2));

    // 6. ✅ CRITICAL: Extract cv_data with null safety
    const cvData = result.cv_data;
    const personalInfo = cvData.personal_info || {};
    const education = cvData.education || [];
    const workExperience = cvData.work_experience || [];
    const skills = cvData.skills || [];
    const certifications = cvData.certifications || [];
    const projects = cvData.projects || [];

    // 7. ✅ Return properly formatted response matching frontend expectations
    res.status(201).json({
      success: true,
      message: 'CV uploaded and parsed successfully',
      data: {
        id: result.id,
        userId: result.user_id,
        status: result.status,
        parsedFromFile: result.parsed_from_file,
        originalFilename: result.original_filename,
        fileUrl: result.file_url,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        // ✅ CRITICAL: This is what frontend expects - camelCase format
        cvData: {
          personalInfo: {
            fullName: personalInfo.full_name || '',
            email: personalInfo.email || '',
            phone: personalInfo.phone || '',
            address: personalInfo.address || '',
            linkedIn: personalInfo.linkedin_url || personalInfo.linkedIn || '',
            website: personalInfo.website_url || personalInfo.website || '',
            professionalSummary: personalInfo.professional_summary || '',
            profileImage: personalInfo.profile_image || ''
          },
          education: education.map((edu: any) => ({
            id: edu.id,
            institution: edu.institution || '',
            degree: edu.degree || '',
            fieldOfStudy: edu.field_of_study || edu.fieldOfStudy || '',
            startYear: edu.start_year || edu.startYear || '',
            endYear: edu.end_year || edu.endYear || '',
            gpa: edu.gpa || '',
            achievements: edu.achievements || ''
          })),
          workExperience: workExperience.map((work: any) => ({
            id: work.id,
            company: work.company || '',
            position: work.position || '',
            startDate: work.start_date || work.startDate || '',
            endDate: work.end_date || work.endDate || '',
            current: work.is_current || work.current || false,
            responsibilities: work.responsibilities || '',
            achievements: work.achievements || ''
          })),
          skills: skills.map((skill: any) => ({
            id: skill.id,
            name: skill.skill_name || skill.name || '',
            level: skill.skill_level || skill.level || 'Intermediate',
            category: skill.category || 'Technical'
          })),
          certifications: certifications.map((cert: any) => ({
            id: cert.id,
            name: cert.certification_name || cert.name || '',
            issuer: cert.issuer || '',
            dateIssued: cert.date_issued || cert.dateIssued || '',
            expiryDate: cert.expiry_date || cert.expiryDate || '',
            credentialId: cert.credential_id || cert.credentialId || ''
          })),
          projects: projects.map((project: any) => ({
            id: project.id,
            name: project.project_name || project.name || '',
            description: project.description || '',
            technologies: project.technologies || '',
            startDate: project.start_date || project.startDate || '',
            endDate: project.end_date || project.endDate || '',
            githubLink: project.github_link || project.githubLink || '',
            demoLink: project.demo_link || project.demoLink || '',
            outcomes: project.outcomes || ''
          }))
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Upload CV error:', error);
    
    // Handle specific error types
    if (error.message?.includes('parse')) {
      res.status(400).json({
        success: false,
        message: 'Failed to parse CV content. Please ensure your file is not corrupted.'
      });
      return;
    }

    if (error.message?.includes('database')) {
      res.status(500).json({
        success: false,
        message: 'Database error. Please try again later.'
      });
      return;
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: error.message || 'An unexpected error occurred while processing your CV'
    });
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

      const result = await CVBuilderService.updateCVStatus(cvId, userId, 'draft');

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

      const result = await CVBuilderService.updateCVStatus(cvId, userId, 'final');

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'CV not found'
        });
        return;
      }

      // Update user's active CV
      await CVBuilderService.setActiveCV(userId, cvId);

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

  // ✅ FIXED: Export CV to PDF with proper type checking
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

      const pdfBuffer = await CVBuilderService.exportToPDF(cvId, userId);

      if (!pdfBuffer) {
        res.status(404).json({ success: false, message: 'CV not found or export failed' });
        return;
      }

      // ✅ FIXED: Proper type checking for cv_data
      const cv = await CVBuilderService.getCVById(cvId, userId);
      
      // Safe access to nested properties
      let fullName = 'CV';
      if (cv?.cv_data?.personal_info?.full_name) {
        fullName = cv.cv_data.personal_info.full_name;
      }
      
      const filename = `${fullName}_${Date.now()}.pdf`.replace(/\s+/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export to PDF error:', error);
      next(error);
    }
  };

  // ✅ FIXED: Export CV to Word with proper type checking
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

      const docBuffer = await CVBuilderService.exportToWord(cvId, userId);

      if (!docBuffer) {
        res.status(404).json({ success: false, message: 'CV not found or export failed' });
        return;
      }

      // ✅ FIXED: Safe property access
      const cv = await CVBuilderService.getCVById(cvId, userId);
      
      let fullName = 'CV';
      if (cv?.cv_data?.personal_info?.full_name) {
        fullName = cv.cv_data.personal_info.full_name;
      }
      
      const filename = `${fullName}_${Date.now()}.docx`.replace(/\s+/g, '_');

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

      const result = await CVBuilderService.setActiveCV(userId, cvId);

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