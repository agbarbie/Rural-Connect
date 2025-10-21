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
      LEFT JOIN categories cat ON j.category_id = cat.id
      WHERE jb.user_id = $1
    `;

    // Count query
    const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, [userId]);
    const total = parseInt(countResult.rows[0].total);

    // Data query - Simple version that returns everything
    const dataQuery = `
      SELECT 
        jb.id as bookmark_id,
        jb.saved_at,
        jb.user_id as bookmark_user_id,
        jb.job_id,
        j.*,
        c.name as company_name,
        c.logo_url as company_logo,
        c.industry as company_industry,
        c.company_size,
        c.website_url as company_website,
        cat.name as category_name
      ${baseQuery}
      ORDER BY jb.saved_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.db.query(dataQuery, [userId, limit, offset]);
    const totalPages = Math.ceil(total / limit);

    // Transform the flat rows into the expected nested structure
    const transformedData = result.rows.map(row => ({
      id: row.bookmark_id,
      saved_at: row.saved_at,
      user_id: row.bookmark_user_id,
      job_id: row.job_id,
      // Create nested job object
      job: {
        id: row.id,
        title: row.title,
        description: row.description,
        requirements: row.requirements,
        responsibilities: row.responsibilities,
        location: row.location,
        employment_type: row.employment_type,
        work_arrangement: row.work_arrangement,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        currency: row.currency,
        skills_required: row.skills_required,
        experience_level: row.experience_level,
        education_level: row.education_level,
        benefits: row.benefits,
        department: row.department,
        status: row.status,
        application_deadline: row.application_deadline,
        is_featured: row.is_featured,
        applications_count: row.applications_count,
        views_count: row.views_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
        employer_id: row.employer_id,
        company_id: row.company_id,
        category_id: row.category_id,
        company_name: row.company_name,
        company_logo: row.company_logo,
        company_industry: row.company_industry,
        company_size: row.company_size,
        company_website: row.company_website,
        category_name: row.category_name,
        is_saved: true, // Always true for saved jobs
        has_applied: false // Will need separate query if needed
      }
    }));

    return {
      data: transformedData as unknown as JobBookmarkWithDetails[],
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
      LEFT JOIN categories cat ON j.category_id = cat.id
      WHERE ${whereClause}
    `;

    // Count query
    const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Data query - Simple version
    const dataQuery = `
      SELECT 
        ja.id as application_id,
        ja.applied_at,
        ja.status as application_status,
        ja.cover_letter,
        ja.resume_id,
        ja.portfolio_url,
        ja.expected_salary,
        ja.availability_date,
        ja.updated_at as application_updated_at,
        ja.user_id as application_user_id,
        ja.job_id,
        j.*,
        c.name as company_name,
        c.logo_url as company_logo,
        c.industry as company_industry,
        c.company_size,
        c.website_url as company_website,
        cat.name as category_name
      ${baseQuery}
      ORDER BY ja.applied_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const result = await this.db.query(dataQuery, queryParams);
    const totalPages = Math.ceil(total / limit);

    // Transform the flat rows into the expected nested structure
    const transformedData = result.rows.map(row => ({
      id: row.application_id,
      applied_at: row.applied_at,
      status: row.application_status,
      cover_letter: row.cover_letter,
      resume_id: row.resume_id,
      portfolio_url: row.portfolio_url,
      expected_salary: row.expected_salary,
      availability_date: row.availability_date,
      updated_at: row.application_updated_at,
      user_id: row.application_user_id,
      job_id: row.job_id,
      // Create nested job object
      job: {
        id: row.id,
        title: row.title,
        description: row.description,
        requirements: row.requirements,
        responsibilities: row.responsibilities,
        location: row.location,
        employment_type: row.employment_type,
        work_arrangement: row.work_arrangement,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        currency: row.currency,
        skills_required: row.skills_required,
        experience_level: row.experience_level,
        education_level: row.education_level,
        benefits: row.benefits,
        department: row.department,
        status: row.status,
        application_deadline: row.application_deadline,
        is_featured: row.is_featured,
        applications_count: row.applications_count,
        views_count: row.views_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
        employer_id: row.employer_id,
        company_id: row.company_id,
        category_id: row.category_id,
        company_name: row.company_name,
        company_logo: row.company_logo,
        company_industry: row.company_industry,
        company_size: row.company_size,
        company_website: row.company_website,
        category_name: row.category_name,
        is_saved: false, // Will need separate query if needed
        has_applied: true, // Always true for applied jobs
        application_status: row.application_status
      }
    }));

    return {
      data: transformedData as unknown as JobApplicationWithDetails[],
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

  // Get jobseeker statistics - FIXED VERSION WITH ERROR HANDLING
  async getJobseekerStats(userId: string): Promise<JobseekerStats> {
    try {
      console.log('📊 Fetching jobseeker stats for user:', userId);

      // Query for applications by status with error handling
      let applicationsResult;
      try {
        applicationsResult = await this.db.query(`
          SELECT status, COUNT(*) as count 
          FROM job_applications 
          WHERE user_id = $1 
          GROUP BY status
        `, [userId]);
      } catch (error) {
        console.error('Error fetching applications stats:', error);
        applicationsResult = { rows: [] };
      }

      // Query for saved jobs with error handling
      let savedJobsResult;
      try {
        savedJobsResult = await this.db.query(
          'SELECT COUNT(*) as total FROM job_bookmarks WHERE user_id = $1',
          [userId]
        );
      } catch (error) {
        console.error('Error fetching saved jobs count:', error);
        savedJobsResult = { rows: [{ total: '0' }] };
      }

      // Query for profile views with graceful error handling
      let profileViewsResult;
      try {
        profileViewsResult = await this.db.query(
          'SELECT COUNT(*) as total FROM profile_views WHERE profile_user_id = $1',
          [userId]
        );
      } catch (error: any) {
        // Check if it's a "relation does not exist" error
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('⚠️ profile_views table does not exist. Defaulting to 0.');
        } else {
          console.error('Error fetching profile views:', error);
        }
        profileViewsResult = { rows: [{ total: '0' }] };
      }

      // Query for monthly applications with error handling
      let monthlyAppsResult;
      try {
        monthlyAppsResult = await this.db.query(`
          SELECT COUNT(*) as total 
          FROM job_applications 
          WHERE user_id = $1 AND applied_at >= date_trunc('month', CURRENT_DATE)
        `, [userId]);
      } catch (error) {
        console.error('Error fetching monthly applications:', error);
        monthlyAppsResult = { rows: [{ total: '0' }] };
      }

      // Process application statistics
      const applicationStats = applicationsResult.rows.reduce((acc: any, row) => {
        acc[`${row.status}_applications`] = parseInt(row.count);
        return acc;
      }, {});

      const totalApplications = applicationsResult.rows.reduce(
        (sum, row) => sum + parseInt(row.count), 
        0
      );

      const stats = {
        total_applications: totalApplications,
        pending_applications: applicationStats.pending_applications || 0,
        reviewed_applications: applicationStats.reviewed_applications || 0,
        shortlisted_applications: applicationStats.shortlisted_applications || 0,
        rejected_applications: applicationStats.rejected_applications || 0,
        total_saved_jobs: parseInt(savedJobsResult.rows[0]?.total || '0'),
        profile_views: parseInt(profileViewsResult.rows[0]?.total || '0'),
        applications_this_month: parseInt(monthlyAppsResult.rows[0]?.total || '0')
      };

      console.log('✅ Stats fetched successfully:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Critical error in getJobseekerStats:', error);
      
      // Return default stats instead of throwing
      return {
        total_applications: 0,
        pending_applications: 0,
        reviewed_applications: 0,
        shortlisted_applications: 0,
        rejected_applications: 0,
        total_saved_jobs: 0,
        profile_views: 0,
        applications_this_month: 0
      };
    }
  }
}