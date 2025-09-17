// src/services/jobseeker-job.service.ts
import { Pool } from 'pg';
import db from '../db/db.config';
import {
  JobFilters,
  JobWithDetails,
  JobApplication,
  JobApplicationWithDetails,
  JobBookmark,
  JobBookmarkWithDetails,
  ApplicationData,
  JobseekerStats,
  ServiceResponse,
  PaginatedResult,
  RecommendationFilters
} from '../types/jobseeker-job.types';

export class JobseekerJobService {
  private db: Pool;

  constructor() {
    this.db = db;
  }

  // Get all jobs with filters (public job explorer)
  async getAllJobs(filters: JobFilters, userId?: string): Promise<PaginatedResult<JobWithDetails>> {
    const {
      page = 1,
      limit = 10,
      search,
      location,
      jobType,
      salaryMin,
      salaryMax,
      category,
      level,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = filters;

    const offset = (page - 1) * limit;
    let whereConditions = ["j.status = 'Open'"];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search) {
      whereConditions.push(`(j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (location) {
      whereConditions.push(`j.location ILIKE $${paramIndex}`);
      queryParams.push(`%${location}%`);
      paramIndex++;
    }

    if (jobType) {
      whereConditions.push(`j.employment_type = $${paramIndex}`);
      queryParams.push(jobType);
      paramIndex++;
    }

    if (salaryMin) {
      whereConditions.push(`j.salary_max >= $${paramIndex}`);
      queryParams.push(salaryMin);
      paramIndex++;
    }

    if (salaryMax) {
      whereConditions.push(`j.salary_min <= $${paramIndex}`);
      queryParams.push(salaryMax);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`cat.name = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (level) {
      whereConditions.push(`j.experience_level = $${paramIndex}`);
      queryParams.push(level);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Validate sort fields
    const validSortFields = ['created_at', 'updated_at', 'title', 'salary_max', 'applications_count', 'views_count'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    try {
      const baseQuery = `
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN categories cat ON j.category_id = cat.id
        ${userId ? `
          LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = '${userId}'
          LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.user_id = '${userId}'
        ` : ''}
        WHERE ${whereClause}
      `;

      // Count query
      const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website,
          cat.name as category_name
          ${userId ? `,
            CASE WHEN jb.id IS NOT NULL THEN true ELSE false END as is_saved,
            CASE WHEN ja.id IS NOT NULL THEN true ELSE false END as has_applied,
            ja.status as application_status
          ` : ''}
        ${baseQuery}
        ORDER BY j.${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await this.db.query(dataQuery, queryParams);

      const totalPages = Math.ceil(total / limit);

      return {
        data: result.rows as JobWithDetails[],
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }
  }

  // Get job details with view tracking
  async getJobDetails(jobId: string, userId?: string): Promise<JobWithDetails | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Track job view
      if (userId) {
        await client.query(
          'INSERT INTO job_views (job_id, user_id, viewed_at) VALUES ($1, $2, NOW()) ON CONFLICT (job_id, user_id) DO UPDATE SET viewed_at = NOW()',
          [jobId, userId]
        );
      } else {
        await client.query(
          'INSERT INTO job_views (job_id, viewed_at) VALUES ($1, NOW())',
          [jobId]
        );
      }

      // Get job details
      const jobQuery = `
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website,
          cat.name as category_name
          ${userId ? `,
            CASE WHEN jb.id IS NOT NULL THEN true ELSE false END as is_saved,
            CASE WHEN ja.id IS NOT NULL THEN true ELSE false END as has_applied,
            ja.status as application_status
          ` : ''}
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN categories cat ON j.category_id = cat.id
        ${userId ? `
          LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = $2
          LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.user_id = $2
        ` : ''}
        WHERE j.id = $1
      `;

      const params = userId ? [jobId, userId] : [jobId];
      const result = await client.query(jobQuery, params);

      await client.query('COMMIT');

      return result.rows.length > 0 ? result.rows[0] as JobWithDetails : null;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error fetching job details:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get recommended jobs for jobseeker
  async getRecommendedJobs(userId: string, filters: RecommendationFilters): Promise<PaginatedResult<JobWithDetails>> {
    const { page, limit } = filters;
    const offset = (page - 1) * limit;

    try {
      // Get user profile for recommendations
      const profileResult = await this.db.query(
        'SELECT skills, preferred_location, experience_level FROM user_profiles WHERE user_id = $1',
        [userId]
      );

      let whereConditions = ["j.status = 'Open'"];
      let queryParams: any[] = [];
      let paramIndex = 1;

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        
        // Match by skills
        if (profile.skills && profile.skills.length > 0) {
          whereConditions.push(`j.skills_required && $${paramIndex}`);
          queryParams.push(profile.skills);
          paramIndex++;
        }

        // Match by location preference
        if (profile.preferred_location) {
          whereConditions.push(`(j.location ILIKE $${paramIndex} OR j.work_arrangement = 'Remote')`);
          queryParams.push(`%${profile.preferred_location}%`);
          paramIndex++;
        }

        // Match by experience level
        if (profile.experience_level) {
          whereConditions.push(`j.experience_level = $${paramIndex}`);
          queryParams.push(profile.experience_level);
          paramIndex++;
        }
      }

      // Exclude already applied jobs
      whereConditions.push(`j.id NOT IN (SELECT job_id FROM job_applications WHERE user_id = $${paramIndex})`);
      queryParams.push(userId);
      paramIndex++;

      const whereClause = whereConditions.join(' AND ');

      const baseQuery = `
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN categories cat ON j.category_id = cat.id
        LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = $${paramIndex}
        WHERE ${whereClause}
      `;

      queryParams.push(userId);

      // Count query
      const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website,
          cat.name as category_name,
          CASE WHEN jb.id IS NOT NULL THEN true ELSE false END as is_saved,
          false as has_applied
        ${baseQuery}
        ORDER BY j.created_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      queryParams.push(limit, offset);
      const result = await this.db.query(dataQuery, queryParams);

      const totalPages = Math.ceil(total / limit);

      return {
        data: result.rows as JobWithDetails[],
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching recommended jobs:', error);
      throw error;
    }
  }

  // Save a job
  async saveJob(userId: string, jobId: string): Promise<ServiceResponse<JobBookmark>> {
    try {
      // Check if job exists
      const jobCheck = await this.db.query('SELECT id FROM jobs WHERE id = $1', [jobId]);
      if (jobCheck.rows.length === 0) {
        return { success: false, message: 'Job not found' };
      }

      // Check if already saved
      const existingBookmark = await this.db.query(
        'SELECT id FROM job_bookmarks WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      if (existingBookmark.rows.length > 0) {
        return { success: false, message: 'Job already saved' };
      }

      const result = await this.db.query(
        'INSERT INTO job_bookmarks (user_id, job_id) VALUES ($1, $2) RETURNING *',
        [userId, jobId]
      );

      return { success: true, data: result.rows[0] as JobBookmark };
    } catch (error) {
      console.error('Error saving job:', error);
      throw error;
    }
  }

  // Unsave a job
  async unsaveJob(userId: string, jobId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'DELETE FROM job_bookmarks WHERE user_id = $1 AND job_id = $2 RETURNING id',
        [userId, jobId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error unsaving job:', error);
      throw error;
    }
  }

  // Get saved jobs
  async getSavedJobs(userId: string, filters: { page: number; limit: number }): Promise<PaginatedResult<JobBookmarkWithDetails>> {
    const { page, limit } = filters;
    const offset = (page - 1) * limit;

    try {
      const baseQuery = `
        FROM job_bookmarks jb
        JOIN jobs j ON jb.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE jb.user_id = $1
      `;

      // Count query
      const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, [userId]);
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          jb.*,
          j.title as job_title,
          j.location as job_location,
          j.employment_type as job_employment_type,
          j.salary_min as job_salary_min,
          j.salary_max as job_salary_max,
          c.name as company_name,
          c.logo_url as company_logo
        ${baseQuery}
        ORDER BY jb.saved_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(dataQuery, [userId, limit, offset]);
      const totalPages = Math.ceil(total / limit);

      return {
        data: result.rows as JobBookmarkWithDetails[],
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching saved jobs:', error);
      throw error;
    }
  }

  // Apply to a job
  async applyToJob(userId: string, jobId: string, applicationData: ApplicationData): Promise<ServiceResponse<JobApplication>> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Check if job exists and is open
      const jobCheck = await client.query(
        "SELECT id, status FROM jobs WHERE id = $1 AND status = 'Open'",
        [jobId]
      );

      if (jobCheck.rows.length === 0) {
        return { success: false, message: 'Job not found or not accepting applications' };
      }

      // Check if already applied
      const existingApplication = await client.query(
        'SELECT id FROM job_applications WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      if (existingApplication.rows.length > 0) {
        return { success: false, message: 'Already applied to this job' };
      }

      // Validate resume if provided
      if (applicationData.resumeId) {
        const resumeCheck = await client.query(
          'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
          [applicationData.resumeId, userId]
        );

        if (resumeCheck.rows.length === 0) {
          return { success: false, message: 'Invalid resume ID' };
        }
      }

      // Create application
      const result = await client.query(
        `INSERT INTO job_applications (
          user_id, job_id, cover_letter, resume_id, portfolio_url, 
          expected_salary, availability_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
        [
          userId,
          jobId,
          applicationData.coverLetter,
          applicationData.resumeId,
          applicationData.portfolioUrl,
          applicationData.expectedSalary,
          applicationData.availabilityDate ? new Date(applicationData.availabilityDate) : null
        ]
      );

      await client.query('COMMIT');

      return { success: true, data: result.rows[0] as JobApplication };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error applying to job:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get applied jobs
  async getAppliedJobs(userId: string, filters: { page: number; limit: number; status?: string }): Promise<PaginatedResult<JobApplicationWithDetails>> {
    const { page, limit, status } = filters;
    const offset = (page - 1) * limit;

    try {
      let whereConditions = ['ja.user_id = $1'];
      let queryParams: any[] = [userId];
      let paramIndex = 2;

      if (status) {
        whereConditions.push(`ja.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      const baseQuery = `
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE ${whereClause}
      `;

      // Count query
      const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          ja.*,
          j.title as job_title,
          j.location as job_location,
          j.employment_type as job_employment_type,
          c.name as company_name,
          c.logo_url as company_logo
        ${baseQuery}
        ORDER BY ja.applied_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await this.db.query(dataQuery, queryParams);
      const totalPages = Math.ceil(total / limit);

      return {
        data: result.rows as JobApplicationWithDetails[],
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching applied jobs:', error);
      throw error;
    }
  }

  // Get application status for a specific job
  async getApplicationStatus(userId: string, jobId: string): Promise<JobApplication | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM job_applications WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      return result.rows.length > 0 ? result.rows[0] as JobApplication : null;
    } catch (error) {
      console.error('Error fetching application status:', error);
      throw error;
    }
  }

  // Update application
  async updateApplication(userId: string, applicationId: string, updateData: Partial<ApplicationData>): Promise<ServiceResponse<JobApplication>> {
    try {
      // Check if application belongs to user
      const applicationCheck = await this.db.query(
        'SELECT id, status FROM job_applications WHERE id = $1 AND user_id = $2',
        [applicationId, userId]
      );

      if (applicationCheck.rows.length === 0) {
        return { success: false, message: 'Application not found' };
      }

      const application = applicationCheck.rows[0];
      if (application.status !== 'pending') {
        return { success: false, message: 'Cannot update application that is not pending' };
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnMap: { [key: string]: string } = {
            coverLetter: 'cover_letter',
            resumeId: 'resume_id',
            portfolioUrl: 'portfolio_url',
            expectedSalary: 'expected_salary',
            availabilityDate: 'availability_date'
          };

          const column = columnMap[key];
          if (column) {
            updateFields.push(`${column} = $${paramIndex}`);
            updateValues.push(key === 'availabilityDate' ? new Date(value as string) : value);
            paramIndex++;
          }
        }
      });

      if (updateFields.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(applicationId);

      const updateQuery = `
        UPDATE job_applications 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(updateQuery, updateValues);

      return { success: true, data: result.rows[0] as JobApplication };
    } catch (error) {
      console.error('Error updating application:', error);
      throw error;
    }
  }

  // Withdraw application
  async withdrawApplication(userId: string, applicationId: string): Promise<ServiceResponse<void>> {
    try {
      const result = await this.db.query(
        "UPDATE job_applications SET status = 'withdrawn', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id",
        [applicationId, userId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'Application not found or cannot be withdrawn' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error withdrawing application:', error);
      throw error;
    }
  }

  // Get jobseeker statistics
  async getJobseekerStats(userId: string): Promise<JobseekerStats> {
    try {
      const [
        applicationsResult,
        savedJobsResult,
        profileViewsResult,
        monthlyAppsResult
      ] = await Promise.all([
        // Applications by status
        this.db.query(`
          SELECT status, COUNT(*) as count 
          FROM job_applications 
          WHERE user_id = $1 
          GROUP BY status
        `, [userId]),
        
        // Total saved jobs
        this.db.query('SELECT COUNT(*) as total FROM job_bookmarks WHERE user_id = $1', [userId]),
        
        // Profile views
        this.db.query('SELECT COUNT(*) as total FROM profile_views WHERE profile_user_id = $1', [userId]),
        
        // Applications this month
        this.db.query(`
          SELECT COUNT(*) as total 
          FROM job_applications 
          WHERE user_id = $1 AND applied_at >= date_trunc('month', CURRENT_DATE)
        `, [userId])
      ]);

      const applicationStats = applicationsResult.rows.reduce((acc: any, row) => {
        acc[`${row.status}_applications`] = parseInt(row.count);
        return acc;
      }, {});

      const totalApplications = applicationsResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

      return {
        total_applications: totalApplications,
        pending_applications: applicationStats.pending_applications || 0,
        reviewed_applications: applicationStats.reviewed_applications || 0,
        shortlisted_applications: applicationStats.shortlisted_applications || 0,
        rejected_applications: applicationStats.rejected_applications || 0,
        total_saved_jobs: parseInt(savedJobsResult.rows[0].total),
        profile_views: parseInt(profileViewsResult.rows[0].total),
        applications_this_month: parseInt(monthlyAppsResult.rows[0].total)
      };
    } catch (error) {
      console.error('Error fetching jobseeker stats:', error);
      throw error;
    }
  }
}