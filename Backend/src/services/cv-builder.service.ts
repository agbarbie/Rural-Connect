// src/services/cv-builder.service.ts
import pool from '../db/db.config';
import { CV, CVData, CVExportOptions } from '../types/cv.type';
import { validate as isValidUUID } from 'uuid';
import path from 'path';

interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  message?: string;
}

export class CVBuilderService {
  // Normalize incoming CV data so we always have arrays/objects to work with
  private _normalizeCVData(input?: Partial<CVData>): CVData {
    return {
      personal_info: {
        full_name: (input?.personal_info?.full_name ?? '') as string,
        email: (input?.personal_info?.email ?? '') as string,
        phone: (input?.personal_info?.phone ?? '') as string,
        address: input?.personal_info?.address ?? '',
        linkedin_url: input?.personal_info?.linkedin_url ?? '',
        website_url: input?.personal_info?.website_url ?? '',
        professional_summary: input?.personal_info?.professional_summary ?? ''
      },
      education: Array.isArray(input?.education) ? input!.education : [],
      work_experience: Array.isArray(input?.work_experience) ? input!.work_experience : [],
      skills: Array.isArray(input?.skills) ? input!.skills : [],
      certifications: Array.isArray(input?.certifications) ? input!.certifications : [],
      projects: Array.isArray(input?.projects) ? input!.projects : []
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

      // Insert main CV record
      const cvResult = await client.query(
        `
        INSERT INTO cvs (user_id, status, parsed_from_file, original_filename, file_url)
        VALUES ($1::uuid, $2, $3, $4, $5)
        RETURNING id::text, user_id::text, status, parsed_from_file, original_filename, file_url, created_at, updated_at;
        `,
        [userId, 'draft', parsedFromFile, fileInfo?.filename ?? null, fileInfo?.url ?? null]
      );

      const cvId = cvResult.rows[0].id as string;

      // Insert personal info if available (we always insert at least empty personal_info so we have a row)
      const pi = cvData.personal_info;
      await client.query(
        `
        INSERT INTO cv_personal_info (
          cv_id, full_name, email, phone, address, linkedin_url, website_url, professional_summary
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          cvId,
          pi.full_name || '',
          pi.email || '',
          pi.phone || '',
          pi.address || null,
          pi.linkedin_url || null,
          pi.website_url || null,
          pi.professional_summary || null
        ]
      );

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
            edu.start_year,
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
            cert.certification_name,
            cert.issuer,
            cert.date_issued,
            cert.expiry_date ?? null,
            cert.credential_id ?? null,
            i
          ]
        );
      }

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
            project.project_name,
            project.description ?? null,
            project.technologies ?? null,
            project.start_date ?? null,
            project.end_date ?? null,
            project.github_link ?? null,
            project.demo_link ?? null,
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
      // Invalid IDs -> return null so controller can respond with 400/401 as appropriate
      console.warn('getCVById: invalid uuid(s)', { cvId, userId });
      return null;
    }

    const client = await pool.connect();
    try {
      const cvResult = await client.query(
        `
        SELECT id::text, user_id::text, status, parsed_from_file, original_filename, file_url, created_at, updated_at
        FROM cvs
        WHERE id = $1::uuid AND user_id = $2::uuid
        `,
        [cvId, userId]
      );

      if (cvResult.rows.length === 0) return null;
      const cvRow = cvResult.rows[0];

      // Get all sections (if rows are absent, return empty arrays or safe personal_info)
      const personalInfoResult = await client.query(
        `SELECT full_name, email, phone, address, linkedin_url, website_url, professional_summary FROM cv_personal_info WHERE cv_id = $1::uuid`,
        [cvId]
      );

      const educationResult = await client.query(
        `SELECT id::text, institution, degree, field_of_study, start_year, end_year, gpa, achievements, display_order FROM cv_education WHERE cv_id = $1::uuid ORDER BY display_order`,
        [cvId]
      );

      const workResult = await client.query(
        `SELECT id::text, company, position, start_date, end_date, is_current, responsibilities, achievements, display_order FROM cv_work_experience WHERE cv_id = $1::uuid ORDER BY display_order`,
        [cvId]
      );

      const skillsResult = await client.query(
        `SELECT id::text, skill_name, skill_level, category, display_order FROM cv_skills WHERE cv_id = $1::uuid ORDER BY display_order`,
        [cvId]
      );

      const certsResult = await client.query(
        `SELECT id::text, certification_name, issuer, date_issued, expiry_date, credential_id, display_order FROM cv_certifications WHERE cv_id = $1::uuid ORDER BY display_order`,
        [cvId]
      );

      const projectsResult = await client.query(
        `SELECT id::text, project_name, description, technologies, start_date, end_date, github_link, demo_link, outcomes, display_order FROM cv_projects WHERE cv_id = $1::uuid ORDER BY display_order`,
        [cvId]
      );

      const personalRow = personalInfoResult.rows[0] ?? {
        full_name: '',
        email: '',
        phone: '',
        address: '',
        linkedin_url: '',
        website_url: '',
        professional_summary: ''
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
      console.error('Get CV by ID error:', error);
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

      // Reinsert personal info
      const pi = cvData.personal_info;
      await client.query(
        `
        INSERT INTO cv_personal_info (cv_id, full_name, email, phone, address, linkedin_url, website_url, professional_summary)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
        `,
        [cvId, pi.full_name || '', pi.email || '', pi.phone || '', pi.address ?? null, pi.linkedin_url ?? null, pi.website_url ?? null, pi.professional_summary ?? null]
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
            edu.start_year,
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
          [cvId, cert.certification_name, cert.issuer, cert.date_issued, cert.expiry_date ?? null, cert.credential_id ?? null, i]
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
            project.project_name,
            project.description ?? null,
            project.technologies ?? null,
            project.start_date ?? null,
            project.end_date ?? null,
            project.github_link ?? null,
            project.demo_link ?? null,
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
          professional_summary: ''
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

  // Legacy helpers (kept for your controller compatibility)
  async exportToPDF(cvId: string, userId: string): Promise<string | null> {
    const result = await this.exportCV(cvId, userId, { format: 'pdf' });
    return result.success ? result.downloadUrl ?? null : null;
  }

  async exportToWord(cvId: string, userId: string): Promise<string | null> {
    const result = await this.exportCV(cvId, userId, { format: 'docx' });
    return result.success ? result.downloadUrl ?? null : null;
  }
}
