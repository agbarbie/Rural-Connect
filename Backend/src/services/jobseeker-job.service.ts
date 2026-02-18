// src/services/jobseeker-job.service.ts - FIXED VERSION
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
import { JobNotificationService } from './job-notification.service';

export class JobseekerJobService {
  private db: Pool;
  notificationService: any;

  constructor() {
    this.db = db;
    this.notificationService = new JobNotificationService();
  }

  // ✅ FIXED: Get all jobs with filters (public job explorer)
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
      console.log('🔍 Fetching jobs with filters:', { page, limit, search, location, jobType, userId });

      const baseQuery = `
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN categories cat ON j.category_id = cat.id
        ${userId ? `
          LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = $${paramIndex}
          LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.user_id = $${paramIndex}
        ` : ''}
        WHERE ${whereClause}
      `;

      // Add userId to params if provided
      if (userId) {
        queryParams.push(userId);
        paramIndex++;
      }

      // Count query
      console.log('📊 Executing count query...');
      const countResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
      const total = parseInt(countResult.rows[0].total);
      console.log(`✅ Found ${total} total jobs`);

      // Data query
      const dataQuery = `
        SELECT 
          j.id,
          j.employer_id,
          j.company_id,
          j.title,
          j.description,
          j.requirements,
          j.responsibilities,
          j.location,
          j.employment_type,
          j.work_arrangement,
          j.salary_min,
          j.salary_max,
          j.currency,
          j.skills_required,
          j.experience_level,
          j.education_level,
          j.benefits,
          j.department,
          j.status,
          j.application_deadline,
          j.is_featured,
          j.applications_count,
          j.views_count,
          j.created_at,
          j.updated_at,
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
      
      console.log('📄 Executing data query with params:', queryParams);
      const result = await this.db.query(dataQuery, queryParams);
      console.log(`✅ Retrieved ${result.rows.length} jobs`);

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
      console.error('❌ Error fetching jobs:', error);
      throw error;
    }
  }

  // ✅ FIXED: Get job details with user context
  async getJobDetails(jobId: string, userId?: string): Promise<JobWithDetails | null> {
    try {
      console.log(`🔍 Fetching job details for jobId: ${jobId}, userId: ${userId}`);

      const query = `
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
      const result = await this.db.query(query, params);

      if (result.rows.length === 0) {
        console.log('❌ Job not found');
        return null;
      }

      console.log('✅ Job details retrieved successfully');
      return result.rows[0] as JobWithDetails;
    } catch (error) {
      console.error('❌ Error fetching job details:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Get saved jobs for a user (pagination)
  async getSavedJobs(userId: string, filters: JobFilters): Promise<PaginatedResult<JobBookmarkWithDetails>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    try {
      console.log(`🔍 Fetching saved jobs for userId: ${userId}`);

      // Count query
      const countResult = await this.db.query(
        'SELECT COUNT(*) as total FROM job_bookmarks WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          jb.*,
          j.id as job_id,
          j.title,
          j.description,
          j.location,
          j.employment_type,
          j.work_arrangement,
          j.salary_min,
          j.salary_max,
          j.currency,
          j.status,
          j.created_at as job_created_at,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry
        FROM job_bookmarks jb
        INNER JOIN jobs j ON jb.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE jb.user_id = $1
        ORDER BY jb.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.db.query(dataQuery, [userId, limit, offset]);
      const totalPages = Math.ceil(total / limit);

      console.log(`✅ Found ${result.rows.length} saved jobs`);

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
      console.error('❌ Error fetching saved jobs:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Get applied jobs for a user (pagination)
  async getAppliedJobs(userId: string, filters: JobFilters): Promise<PaginatedResult<JobApplicationWithDetails>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const status = filters?.status;
    const offset = (page - 1) * limit;

    try {
      console.log(`🔍 Fetching applied jobs for userId: ${userId}, status: ${status}`);

      let whereConditions = ['ja.user_id = $1'];
      let queryParams: any[] = [userId];
      let paramIndex = 1;

      if (status) {
        paramIndex++;
        whereConditions.push(`ja.status = $${paramIndex}`);
        queryParams.push(status);
      }

      const whereClause = whereConditions.join(' AND ');

      // Count query
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM job_applications ja WHERE ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT 
          ja.*,
          j.id as job_id,
          j.title,
          j.description,
          j.location,
          j.employment_type,
          j.work_arrangement,
          j.salary_min,
          j.salary_max,
          j.currency,
          j.status as job_status,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry
        FROM job_applications ja
        INNER JOIN jobs j ON ja.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE ${whereClause}
        ORDER BY ja.applied_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      queryParams.push(limit, offset);
      const result = await this.db.query(dataQuery, queryParams);
      const totalPages = Math.ceil(total / limit);

      console.log(`✅ Found ${result.rows.length} applied jobs`);

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
      console.error('❌ Error fetching applied jobs:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Save a job
  async saveJob(userId: string, jobId: string): Promise<ServiceResponse<JobBookmark>> {
    try {
      console.log(`💾 Saving job ${jobId} for user ${userId}`);

      // Check if already saved
      const existingBookmark = await this.db.query(
        'SELECT id FROM job_bookmarks WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      if (existingBookmark.rows.length > 0) {
        return {
          success: false,
          message: 'Job already saved'
        };
      }

      // Check if job exists and is open
      const jobResult = await this.db.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND status = 'Open'",
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        return {
          success: false,
          message: 'Job not found or not available'
        };
      }

      // Save the job
      const result = await this.db.query(
        'INSERT INTO job_bookmarks (user_id, job_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
        [userId, jobId]
      );

      console.log('✅ Job saved successfully');

      return {
        success: true,
        message: 'Job saved successfully',
        data: result.rows[0] as JobBookmark
      };
    } catch (error) {
      console.error('❌ Error saving job:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Unsave a job
  async unsaveJob(userId: string, jobId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Unsaving job ${jobId} for user ${userId}`);

      const result = await this.db.query(
        'DELETE FROM job_bookmarks WHERE user_id = $1 AND job_id = $2 RETURNING id',
        [userId, jobId]
      );

      const removed = result.rows.length > 0;
      console.log(removed ? '✅ Job unsaved successfully' : '⚠️ Bookmark not found');

      return removed;
    } catch (error) {
      console.error('❌ Error unsaving job:', error);
      throw error;
    }
  }

  async applyToJob(userId: string, jobId: string, applicationData: ApplicationData): Promise<ServiceResponse<JobApplication>> {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');

    console.log(`📝 Applying to job ${jobId} for user ${userId}`);

    // Check if already applied
    // ✅ NEW - only blocks if application is active (not withdrawn/cancelled)
const existingApplication = await client.query(
  `SELECT id, status FROM job_applications 
   WHERE user_id = $1 AND job_id = $2 
   AND status NOT IN ('withdrawn', 'cancelled')`,
  [userId, jobId]
);

if (existingApplication.rows.length > 0) {
  await client.query('ROLLBACK');
  return {
    success: false,
    message: 'You have already applied to this job'
  };
}

// ✅ NEW - if a withdrawn application exists, delete it so INSERT works cleanly
await client.query(
  `DELETE FROM job_applications 
   WHERE user_id = $1 AND job_id = $2 
   AND status IN ('withdrawn', 'cancelled')`,
  [userId, jobId]
);

    // Check if job exists and is open
    const jobResult = await client.query(
      "SELECT id, title, employer_id FROM jobs WHERE id = $1 AND status = 'Open'",
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Job not found or not accepting applications'
      };
    }

    const job = jobResult.rows[0];

    // Create application
    const result = await client.query(`
      INSERT INTO job_applications (
        user_id, job_id, cover_letter, resume_id, portfolio_url, 
        expected_salary, availability_date, status, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING *
    `, [
      userId, jobId, applicationData.coverLetter || null,
      applicationData.resumeId || null, applicationData.portfolioUrl || null,
      applicationData.expectedSalary || null, applicationData.availabilityDate || null
    ]);

    // Update job applications count
    await client.query(
      'UPDATE jobs SET applications_count = applications_count + 1 WHERE id = $1',
      [jobId]
    );

    await client.query('COMMIT');

    const application = result.rows[0] as JobApplication;
    console.log('✅ Application submitted successfully');

    // Get applicant name for notification
    const applicantResult = await this.db.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    const applicantName = applicantResult.rows.length > 0
      ? `${applicantResult.rows[0].first_name} ${applicantResult.rows[0].last_name}`
      : 'A candidate';

    // ✅ FIX: Look up employer's user_id from employers table
    // job.employer_id is the employers TABLE row id, NOT the users.id
    // Notifications are stored/queried by user_id, so we need the correct one
    const employerUserResult = await this.db.query(
      'SELECT user_id FROM employers WHERE id = $1',
      [job.employer_id]
    );

    if (employerUserResult.rows.length > 0) {
      const employerUserId = employerUserResult.rows[0].user_id;
      console.log(`🔔 Notifying employer (user_id: ${employerUserId}) about application from ${applicantName}`);

      this.notificationService.notifyEmployerAboutApplication(
        employerUserId,  // ✅ Correct: users.id, not employers.id
        jobId,
        job.title,
        applicantName,
        application.id
      ).catch((err: any) => console.error('❌ Failed to notify employer:', err));
    } else {
      console.error(`❌ Could not find employer user_id for employer_id: ${job.employer_id}`);
    }

    return {
      success: true,
      message: 'Application submitted successfully',
      data: application
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying to job:', error);
    throw error;
  } finally {
    client.release();
  }
}

  // ✅ IMPLEMENTED: Get application status
  async getApplicationStatus(userId: string, jobId: string): Promise<JobApplication | null> {
    try {
      console.log(`🔍 Getting application status for job ${jobId}, user ${userId}`);

      const result = await this.db.query(
        'SELECT * FROM job_applications WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      return result.rows.length > 0 ? result.rows[0] as JobApplication : null;
    } catch (error) {
      console.error('❌ Error getting application status:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Update application
  async updateApplication(userId: string, applicationId: string, updateData: Partial<ApplicationData>): Promise<ServiceResponse<JobApplication>> {
    try {
      console.log(`📝 Updating application ${applicationId} for user ${userId}`);

      // Check ownership
      const ownershipCheck = await this.db.query(
        'SELECT id, status FROM job_applications WHERE id = $1 AND user_id = $2',
        [applicationId, userId]
      );

      if (ownershipCheck.rows.length === 0) {
        return {
          success: false,
          message: 'Application not found or unauthorized'
        };
      }

      const application = ownershipCheck.rows[0];

      // Don't allow updates if application is withdrawn
      if (application.status === 'withdrawn') {
        return {
          success: false,
          message: 'Cannot update a withdrawn application'
        };
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updateData.coverLetter !== undefined) {
        updateFields.push(`cover_letter = $${paramIndex++}`);
        updateValues.push(updateData.coverLetter);
      }
      if (updateData.resumeId !== undefined) {
        updateFields.push(`resume_id = $${paramIndex++}`);
        updateValues.push(updateData.resumeId);
      }
      if (updateData.portfolioUrl !== undefined) {
        updateFields.push(`portfolio_url = $${paramIndex++}`);
        updateValues.push(updateData.portfolioUrl);
      }
      if (updateData.expectedSalary !== undefined) {
        updateFields.push(`expected_salary = $${paramIndex++}`);
        updateValues.push(updateData.expectedSalary);
      }
      if (updateData.availabilityDate !== undefined) {
        updateFields.push(`availability_date = $${paramIndex++}`);
        updateValues.push(updateData.availabilityDate);
      }

      if (updateFields.length === 0) {
        return {
          success: false,
          message: 'No fields to update'
        };
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(applicationId, userId);

      const updateQuery = `
        UPDATE job_applications 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
      `;

      const result = await this.db.query(updateQuery, updateValues);

      console.log('✅ Application updated successfully');

      return {
        success: true,
        message: 'Application updated successfully',
        data: result.rows[0] as JobApplication
      };
    } catch (error) {
      console.error('❌ Error updating application:', error);
      throw error;
    }
  }

  // ✅ IMPLEMENTED: Withdraw application by application ID
  async withdrawApplication(userId: string, applicationId: string): Promise<ServiceResponse<void>> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      console.log(`🚫 Withdrawing application ${applicationId} for user ${userId}`);

      // Check ownership and get job details
      const applicationResult = await client.query(
        'SELECT id, job_id, status FROM job_applications WHERE id = $1 AND user_id = $2',
        [applicationId, userId]
      );

      if (applicationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Application not found or unauthorized'
        };
      }

      const application = applicationResult.rows[0];

      if (application.status === 'withdrawn') {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Application already withdrawn'
        };
      }

      // Update application status
      await client.query(
        "UPDATE job_applications SET status = 'withdrawn', updated_at = NOW() WHERE id = $1",
        [applicationId]
      );

      // Decrement job applications count
      await client.query(
        'UPDATE jobs SET applications_count = GREATEST(applications_count - 1, 0) WHERE id = $1',
        [application.job_id]
      );

      await client.query('COMMIT');

      console.log('✅ Application withdrawn successfully');

      return {
        success: true,
        message: 'Application withdrawn successfully'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error withdrawing application:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ✅ IMPLEMENTED: Withdraw application by job ID (convenience method)
  async withdrawApplicationByJob(userId: string, jobId: string): Promise<ServiceResponse<void>> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      console.log(`🚫 Withdrawing application for job ${jobId}, user ${userId}`);

      // Check if application exists
      const applicationResult = await client.query(
        'SELECT id, status FROM job_applications WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      if (applicationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Application not found'
        };
      }

      const application = applicationResult.rows[0];

      if (application.status === 'withdrawn') {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Application already withdrawn'
        };
      }

      // Update application status
      await client.query(
        "UPDATE job_applications SET status = 'withdrawn', updated_at = NOW() WHERE id = $1",
        [application.id]
      );

      // Decrement job applications count
      await client.query(
        'UPDATE jobs SET applications_count = GREATEST(applications_count - 1, 0) WHERE id = $1',
        [jobId]
      );

      await client.query('COMMIT');

      console.log('✅ Application withdrawn successfully');

      return {
        success: true,
        message: 'Application withdrawn successfully'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error withdrawing application:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ✅ IMPLEMENTED: Get jobseeker stats
  async getJobseekerStats(userId: string): Promise<JobseekerStats> {
    try {
      console.log(`📊 Fetching stats for user ${userId}`);

      const statsQuery = `
        SELECT 
          COUNT(*) as total_applications,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
          COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_applications,
          COUNT(CASE WHEN status = 'shortlisted' THEN 1 END) as shortlisted_applications,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications,
          COUNT(CASE WHEN status = 'withdrawn' THEN 1 END) as withdrawn_applications,
          COUNT(CASE WHEN applied_at >= NOW() - INTERVAL '30 days' THEN 1 END) as applications_this_month
        FROM job_applications 
        WHERE user_id = $1
      `;

      const statsResult = await this.db.query(statsQuery, [userId]);
      const stats = statsResult.rows[0];

      // Get saved jobs count
      const savedJobsResult = await this.db.query(
        'SELECT COUNT(*) as total_saved_jobs FROM job_bookmarks WHERE user_id = $1',
        [userId]
      );

      console.log('✅ Stats retrieved successfully');

      return {
        total_applications: parseInt(stats.total_applications),
        pending_applications: parseInt(stats.pending_applications),
        reviewed_applications: parseInt(stats.reviewed_applications),
        shortlisted_applications: parseInt(stats.shortlisted_applications),
        rejected_applications: parseInt(stats.rejected_applications),
        withdrawn_applications: parseInt(stats.withdrawn_applications),
        total_saved_jobs: parseInt(savedJobsResult.rows[0].total_saved_jobs),
        profile_views: 0, // TODO: Implement profile views tracking
        applications_this_month: parseInt(stats.applications_this_month)
      };
    } catch (error) {
      console.error('❌ Error fetching jobseeker stats:', error);
      throw error;
    }
  }

  // ✅ IMPROVED: Get recommended jobs (handles missing columns gracefully)
  async getRecommendedJobs(userId: string, filters: RecommendationFilters): Promise<PaginatedResult<JobWithDetails>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    try {
      console.log(`🎯 Fetching recommended jobs for user ${userId}`);

      // Get user's skills from profile if available
      let userSkills: string[] = [];
      try {
        const userDataResult = await this.db.query(`
          SELECT skills FROM user_profiles WHERE user_id = $1
        `, [userId]);
        
        if (userDataResult.rows.length > 0 && userDataResult.rows[0].skills) {
          userSkills = userDataResult.rows[0].skills;
          console.log('👤 User skills:', userSkills);
        }
      } catch (profileError) {
        console.log('⚠️ Could not fetch user profile, showing all jobs');
      }

      // Build recommendation query
      let recommendationQuery = `
        SELECT 
          j.id,
          j.employer_id,
          j.company_id,
          j.title,
          j.description,
          j.requirements,
          j.responsibilities,
          j.location,
          j.employment_type,
          j.work_arrangement,
          j.salary_min,
          j.salary_max,
          j.currency,
          j.skills_required,
          j.experience_level,
          j.education_level,
          j.benefits,
          j.department,
          j.status,
          j.application_deadline,
          j.is_featured,
          j.applications_count,
          j.views_count,
          j.created_at,
          j.updated_at,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website,
          cat.name as category_name,
          CASE WHEN jb.id IS NOT NULL THEN true ELSE false END as is_saved,
          CASE WHEN ja.id IS NOT NULL THEN true ELSE false END as has_applied,
          ja.status as application_status
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        LEFT JOIN categories cat ON j.category_id = cat.id
        LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = $1
        LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.user_id = $1
        WHERE j.status = 'Open'
        AND ja.id IS NULL
      `;

      let queryParams: any[] = [userId];

      // If user has skills, filter by matching skills
      if (userSkills.length > 0) {
        recommendationQuery += ` AND j.skills_required && $2`;
        queryParams.push(userSkills);
        console.log('🔍 Filtering by skills:', userSkills);
      }

      // Add featured jobs boost
      recommendationQuery += ` ORDER BY j.is_featured DESC, j.created_at DESC`;

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM jobs j
        LEFT JOIN job_applications ja ON j.id = ja.job_id AND ja.user_id = $1
        WHERE j.status = 'Open' AND ja.id IS NULL
        ${userSkills.length > 0 ? 'AND j.skills_required && $2' : ''}
      `;

      const countResult = await this.db.query(countQuery, userSkills.length > 0 ? [userId, userSkills] : [userId]);
      const total = parseInt(countResult.rows[0]?.total || 0);
      console.log(`📊 Total recommended jobs available: ${total}`);

      // Data query with pagination
      const dataParamIndex = queryParams.length + 1;
      recommendationQuery += ` LIMIT $${dataParamIndex} OFFSET $${dataParamIndex + 1}`;
      queryParams.push(limit, offset);

      const result = await this.db.query(recommendationQuery, queryParams);
      const totalPages = Math.ceil(total / limit);

      console.log(`✅ Found ${result.rows.length} recommended jobs`);

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
      console.error('❌ Error fetching recommended jobs:', error);
      
      // FALLBACK: Return all open jobs that user hasn't applied to
      try {
        console.log('🔄 Falling back to basic job listing...');
        
        const fallbackQuery = `
          SELECT 
            j.id,
            j.employer_id,
            j.company_id,
            j.title,
            j.description,
            j.requirements,
            j.responsibilities,
            j.location,
            j.employment_type,
            j.work_arrangement,
            j.salary_min,
            j.salary_max,
            j.currency,
            j.skills_required,
            j.experience_level,
            j.education_level,
            j.benefits,
            j.department,
            j.status,
            j.application_deadline,
            j.is_featured,
            j.applications_count,
            j.views_count,
            j.created_at,
            j.updated_at,
            c.name as company_name,
            c.logo_url as company_logo,
            c.industry as company_industry,
            c.company_size,
            c.website_url as company_website,
            cat.name as category_name,
            CASE WHEN jb.id IS NOT NULL THEN true ELSE false END as is_saved,
            false as has_applied,
            NULL as application_status
          FROM jobs j
          LEFT JOIN companies c ON j.company_id = c.id
          LEFT JOIN categories cat ON j.category_id = cat.id
          LEFT JOIN job_bookmarks jb ON j.id = jb.job_id AND jb.user_id = $1
          WHERE j.status = 'Open'
          AND NOT EXISTS (
            SELECT 1 FROM job_applications ja 
            WHERE ja.job_id = j.id AND ja.user_id = $1
          )
          ORDER BY j.is_featured DESC, j.created_at DESC
          LIMIT $2 OFFSET $3
        `;

        const countQuery = `
          SELECT COUNT(*) as total
          FROM jobs j
          WHERE j.status = 'Open'
          AND NOT EXISTS (
            SELECT 1 FROM job_applications ja 
            WHERE ja.job_id = j.id AND ja.user_id = $1
          )
        `;

        const countResult = await this.db.query(countQuery, [userId]);
        const total = parseInt(countResult.rows[0]?.total || 0);

        const result = await this.db.query(fallbackQuery, [userId, limit, offset]);
        const totalPages = Math.ceil(total / limit);

        console.log(`✅ Fallback successful: ${result.rows.length} jobs returned`);

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
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        
        // Ultimate fallback: return empty results
        return {
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        };
      }
    }
  }
}

export default JobseekerJobService;