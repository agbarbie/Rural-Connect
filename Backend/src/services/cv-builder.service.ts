// src/services/cv-builder.service.ts - FINAL CORRECTED VERSION
import pool from '../db/db.config';
import { CV, CVData, CVExportOptions } from '../types/cv.type';
import { validate as isValidUUID } from 'uuid';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  message?: string;
}

export class CVBuilderService {
  // Map camelCase input to snake_case for DB compatibility
  private mapToSnakeCase(input: any): any {
    if (typeof input !== 'object' || input === null) return input;

    const snakeObj: any = {};
    for (const [key, value] of Object.entries(input)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (Array.isArray(value)) {
        snakeObj[snakeKey] = value.map((item: any) => this.mapToSnakeCase(item));
      } else if (typeof value === 'object' && value !== null) {
        snakeObj[snakeKey] = this.mapToSnakeCase(value);
      } else {
        snakeObj[snakeKey] = value;
      }
    }
    return snakeObj;
  }

  // Normalize incoming CV data so we always have arrays/objects to work with
  private _normalizeCVData(input?: Partial<CVData>): CVData {
    const mappedInput = this.mapToSnakeCase(input);
    return {
      personal_info: {
        full_name: (mappedInput?.personal_info?.full_name ?? '') as string,
        email: (mappedInput?.personal_info?.email ?? '') as string,
        phone: (mappedInput?.personal_info?.phone ?? '') as string,
        address: mappedInput?.personal_info?.address ?? '',
        linkedin_url: mappedInput?.personal_info?.linkedin_url ?? '',
        website_url: mappedInput?.personal_info?.website_url ?? '',
        professional_summary: (mappedInput?.personal_info?.professional_summary ?? 'Professional seeking new opportunities') as string,
        profile_image: mappedInput?.personal_info?.profile_image ?? undefined,
        website: undefined,
        linkedIn: undefined,
        github: undefined,
        x_handle: undefined,
        twitter: undefined
      },
      education: Array.isArray(mappedInput?.education) ? mappedInput!.education : [],
      work_experience: Array.isArray(mappedInput?.work_experience) ? mappedInput!.work_experience : [],
      skills: Array.isArray(mappedInput?.skills) ? mappedInput!.skills : [],
      certifications: Array.isArray(mappedInput?.certifications) ? mappedInput!.certifications : [],
      projects: Array.isArray(mappedInput?.projects) ? mappedInput!.projects : []
    };
  }

  /**
   * ✅ FIXED: Create CV with cv_data JSONB column
   */
  async createCV(
    userId: string,
    cvDataInput?: CVData,
    parsedFromFile: boolean = false,
    fileInfo?: { url: string; filename: string }
  ): Promise<CV | null> {
    if (!isValidUUID(userId)) {
      console.error('createCV: invalid userId', userId);
      return null;
    }

    const client = await pool.connect();
    try {
      const cvData = this._normalizeCVData(cvDataInput);

      await client.query('BEGIN');

      // ✅ Store CV with cv_data JSONB column
      const cvResult = await client.query(
        `
        INSERT INTO cvs (user_id, status, parsed_from_file, original_filename, file_url, cv_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id::text, user_id::text, status, parsed_from_file, original_filename, file_url, cv_data, created_at, updated_at;
        `,
        [
          userId, 
          'draft', 
          parsedFromFile, 
          fileInfo?.filename ?? null, 
          fileInfo?.url ?? null,
          JSON.stringify(cvData) // ✅ Store entire CV data as JSONB
        ]
      );

      const cvId = cvResult.rows[0].id as string;
      console.log('✅ CV created with ID:', cvId);

      await client.query('COMMIT');

      return await this.getCVById(cvId, userId);
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ Create CV error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * ✅ FIXED: Get CV by ID with proper cv_data extraction
   */
  async getCVById(cvId: string, userId: string): Promise<CV | null> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      console.warn('getCVById: invalid uuid(s)', { cvId, userId });
      return null;
    }

    const client = await pool.connect();
    try {
      const cvResult = await client.query(
        `
        SELECT 
          id::text, 
          user_id::text, 
          status, 
          parsed_from_file, 
          original_filename, 
          file_url, 
          cv_data,
          created_at, 
          updated_at
        FROM cvs
        WHERE id = $1 AND user_id = $2
        `,
        [cvId, userId]
      );

      if (cvResult.rows.length === 0) return null;
      
      const cvRow = cvResult.rows[0];
      
      // ✅ Extract cv_data from JSONB column
      let cvData: CVData;
      
      if (cvRow.cv_data) {
        cvData = typeof cvRow.cv_data === 'string' 
          ? JSON.parse(cvRow.cv_data) 
          : cvRow.cv_data;
      } else {
        cvData = this._normalizeCVData({});
      }

      const result: CV = {
        id: cvRow.id,
        user_id: cvRow.user_id,
        status: cvRow.status,
        parsed_from_file: !!cvRow.parsed_from_file,
        original_filename: cvRow.original_filename ?? undefined,
        file_url: cvRow.file_url ?? undefined,
        created_at: cvRow.created_at,
        updated_at: cvRow.updated_at,
        cv_data: cvData
      };

      console.log('✅ CV retrieved successfully:', cvId);
      return result;
    } catch (error: any) {
      console.error('❌ Get CV by ID error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get all CVs for a user
   */
  async getUserCVs(userId: string): Promise<CV[]> {
    if (!isValidUUID(userId)) {
      console.warn('getUserCVs: invalid userId', userId);
      return [];
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id::text FROM cvs WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
        [userId]
      );

      const cvs: CV[] = [];
      for (const row of result.rows) {
        const cv = await this.getCVById(row.id, userId);
        if (cv) cvs.push(cv);
      }

      return cvs;
    } catch (error: any) {
      console.error('Get user CVs error:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * ✅ FIXED: Update CV with proper cv_data storage
   */
  async updateCV(cvId: string, userId: string, cvDataInput?: CVData): Promise<CV | null> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      console.warn('updateCV: invalid uuid(s)', { cvId, userId });
      return null;
    }

    const client = await pool.connect();
    try {
      const cvData = this._normalizeCVData(cvDataInput);

      await client.query('BEGIN');

      const cvCheck = await client.query(
        `SELECT id FROM cvs WHERE id = $1::uuid AND user_id = $2::uuid`, 
        [cvId, userId]
      );
      
      if (cvCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // ✅ Update cv_data JSONB column
      await client.query(
        `
        UPDATE cvs 
        SET cv_data = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2::uuid
        `,
        [JSON.stringify(cvData), cvId]
      );

      await client.query('COMMIT');

      console.log('✅ CV updated successfully:', cvId);
      return await this.getCVById(cvId, userId);

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Update CV error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Delete CV
   */
  async deleteCV(cvId: string, userId: string): Promise<boolean> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      return false;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM cvs WHERE id = $1::uuid AND user_id = $2::uuid`, 
        [cvId, userId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error('Delete CV error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Update CV status
   */
  async updateCVStatus(cvId: string, userId: string, status: 'draft' | 'final'): Promise<CV | null> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      return null;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE cvs 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2::uuid AND user_id = $3::uuid
        RETURNING id::text
        `,
        [status, cvId, userId]
      );

      if (result.rows.length === 0) return null;
      return await this.getCVById(cvId, userId);
    } catch (error: any) {
      console.error('Update CV status error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Set active CV
   */
  async setActiveCV(userId: string, cvId: string): Promise<boolean> {
    if (!isValidUUID(userId) || !isValidUUID(cvId)) {
      return false;
    }
    
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE jobseeker_profiles SET active_cv_id = $1::uuid WHERE user_id = $2::uuid`, 
        [cvId, userId]
      );
      return true;
    } catch (error: any) {
      console.error('Set active CV error:', error);
      return false;
    } finally {
      client.release();
    }
  }

 // src/services/cv-builder.service.ts - DEBUG VERSION of parseAndCreateCV

/**
 * ✅ DEBUG: Parse and create CV from file with extensive logging
 */
async parseAndCreateCV(
  userId: string, 
  filePath: string, 
  originalFilename: string, 
  mimeType: string
): Promise<CV | null> {
  console.log('🚀 === START PARSE AND CREATE CV ===');
  console.log('📂 File path:', filePath);
  console.log('📄 Original filename:', originalFilename);
  console.log('📋 MIME type:', mimeType);
  console.log('👤 User ID:', userId);
  
  try {
    const fileInfo = {
      url: `/uploads/cvs/${path.basename(filePath)}`,
      filename: originalFilename
    };

    // Check if file exists
    const fileExists = require('fs').existsSync(filePath);
    console.log('📁 File exists:', fileExists);
    
    if (!fileExists) {
      console.error('❌ File not found at path:', filePath);
      throw new Error('File not found');
    }

    // Check file size
    const stats = require('fs').statSync(filePath);
    console.log('📊 File size:', stats.size, 'bytes');

    console.log('🔄 Attempting to import CV parser...');
    
    // Import CV parser
    let CVParserService;
    try {
      CVParserService = (await import('./cv-parse.service')).default;
      console.log('✅ CV Parser imported successfully');
    } catch (importError: any) {
      console.error('❌ Failed to import CV parser:', importError.message);
      throw new Error(`Parser import failed: ${importError.message}`);
    }
    
    let cvData: CVData;
    let parsingSuccessful = true;
    
    console.log('🔄 Starting CV parsing...');
    try {
      cvData = await CVParserService.parseCV(filePath, mimeType);
      console.log('✅ CV parsing completed');
      console.log('📊 Parsed data:', JSON.stringify(cvData, null, 2));
      
      // Validate parsed data has minimum required fields
      if (!cvData.personal_info) {
        console.error('❌ No personal_info in parsed data');
        parsingSuccessful = false;
      } else {
        console.log('✅ Personal info found:', {
          name: cvData.personal_info.full_name,
          email: cvData.personal_info.email,
          phone: cvData.personal_info.phone
        });
      }
      
      // Check other sections
      console.log('📊 Sections count:', {
        education: cvData.education?.length || 0,
        work_experience: cvData.work_experience?.length || 0,
        skills: cvData.skills?.length || 0,
        certifications: cvData.certifications?.length || 0,
        projects: cvData.projects?.length || 0
      });
      
      if (!cvData.personal_info?.full_name && !cvData.personal_info?.email) {
        console.warn('⚠️ Parsed CV missing critical personal info');
        parsingSuccessful = false;
      }
      
    } catch (parseError: any) {
      console.error('❌ Error during CV parsing:', parseError);
      console.error('❌ Parse error stack:', parseError.stack);
      parsingSuccessful = false;
      
      // Create minimal CV structure as fallback
      console.log('🔄 Creating minimal CV structure as fallback...');
      cvData = {
        personal_info: {
          full_name: '',
          email: '',
          phone: '',
          address: '',
          linkedin_url: '',
          website_url: '',
          professional_summary: 'Please update your professional summary',
          profile_image: undefined,
          website: undefined,
          linkedIn: undefined,
          github: undefined,
          x_handle: undefined,
          twitter: undefined
        },
        education: [],
        work_experience: [],
        skills: [],
        certifications: [],
        projects: []
      };
    }

    console.log('🔄 Creating CV in database...');
    
    // Create CV in database (even if parsing partially failed)
    const createdCV = await this.createCV(userId, cvData, true, fileInfo);
    
    if (createdCV) {
      console.log('✅ CV created successfully with ID:', createdCV.id);
      console.log('📊 Created CV data:', JSON.stringify(createdCV.cv_data, null, 2));
      
      if (!parsingSuccessful) {
        console.log('⚠️ CV created with minimal data - user should fill in details manually');
      }
    } else {
      console.error('❌ Failed to create CV in database');
    }
    
    console.log('🏁 === END PARSE AND CREATE CV ===');
    return createdCV;

  } catch (error: any) {
    console.error('❌ === PARSE AND CREATE CV ERROR ===');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Try to create a minimal CV as last resort
    try {
      console.log('🔄 Attempting to create minimal CV as last resort...');
      
      const minimalData: CVData = {
        personal_info: {
          full_name: '',
          email: '',
          phone: '',
          address: '',
          linkedin_url: '',
          website_url: '',
          professional_summary: 'CV uploaded. Please update your information.',
          profile_image: undefined,
          website: undefined,
          linkedIn: undefined,
          github: undefined,
          x_handle: undefined,
          twitter: undefined
        },
        education: [],
        work_experience: [],
        skills: [],
        certifications: [],
        projects: []
      };
      
      const fileInfo = {
        url: `/uploads/cvs/${path.basename(filePath)}`,
        filename: originalFilename
      };
      
      const fallbackCV = await this.createCV(userId, minimalData, true, fileInfo);
      console.log('✅ Fallback CV created:', fallbackCV?.id);
      return fallbackCV;
      
    } catch (fallbackError: any) {
      console.error('❌ Fallback CV creation also failed:', fallbackError.message);
      return null;
    }
  }
}

  /**
   * ✅ FIXED: Export CV to PDF with null checks
   */
  async exportToPDF(cvId: string, userId: string): Promise<Buffer | null> {
    try {
      const cv = await this.getCVById(cvId, userId);
      if (!cv || !cv.cv_data) return null;

      return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ✅ FIXED: Add null checks for cv_data and typed personalInfo
      const cvData = cv.cv_data;
      const personalInfo: CVData['personal_info'] = cvData?.personal_info ?? this._normalizeCVData({}).personal_info;

      // Header
      doc.fontSize(26).fillColor('#2c3e50')
        .text(personalInfo.full_name || 'Curriculum Vitae', { align: 'center' });
      doc.moveDown(0.3);
        
        doc.fontSize(10).fillColor('#7f8c8d');
        const contactInfo = [personalInfo.email, personalInfo.phone, personalInfo.address]
          .filter(Boolean)
          .join(' • ');
        if (contactInfo) {
          doc.text(contactInfo, { align: 'center' });
        }
        doc.moveDown(1);

        // Professional Summary
        if (personalInfo.professional_summary) {
          doc.fontSize(14).fillColor('#2c3e50').text('PROFESSIONAL SUMMARY', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor('#34495e').text(personalInfo.professional_summary);
          doc.moveDown(1);
        }

        // Work Experience
        if (cvData?.work_experience && cvData.work_experience.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('WORK EXPERIENCE', { underline: true });
          doc.moveDown(0.5);
          
          cvData.work_experience.forEach((work: any) => {
            doc.fontSize(12).fillColor('#2c3e50').text(work.position || '');
            doc.fontSize(10).fillColor('#7f8c8d').text(work.company || '');
            doc.fontSize(9).fillColor('#95a5a6')
              .text(`${work.start_date || ''} - ${work.is_current ? 'Present' : (work.end_date || '')}`);
            
            if (work.responsibilities) {
              doc.fontSize(10).fillColor('#34495e').text(work.responsibilities);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Education
        if (cvData?.education && cvData.education.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('EDUCATION', { underline: true });
          doc.moveDown(0.5);
          
          cvData.education.forEach((edu: any) => {
            doc.fontSize(12).fillColor('#2c3e50')
              .text(`${edu.degree || ''} ${edu.field_of_study ? 'in ' + edu.field_of_study : ''}`);
            doc.fontSize(10).fillColor('#7f8c8d').text(edu.institution || '');
            doc.fontSize(9).fillColor('#95a5a6')
              .text(`${edu.start_year || ''} - ${edu.end_year || 'Present'}`);
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Skills
        if (cvData?.skills && cvData.skills.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('SKILLS', { underline: true });
          doc.moveDown(0.5);
          
          const skillsByCategory: { [key: string]: any[] } = {};
          cvData.skills.forEach((skill: any) => {
            const category = skill.category || 'General';
            if (!skillsByCategory[category]) {
              skillsByCategory[category] = [];
            }
            skillsByCategory[category].push(skill);
          });

          Object.keys(skillsByCategory).forEach((category) => {
            doc.fontSize(11).fillColor('#2c3e50').text(category + ':', { continued: true });
            const skillNames = skillsByCategory[category]
              .map((s) => s.skill_name || '')
              .filter(name => name)
              .join(', ');
            doc.fontSize(10).fillColor('#34495e').text(' ' + skillNames);
            doc.moveDown(0.5);
          });
        }

        // Certifications
        if (cvData?.certifications && cvData.certifications.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('CERTIFICATIONS', { underline: true });
          doc.moveDown(0.5);
          
          cvData.certifications.forEach((cert: any) => {
            doc.fontSize(11).fillColor('#2c3e50').text(cert.certification_name || cert.name || '');
            doc.fontSize(10).fillColor('#7f8c8d').text(`Issued by: ${cert.issuer || ''}`);
            doc.fontSize(9).fillColor('#95a5a6').text(`Date: ${cert.date_issued || ''}`);
            if (cert.credential_id) {
              doc.fontSize(9).fillColor('#3498db').text(`ID: ${cert.credential_id}`);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Projects
        if (cvData?.projects && cvData.projects.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('PROJECTS', { underline: true });
          doc.moveDown(0.5);
          
          cvData.projects.forEach((project: any) => {
            doc.fontSize(12).fillColor('#2c3e50').text(project.project_name || project.name || '');
            if (project.description) {
              doc.fontSize(10).fillColor('#34495e').text(project.description);
            }
            if (project.technologies) {
              doc.fontSize(9).fillColor('#7f8c8d').text(`Technologies: ${project.technologies}`);
            }
            if (project.github_link || project.demo_link) {
              const links = [project.github_link, project.demo_link].filter(Boolean).join(' | ');
              doc.fontSize(9).fillColor('#3498db').text(links);
            }
            doc.moveDown(0.7);
          });
        }

        // Footer
        doc.fontSize(8).fillColor('#95a5a6').text(
          `Generated on ${new Date().toLocaleDateString()}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

        doc.end();
      });
    } catch (error) {
      console.error('Export to PDF error:', error);
      return null;
    }
  }

  /**
   * Export to Word (returns PDF for now)
   */
  async exportToWord(cvId: string, userId: string): Promise<Buffer | null> {
    return this.exportToPDF(cvId, userId);
  }

  /**
   * Export CV - unified method
   */
  async exportCV(cvId: string, userId: string, options: CVExportOptions): Promise<ExportResult> {
    try {
      const cv = await this.getCVById(cvId, userId);
      if (!cv) {
        return { success: false, message: 'CV not found' };
      }

      let filename: string;
      if (options.format === 'pdf') {
        filename = `cv_${cvId}_${Date.now()}.pdf`;
      } else if (options.format === 'docx') {
        filename = `cv_${cvId}_${Date.now()}.docx`;
      } else {
        return { success: false, message: 'Invalid export format' };
      }

      return { success: true, downloadUrl: `/api/cv/downloads/${filename}` };
    } catch (error: any) {
      console.error('Export CV error:', error);
      return { success: false, message: 'Failed to export CV' };
    }
  }
}

export default new CVBuilderService();