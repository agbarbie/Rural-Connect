// src/services/cv-builder.service.ts
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

interface PortfolioSettingsInput {
  theme?: string;
  privacy_level?: 'public' | 'private' | 'unlisted';
  custom_domain?: string;
  seo_title?: string;
  seo_description?: string;
  analytics_enabled?: boolean;
  password_protected?: boolean;
  password_hash?: string;
}

interface PortfolioSettings {
  id: string;
  user_id: string;
  theme: string;
  privacy_level: string;
  custom_domain?: string;
  seo_title?: string;
  seo_description?: string;
  analytics_enabled: boolean;
  password_protected: boolean;
  password_hash?: string;
  created_at: Date;
  updated_at: Date;
}

interface PortfolioViewInput {
  viewer_ip?: string;
  viewer_user_agent?: string;
  referrer_url?: string;
  session_id?: string;
  page_duration_seconds?: number;
}

interface PortfolioView {
  id: string;
  user_id: string;
  viewer_ip?: string;
  viewer_user_agent?: string;
  referrer_url?: string;
  viewed_at: Date;
  session_id?: string;
  page_duration_seconds: number;
}

interface TestimonialInput {
  author_name: string;
  author_position?: string;
  author_company?: string;
  author_image_url?: string;
  testimonial_text: string;
  rating?: number; // 1-5
}

interface PortfolioTestimonial {
  id: string;
  user_id: string;
  author_name: string;
  author_position?: string;
  author_company?: string;
  author_image_url?: string;
  testimonial_text: string;
  rating?: number;
  is_approved: boolean;
  approved_by?: string;
  created_at: Date;
  updated_at: Date;
}

interface TrainingVideoInput {
  training_id: string;
  title: string;
  video_url: string;
  duration_seconds?: number;
  order_index?: number;
}

interface TrainingVideo {
  id: string;
  training_id: string;
  title: string;
  video_url: string;
  duration_seconds?: number;
  order_index: number;
  created_at: Date;
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
        professional_summary: (mappedInput?.personal_info?.professional_summary ?? 'Professional seeking new opportunities') as string,  // Default to avoid null
        profile_image: mappedInput?.personal_info?.profile_image ?? undefined,  // ← CHANGED: null to undefined
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

  // Create a new CV
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

      const cvResult = await client.query(
        `
        INSERT INTO cvs (user_id, status, parsed_from_file, original_filename, file_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text, user_id::text, status, parsed_from_file, original_filename, file_url, created_at, updated_at;
        `,
        [userId, 'draft', parsedFromFile, fileInfo?.filename ?? null, fileInfo?.url ?? null]
      );

      const cvId = cvResult.rows[0].id as string;

      // Insert personal info WITH profile_image
      const pi = cvData.personal_info;
      await client.query(
        `
        INSERT INTO cv_personal_info (
          cv_id, full_name, email, phone, address, linkedin_url, website_url, professional_summary, profile_image
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          cvId,
          pi.full_name || '',
          pi.email || '',
          pi.phone || '',
          pi.address || null,
          pi.linkedin_url || null,
          pi.website_url || null,
          pi.professional_summary || '',
          pi.profile_image ?? null  // ← CHANGED: || to ?? for consistency, but null is fine for DB
        ]
      );

      // Insert education (if any)
      // Insert education (if any)
for (let i = 0; i < cvData.education.length; i++) {
  const edu = cvData.education[i];
  await client.query(
    `
    INSERT INTO cv_education (
      cv_id, institution, degree, field_of_study, start_year, end_year, gpa, achievements, display_order
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      cvId,
      edu.institution,
      edu.degree,
      edu.field_of_study,
      edu.start_year || null,  // ← Change this: make it nullable
      edu.end_year ?? null,
      edu.gpa ?? null,
      edu.achievements ?? null,
      i
    ]
  );
}

      // Insert work experience (if any)
      for (let i = 0; i < cvData.work_experience.length; i++) {
        const work = cvData.work_experience[i];
        await client.query(
          `
          INSERT INTO cv_work_experience (
            cv_id, company, position, start_date, end_date, is_current, responsibilities, achievements, display_order
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            cvId,
            work.company,
            work.position,
            work.start_date,
            work.end_date ?? null,
            work.is_current ?? false,
            work.responsibilities ?? '',
            work.achievements ?? null,
            i
          ]
        );
      }

      // Insert skills (if any)
      for (let i = 0; i < cvData.skills.length; i++) {
        const skill = cvData.skills[i];
        await client.query(
          `
          INSERT INTO cv_skills (cv_id, skill_name, skill_level, category, display_order)
          VALUES ($1::uuid, $2, $3, $4, $5)
          `,
          [cvId, skill.skill_name, skill.skill_level, skill.category, i]
        );
      }

      // Insert certifications (if any)
      // Insert certifications (if any)
for (let i = 0; i < cvData.certifications.length; i++) {
  const cert = cvData.certifications[i];
  await client.query(
    `
    INSERT INTO cv_certifications (
      cv_id, certification_name, issuer, date_issued, expiry_date, credential_id, display_order
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
    `,
    [
      cvId,
      cert.certification_name || cert.name,  // ← Add fallback to cert.name
      cert.issuer,
      cert.date_issued || cert.date_issued,   // ← Also handle camelCase
      cert.expiry_date || cert.expiry_date || null,
      cert.credential_id || cert.credential_id || null,  // ← Handle both formats
      i
    ]
  );
}

      // Insert projects (if any)
      // Insert projects (if any)
for (let i = 0; i < cvData.projects.length; i++) {
  const project = cvData.projects[i];
  await client.query(
    `
    INSERT INTO cv_projects (
      cv_id, project_name, description, technologies, start_date, end_date,
      github_link, demo_link, outcomes, display_order
    ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      cvId,
      project.project_name || project.name,  // ← Add fallback
      project.description ?? null,
      project.technologies ?? null,
      project.start_date || project.start_date || null,
      project.end_date || project.end_date || null,
      project.github_link || project.github_link || null,
      project.demo_link || project.demo_link || null,
      project.outcomes ?? null,
      i
    ]
  );
}

      await client.query('COMMIT');

      // Return the newly created CV with populated sections
      return await this.getCVById(cvId, userId);
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Create CV error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  // Get CV by ID
  async getCVById(cvId: string, userId: string): Promise<CV | null> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      console.warn('getCVById: invalid uuid(s)', { cvId, userId });
      return null;
    }

    const client = await pool.connect();
    try {
      const cvResult = await client.query(
        `
        SELECT id::text, user_id::text, status, parsed_from_file, original_filename, file_url, created_at, updated_at
        FROM cvs
        WHERE id = $1 AND user_id = $2
        `,
        [cvId, userId]
      );

      if (cvResult.rows.length === 0) return null;
      const cvRow = cvResult.rows[0];

      // Get personal info WITH profile_image
      const personalInfoResult = await client.query(
        `SELECT full_name, email, phone, address, linkedin_url, website_url, professional_summary, profile_image FROM cv_personal_info WHERE cv_id = $1`,
        [cvId]
      );

      const educationResult = await client.query(
        `SELECT id::text, institution, degree, field_of_study, start_year, end_year, gpa, achievements, display_order FROM cv_education WHERE cv_id = $1 ORDER BY display_order`,
        [cvId]
      );

      const workResult = await client.query(
        `SELECT id::text, company, position, start_date, end_date, is_current, responsibilities, achievements, display_order FROM cv_work_experience WHERE cv_id = $1 ORDER BY display_order`,
        [cvId]
      );

      const skillsResult = await client.query(
        `SELECT id::text, skill_name, skill_level, category, display_order FROM cv_skills WHERE cv_id = $1 ORDER BY display_order`,
        [cvId]
      );

      const certsResult = await client.query(
        `SELECT id::text, certification_name, issuer, date_issued, expiry_date, credential_id, display_order FROM cv_certifications WHERE cv_id = $1 ORDER BY display_order`,
        [cvId]
      );

      const projectsResult = await client.query(
        `SELECT id::text, project_name, description, technologies, start_date, end_date, github_link, demo_link, outcomes, display_order FROM cv_projects WHERE cv_id = $1 ORDER BY display_order`,
        [cvId]
      );

      const personalRow = personalInfoResult.rows[0] ?? {
        full_name: '',
        email: '',
        phone: '',
        address: '',
        linkedin_url: '',
        website_url: '',
        professional_summary: '',
        profile_image: undefined  // ← CHANGED: null to undefined
      };

      const cvData: CVData = {
        personal_info: personalRow,
        education: educationResult.rows,
        work_experience: workResult.rows,
        skills: skillsResult.rows,
        certifications: certsResult.rows,
        projects: projectsResult.rows
      };

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

      return result;
    } catch (error: any) {
      console.error('❌ Get CV by ID error:', {
        message: error.message,
        stack: error.stack,
        cvId,
        userId
      });
      return null;
    } finally {
      client.release();
    }
  }

  // Get all CVs for a user
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

  // Update CV
// Update CV
async updateCV(cvId: string, userId: string, cvDataInput?: CVData): Promise<CV | null> {
  if (!isValidUUID(cvId) || !isValidUUID(userId)) {
    console.warn('updateCV: invalid uuid(s)', { cvId, userId });
    return null;
  }

  const client = await pool.connect();
  try {
    const cvData = this._normalizeCVData(cvDataInput);

    await client.query('BEGIN');

    // Ensure CV belongs to user
    const cvCheck = await client.query(`SELECT id FROM cvs WHERE id = $1::uuid AND user_id = $2::uuid`, [cvId, userId]);
    if (cvCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(`UPDATE cvs SET updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`, [cvId]);

    // Delete existing sections then reinsert (simpler than granular diffs)
    await client.query('DELETE FROM cv_personal_info WHERE cv_id = $1::uuid', [cvId]);
    await client.query('DELETE FROM cv_education WHERE cv_id = $1::uuid', [cvId]);
    await client.query('DELETE FROM cv_work_experience WHERE cv_id = $1::uuid', [cvId]);
    await client.query('DELETE FROM cv_skills WHERE cv_id = $1::uuid', [cvId]);
    await client.query('DELETE FROM cv_certifications WHERE cv_id = $1::uuid', [cvId]);
    await client.query('DELETE FROM cv_projects WHERE cv_id = $1::uuid', [cvId]);

    // Reinsert personal info WITH profile_image
    const pi = cvData.personal_info;
    await client.query(
      `
      INSERT INTO cv_personal_info (cv_id, full_name, email, phone, address, linkedin_url, website_url, professional_summary, profile_image)
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [cvId, pi.full_name || '', pi.email || '', pi.phone || '', pi.address ?? null, pi.linkedin_url ?? null, pi.website_url ?? null, pi.professional_summary || '', pi.profile_image ?? null]  // ← CHANGED: added profile_image ?? null
    );

    // Reinsert education
    for (let i = 0; i < cvData.education.length; i++) {
      const edu = cvData.education[i];
      await client.query(
        `
        INSERT INTO cv_education (cv_id, institution, degree, field_of_study, start_year, end_year, gpa, achievements, display_order)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          cvId,
          edu.institution,
          edu.degree,
          edu.field_of_study,
          edu.start_year || null,  // ← Fixed: make nullable
          edu.end_year ?? null,
          edu.gpa ?? null,
          edu.achievements ?? null,
          i
        ]
      );
    }

    // Reinsert work experiences
    for (let i = 0; i < cvData.work_experience.length; i++) {
      const work = cvData.work_experience[i];
      await client.query(
        `
        INSERT INTO cv_work_experience (cv_id, company, position, start_date, end_date, is_current, responsibilities, achievements, display_order)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          cvId,
          work.company,
          work.position,
          work.start_date,
          work.end_date ?? null,
          work.is_current ?? false,
          work.responsibilities ?? '',
          work.achievements ?? null,
          i
        ]
      );
    }

    // Reinsert skills
    for (let i = 0; i < cvData.skills.length; i++) {
      const skill = cvData.skills[i];
      await client.query(
        `INSERT INTO cv_skills (cv_id, skill_name, skill_level, category, display_order) VALUES ($1::uuid, $2, $3, $4, $5)`,
        [cvId, skill.skill_name, skill.skill_level, skill.category, i]
      );
    }

    // Reinsert certifications
    for (let i = 0; i < cvData.certifications.length; i++) {
      const cert = cvData.certifications[i];
      await client.query(
        `INSERT INTO cv_certifications (cv_id, certification_name, issuer, date_issued, expiry_date, credential_id, display_order) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
        [
          cvId, 
          cert.certification_name || cert.name,  // ← Fixed: handle both formats
          cert.issuer, 
          cert.date_issued || cert.date_issued,   // ← Fixed: handle camelCase
          cert.expiry_date || cert.expiry_date || null, 
          cert.credential_id || cert.credential_id || null,  // ← Fixed: handle both formats
          i
        ]
      );
    }

    // Reinsert projects
    for (let i = 0; i < cvData.projects.length; i++) {
      const project = cvData.projects[i];
      await client.query(
        `
        INSERT INTO cv_projects (cv_id, project_name, description, technologies, start_date, end_date, github_link, demo_link, outcomes, display_order)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          cvId,
          project.project_name || project.name,  // ← Fixed: handle both formats
          project.description ?? null,
          project.technologies ?? null,
          project.start_date || project.start_date || null,  // ← Fixed: handle camelCase
          project.end_date || project.end_date || null,      // ← Fixed: handle camelCase
          project.github_link || project.github_link || null,  // ← Fixed: handle both formats
          project.demo_link || project.demo_link || null,      // ← Fixed: handle both formats
          project.outcomes ?? null,
          i
        ]
      );
    }

    await client.query('COMMIT');

    return await this.getCVById(cvId, userId);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Update CV error:', error);
    return null;
  } finally {
    client.release();
  }
}

  // Delete CV
  async deleteCV(cvId: string, userId: string): Promise<boolean> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      console.warn('deleteCV: invalid uuid(s)', { cvId, userId });
      return false;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`DELETE FROM cvs WHERE id = $1::uuid AND user_id = $2::uuid`, [cvId, userId]);
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error('Delete CV error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Update CV status
  async updateCVStatus(cvId: string, userId: string, status: 'draft' | 'final'): Promise<CV | null> {
    if (!isValidUUID(cvId) || !isValidUUID(userId)) {
      console.warn('updateCVStatus: invalid uuid(s)', { cvId, userId });
      return null;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE cvs SET status = $1, updated_at = CURRENT_TIMESTAMP
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

  // Set active CV for user
  async setActiveCV(userId: string, cvId: string): Promise<boolean> {
    if (!isValidUUID(userId) || !isValidUUID(cvId)) {
      console.warn('setActiveCV: invalid uuid(s)', { userId, cvId });
      return false;
    }
    const client = await pool.connect();
    try {
      // Note: ensure your jobseekers table and column names match this query in your DB
      await client.query(`UPDATE jobseekers SET active_cv_id = $1::uuid WHERE user_id = $2::uuid`, [cvId, userId]);
      return true;
    } catch (error: any) {
      console.error('Set active CV error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Parse CV from file (simple placeholder parse)
  async parseAndCreateCV(userId: string, filePath: string, originalFilename: string, mimeType: string): Promise<CV | null> {
    try {
      const fileInfo = {
        url: `/uploads/cvs/${path.basename(filePath)}`,
        filename: originalFilename
      };

      // Minimal empty CV data — you can implement real parsing here
      const cvData: CVData = {
        personal_info: {
          full_name: '',
          email: '',
          phone: '',
          address: '',
          linkedin_url: '',
          website_url: '',
          professional_summary: '',
          profile_image: undefined,  // ← CHANGED: null to undefined
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

      return await this.createCV(userId, cvData, true, fileInfo);
    } catch (error: any) {
      console.error('Parse and create CV error:', error);
      return null;
    }
  }

  // Export CV - unified method
  async exportCV(cvId: string, userId: string, options: CVExportOptions): Promise<ExportResult> {
    try {
      const cv = await this.getCVById(cvId, userId);
      if (!cv) {
        return { success: false, message: 'CV not found' };
      }

      let filename: string;
      if (options.format === 'pdf') {
        filename = `cv_${cvId}_${Date.now()}.pdf`;
        // TODO: implement PDF generation and save to disk or storage
      } else if (options.format === 'docx') {
        filename = `cv_${cvId}_${Date.now()}.docx`;
        // TODO: implement docx generation
      } else {
        return { success: false, message: 'Invalid export format' };
      }

      return { success: true, downloadUrl: `/api/cv/downloads/${filename}` };
    } catch (error: any) {
      console.error('Export CV error:', error);
      return { success: false, message: 'Failed to export CV' };
    }
  }

  async exportToPDF(cvId: string, userId: string): Promise<Buffer | null> {
    try {
      const cv = await this.getCVById(cvId, userId);
      if (!cv) return null;

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const { personal_info, education, work_experience, skills, certifications, projects } = cv.cv_data ?? {
          personal_info: {},
          education: [],
          work_experience: [],
          skills: [],
          certifications: [],
          projects: []
        };

        // Header with name and contact
        doc.fontSize(26).fillColor('#2c3e50').text(personal_info.full_name || 'Curriculum Vitae', { align: 'center' });
        doc.moveDown(0.3);
        
        doc.fontSize(10).fillColor('#7f8c8d');
        const contactInfo = [personal_info.email, personal_info.phone, personal_info.address]
          .filter(Boolean)
          .join(' • ');
        doc.text(contactInfo, { align: 'center' });
        
        if (personal_info.linkedin_url || personal_info.website_url) {
          const links = [personal_info.linkedin_url, personal_info.website_url]
            .filter(Boolean)
            .join(' • ');
          doc.text(links, { align: 'center', link: personal_info.linkedin_url || personal_info.website_url });
        }
        doc.moveDown(1);

        // Professional Summary
        if (personal_info.professional_summary) {
          doc.fontSize(14).fillColor('#2c3e50').text('PROFESSIONAL SUMMARY', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(10).fillColor('#34495e').text(personal_info.professional_summary, { align: 'justify' });
          doc.moveDown(1);
        }

        // Work Experience
        if (work_experience.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('WORK EXPERIENCE', { underline: true });
          doc.moveDown(0.5);
          
          work_experience.forEach((work: any) => {
            doc.fontSize(12).fillColor('#2c3e50').text(work.position, { continued: true });
            doc.fontSize(10).fillColor('#7f8c8d').text(` at ${work.company}`, { align: 'left' });
            
            const dates = `${work.start_date} - ${work.is_current ? 'Present' : work.end_date || 'N/A'}`;
            doc.fontSize(9).fillColor('#95a5a6').text(dates);
            doc.moveDown(0.3);
            
            if (work.responsibilities) {
              doc.fontSize(10).fillColor('#34495e').text(work.responsibilities);
            }
            if (work.achievements) {
              doc.fontSize(10).fillColor('#27ae60').text('Achievements: ' + work.achievements);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Education
        if (education.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('EDUCATION', { underline: true });
          doc.moveDown(0.5);
          
          education.forEach((edu: any) => {
            doc.fontSize(12).fillColor('#2c3e50').text(`${edu.degree} in ${edu.field_of_study}`);
            doc.fontSize(10).fillColor('#7f8c8d').text(edu.institution);
            doc.fontSize(9).fillColor('#95a5a6').text(`${edu.start_year} - ${edu.end_year || 'Present'}`);
            
            if (edu.gpa) {
              doc.fontSize(9).fillColor('#27ae60').text(`GPA: ${edu.gpa}`);
            }
            if (edu.achievements) {
              doc.fontSize(10).fillColor('#34495e').text(edu.achievements);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Skills
        if (skills.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('SKILLS', { underline: true });
          doc.moveDown(0.5);
          
          const skillsByCategory: { [key: string]: any[] } = {};
          skills.forEach((skill: any) => {
            if (!skillsByCategory[skill.category]) {
              skillsByCategory[skill.category] = [];
            }
            skillsByCategory[skill.category].push(skill);
          });

          Object.keys(skillsByCategory).forEach((category) => {
            doc.fontSize(11).fillColor('#2c3e50').text(category + ':', { continued: true });
            const skillNames = skillsByCategory[category]
              .map((s) => `${s.skill_name} (${s.skill_level})`)
              .join(', ');
            doc.fontSize(10).fillColor('#34495e').text(' ' + skillNames);
            doc.moveDown(0.5);
          });
          doc.moveDown(0.5);
        }

        // Certifications
        if (certifications.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('CERTIFICATIONS', { underline: true });
          doc.moveDown(0.5);
          
          certifications.forEach((cert: any) => {
            doc.fontSize(11).fillColor('#2c3e50').text(cert.certification_name);
            doc.fontSize(10).fillColor('#7f8c8d').text(`Issued by: ${cert.issuer}`);
            doc.fontSize(9).fillColor('#95a5a6').text(`Date: ${cert.date_issued}`);
            if (cert.credential_id) {
              doc.fontSize(9).fillColor('#3498db').text(`ID: ${cert.credential_id}`);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(0.5);
        }

        // Projects
        if (projects.length > 0) {
          doc.fontSize(14).fillColor('#2c3e50').text('PROJECTS', { underline: true });
          doc.moveDown(0.5);
          
          projects.forEach((project: any) => {
            doc.fontSize(12).fillColor('#2c3e50').text(project.project_name);
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

  async exportToWord(cvId: string, userId: string): Promise<Buffer | null> {
    // For now, return PDF buffer (you can implement DOCX later with docx library)
    return this.exportToPDF(cvId, userId);
  }

  // Portfolio Settings Methods

  async createOrUpdatePortfolioSettings(userId: string, input: PortfolioSettingsInput): Promise<PortfolioSettings | null> {
    if (!isValidUUID(userId)) {
      console.error('createOrUpdatePortfolioSettings: invalid userId', userId);
      return null;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if exists
      const existing = await client.query(
        'SELECT id::text FROM portfolio_settings WHERE user_id = $1::uuid',
        [userId]
      );

      const mappedInput = this.mapToSnakeCase(input);
      const values = [
        userId,
        mappedInput.theme ?? 'default',
        mappedInput.privacy_level ?? 'public',
        mappedInput.custom_domain ?? null,
        mappedInput.seo_title ?? null,
        mappedInput.seo_description ?? null,
        mappedInput.analytics_enabled ?? true,
        mappedInput.password_protected ?? false,
        mappedInput.password_hash ?? null
      ];

      let result;
      if (existing.rows.length > 0) {
        // Update
        result = await client.query(
          `
          UPDATE portfolio_settings 
          SET theme = $2, privacy_level = $3, custom_domain = $4, seo_title = $5, 
              seo_description = $6, analytics_enabled = $7, password_protected = $8, password_hash = $9
          WHERE user_id = $1::uuid
          RETURNING id::text, user_id::text, theme, privacy_level, custom_domain, seo_title, 
                    seo_description, analytics_enabled, password_protected, password_hash, created_at, updated_at
          `,
          values
        );
      } else {
        // Insert
        result = await client.query(
          `
          INSERT INTO portfolio_settings (user_id, theme, privacy_level, custom_domain, seo_title, 
                                          seo_description, analytics_enabled, password_protected, password_hash)
          VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id::text, user_id::text, theme, privacy_level, custom_domain, seo_title, 
                    seo_description, analytics_enabled, password_protected, password_hash, created_at, updated_at
          `,
          values
        );
      }

      await client.query('COMMIT');

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        theme: row.theme,
        privacy_level: row.privacy_level,
        custom_domain: row.custom_domain || undefined,
        seo_title: row.seo_title || undefined,
        seo_description: row.seo_description || undefined,
        analytics_enabled: row.analytics_enabled,
        password_protected: row.password_protected,
        password_hash: row.password_hash || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Portfolio settings error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getPortfolioSettings(userId: string): Promise<PortfolioSettings | null> {
    if (!isValidUUID(userId)) {
      return null;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT id::text, user_id::text, theme, privacy_level, custom_domain, seo_title, 
               seo_description, analytics_enabled, password_protected, password_hash, created_at, updated_at
        FROM portfolio_settings WHERE user_id = $1::uuid
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        // Return defaults if not exists
        return {
          id: '',
          user_id: userId,
          theme: 'default',
          privacy_level: 'public',
          custom_domain: undefined,
          seo_title: undefined,
          seo_description: undefined,
          analytics_enabled: true,
          password_protected: false,
          password_hash: undefined,
          created_at: new Date(),
          updated_at: new Date()
        };
      }

      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        theme: row.theme,
        privacy_level: row.privacy_level,
        custom_domain: row.custom_domain || undefined,
        seo_title: row.seo_title || undefined,
        seo_description: row.seo_description || undefined,
        analytics_enabled: row.analytics_enabled,
        password_protected: row.password_protected,
        password_hash: row.password_hash || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error: any) {
      console.error('Get portfolio settings error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  // Portfolio Views Methods

  async logPortfolioView(userId: string, input: PortfolioViewInput): Promise<PortfolioView | null> {
    if (!isValidUUID(userId)) {
      return null;
    }

    const client = await pool.connect();
    try {
      const mappedInput = this.mapToSnakeCase(input);
      const sessionId = mappedInput.session_id ? uuidv4() : null; // Generate if not provided

      const result = await client.query(
        `
        INSERT INTO portfolio_views (user_id, viewer_ip, viewer_user_agent, referrer_url, session_id, page_duration_seconds)
        VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6)
        RETURNING id::text, user_id::text, viewer_ip, viewer_user_agent, referrer_url, viewed_at, session_id::text, page_duration_seconds
        `,
        [
          userId,
          mappedInput.viewer_ip ?? null,
          mappedInput.viewer_user_agent ?? null,
          mappedInput.referrer_url ?? null,
          sessionId,
          mappedInput.page_duration_seconds ?? 0
        ]
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        viewer_ip: row.viewer_ip || undefined,
        viewer_user_agent: row.viewer_user_agent || undefined,
        referrer_url: row.referrer_url || undefined,
        viewed_at: row.viewed_at,
        session_id: row.session_id || undefined,
        page_duration_seconds: row.page_duration_seconds
      };
    } catch (error: any) {
      console.error('Log portfolio view error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getPortfolioViews(userId: string, limit: number = 100): Promise<PortfolioView[]> {
    if (!isValidUUID(userId)) {
      return [];
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT id::text, user_id::text, viewer_ip, viewer_user_agent, referrer_url, viewed_at, session_id::text, page_duration_seconds
        FROM portfolio_views WHERE user_id = $1::uuid ORDER BY viewed_at DESC LIMIT $2
        `,
        [userId, limit]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        viewer_ip: row.viewer_ip || undefined,
        viewer_user_agent: row.viewer_user_agent || undefined,
        referrer_url: row.referrer_url || undefined,
        viewed_at: row.viewed_at,
        session_id: row.session_id || undefined,
        page_duration_seconds: row.page_duration_seconds
      }));
    } catch (error: any) {
      console.error('Get portfolio views error:', error);
      return [];
    } finally {
      client.release();
    }
  }

  // Portfolio Testimonials Methods

  async createPortfolioTestimonial(userId: string, input: TestimonialInput): Promise<PortfolioTestimonial | null> {
    if (!isValidUUID(userId)) {
      return null;
    }

    const client = await pool.connect();
    try {
      const mappedInput = this.mapToSnakeCase(input);
      if (mappedInput.rating && (mappedInput.rating < 1 || mappedInput.rating > 5)) {
        throw new Error('Rating must be between 1 and 5');
      }

      const result = await client.query(
        `
        INSERT INTO portfolio_testimonials (user_id, author_name, author_position, author_company, author_image_url, testimonial_text, rating)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
        RETURNING id::text, user_id::text, author_name, author_position, author_company, author_image_url, 
                  testimonial_text, rating, is_approved, approved_by::text, created_at, updated_at
        `,
        [
          userId,
          mappedInput.author_name,
          mappedInput.author_position ?? null,
          mappedInput.author_company ?? null,
          mappedInput.author_image_url ?? null,
          mappedInput.testimonial_text,
          mappedInput.rating ?? null
        ]
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        author_name: row.author_name,
        author_position: row.author_position || undefined,
        author_company: row.author_company || undefined,
        author_image_url: row.author_image_url || undefined,
        testimonial_text: row.testimonial_text,
        rating: row.rating || undefined,
        is_approved: row.is_approved,
        approved_by: row.approved_by || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error: any) {
      console.error('Create testimonial error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getPortfolioTestimonials(userId: string, approvedOnly: boolean = false): Promise<PortfolioTestimonial[]> {
    if (!isValidUUID(userId)) {
      return [];
    }

    const client = await pool.connect();
    try {
      let query = `
        SELECT id::text, user_id::text, author_name, author_position, author_company, author_image_url, 
               testimonial_text, rating, is_approved, approved_by::text, created_at, updated_at
        FROM portfolio_testimonials WHERE user_id = $1::uuid
      `;
      const params = [userId];
      if (approvedOnly) {
        query += ' AND is_approved = true';
      }
      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, params);

      return result.rows.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        author_name: row.author_name,
        author_position: row.author_position || undefined,
        author_company: row.author_company || undefined,
        author_image_url: row.author_image_url || undefined,
        testimonial_text: row.testimonial_text,
        rating: row.rating || undefined,
        is_approved: row.is_approved,
        approved_by: row.approved_by || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error: any) {
      console.error('Get testimonials error:', error);
      return [];
    } finally {
      client.release();
    }
  }

  async approvePortfolioTestimonial(testimonialId: string, approverId: string): Promise<boolean> {
    if (!isValidUUID(testimonialId) || !isValidUUID(approverId)) {
      return false;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        UPDATE portfolio_testimonials 
        SET is_approved = true, approved_by = $2::uuid, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid AND is_approved = false
        RETURNING id
        `,
        [testimonialId, approverId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error('Approve testimonial error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async deletePortfolioTestimonial(testimonialId: string, userId: string): Promise<boolean> {
    if (!isValidUUID(testimonialId) || !isValidUUID(userId)) {
      return false;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM portfolio_testimonials WHERE id = $1::uuid AND user_id = $2::uuid',
        [testimonialId, userId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error('Delete testimonial error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Training Videos Methods

  async createTrainingVideo(input: TrainingVideoInput): Promise<TrainingVideo | null> {
    if (!isValidUUID(input.training_id)) {
      return null;
    }

    const client = await pool.connect();
    try {
      const mappedInput = this.mapToSnakeCase(input);

      const result = await client.query(
        `
        INSERT INTO training_videos (training_id, title, video_url, duration_seconds, order_index)
        VALUES ($1::uuid, $2, $3, $4, $5)
        RETURNING id::text, training_id::text, title, video_url, duration_seconds, order_index, created_at
        `,
        [
          mappedInput.training_id,
          mappedInput.title,
          mappedInput.video_url,
          mappedInput.duration_seconds ?? null,
          mappedInput.order_index ?? 0
        ]
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        training_id: row.training_id,
        title: row.title,
        video_url: row.video_url,
        duration_seconds: row.duration_seconds || undefined,
        order_index: row.order_index,
        created_at: row.created_at
      };
    } catch (error: any) {
      console.error('Create training video error:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async getTrainingVideos(trainingId: string): Promise<TrainingVideo[]> {
    if (!isValidUUID(trainingId)) {
      return [];
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT id::text, training_id::text, title, video_url, duration_seconds, order_index, created_at
        FROM training_videos WHERE training_id = $1::uuid ORDER BY order_index
        `,
        [trainingId]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        training_id: row.training_id,
        title: row.title,
        video_url: row.video_url,
        duration_seconds: row.duration_seconds || undefined,
        order_index: row.order_index,
        created_at: row.created_at
      }));
    } catch (error: any) {
      console.error('Get training videos error:', error);
      return [];
    } finally {
      client.release();
    }
  }

  async updateTrainingVideoOrder(trainingId: string, videos: { id: string; order_index: number }[]): Promise<boolean> {
    if (!isValidUUID(trainingId)) {
      return false;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const video of videos) {
        if (!isValidUUID(video.id)) continue;
        await client.query(
          'UPDATE training_videos SET order_index = $1 WHERE id = $2::uuid AND training_id = $3::uuid',
          [video.order_index, video.id, trainingId]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Update training video order error:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async deleteTrainingVideo(videoId: string, trainingId: string): Promise<boolean> {
    if (!isValidUUID(videoId) || !isValidUUID(trainingId)) {
      return false;
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM training_videos WHERE id = $1::uuid AND training_id = $2::uuid',
        [videoId, trainingId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      console.error('Delete training video error:', error);
      return false;
    } finally {
      client.release();
    }
  }
}

export default new CVBuilderService();