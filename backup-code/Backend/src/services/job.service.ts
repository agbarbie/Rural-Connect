// src/services/job.service.ts
import pool from '../db/db.config';
import { Job, CreateJobRequest, UpdateJobRequest, JobQuery, JobWithCompany, JobStats, JobBookmark, JobView } from '../types/job.types';
import { JobNotificationService } from './job-notification.service';

export class JobService {
  private notificationService: JobNotificationService;

  constructor() {
    this.notificationService = new JobNotificationService();
  }

  async updateApplicationStatus(
    applicationId: string,
    employerUserId: string,
    newStatus: string
  ): Promise<{ success: boolean; message: string; application?: any }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership: Get employer_id from job
      const appResult = await client.query(`
        SELECT ja.*, j.employer_id, j.title, c.name as company_name, u.id as jobseeker_id, u.first_name, u.last_name
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        JOIN users u ON ja.user_id = u.id
        WHERE ja.id = $1
      `, [applicationId]);

      if (appResult.rows.length === 0) {
        return { success: false, message: 'Application not found' };
      }

      const app = appResult.rows[0];
      const { employerId, title, company_name, jobseeker_id, first_name, last_name } = app;

      // Check ownership
      const employerCheck = await this.getEmployerAndCompany(employerUserId);
      if (employerCheck.employerId !== employerId) {
        return { success: false, message: 'Unauthorized to update this application' };
      }

      // Update status
      const result = await client.query(
        'UPDATE job_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newStatus, applicationId]
      );

      const updatedApp = result.rows[0];

      // Notify jobseeker about status change
      await this.notificationService.notifyJobseekerAboutApplicationStatus(
        jobseeker_id,
        app.job_id,
        title,
        newStatus,
        applicationId,
        company_name
      );

      console.log(`✅ Application ${applicationId} status updated to ${newStatus} and jobseeker ${jobseeker_id} notified`);

      await client.query('COMMIT');
      return { success: true, message: 'Status updated successfully', application: updatedApp };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating application status:', error);
      return { success: false, message: 'Failed to update status' };
    } finally {
      client.release();
    }
  }

  /**
   * Get applications for a specific job (for employers)
   */
  async getJobApplications(
    jobId: string, 
    query: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ applications: any[]; total: number }> {
    try {
      const { page = 1, limit = 10, status } = query;
      const offset = (page - 1) * limit;

      let whereConditions = ['ja.job_id = $1'];
      let queryParams: any[] = [jobId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        whereConditions.push(`ja.status = $${paramCount}`);
        queryParams.push(status);
      }

      const whereClause = whereConditions.join(' AND ');

      const baseQuery = `
        FROM job_applications ja
        LEFT JOIN users u ON ja.user_id = u.id
        LEFT JOIN user_profiles up ON ja.user_id = up.user_id
        WHERE ${whereClause}
      `;

      // Count query
      const countResult = await pool.query(`
        SELECT COUNT(*) as total ${baseQuery}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);

      // Data query
      const applicationsResult = await pool.query(`
        SELECT 
          ja.*,
          u.first_name,
          u.last_name,
          u.email,
          up.phone,
          up.location,
          up.skills,
          up.experience_level,
          up.linkedin_url,
          up.portfolio_url as profile_portfolio_url
        ${baseQuery}
        ORDER BY ja.applied_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return {
        applications: applicationsResult.rows,
        total
      };
    } catch (error) {
      console.error('Error fetching job applications:', error);
      throw error;
    }
  }
  
  /**
   * Helper method to get employer and company info
   */
  private async getEmployerAndCompany(userId: string): Promise<{employerId: string, companyId: string, companyName: string}> {
    const client = await pool.connect();
    try {
      const employerResult = await client.query(`
        SELECT e.id, e.company_id, c.name as company_name
        FROM employers e
        LEFT JOIN companies c ON e.company_id = c.id
        WHERE e.user_id = $1
      `, [userId]);

      if (employerResult.rows.length === 0) {
        throw new Error('Employer profile not found for this user');
      }

      const employer = employerResult.rows[0];
      let companyId = employer.company_id;
      let companyName = employer.company_name;

      if (!companyId) {
        const defaultCompanyResult = await client.query(`
          INSERT INTO companies (name, description, industry, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name
        `, [
          `Company - ${userId.substring(0, 8)}`,
          'Please update your company profile',
          'Technology',
          new Date(),
          new Date()
        ]);

        companyId = defaultCompanyResult.rows[0].id;
        companyName = defaultCompanyResult.rows[0].name;

        await client.query(
          'UPDATE employers SET company_id = $1, updated_at = $2 WHERE id = $3',
          [companyId, new Date(), employer.id]
        );
      }

      return { 
        employerId: employer.id, 
        companyId, 
        companyName: companyName || 'Company' 
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create job - WITH NOTIFICATIONS
   */
  async createJob(userId: string, jobData: CreateJobRequest): Promise<Job> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { employerId, companyId, companyName } = await this.getEmployerAndCompany(userId);

      let benefits: string[] | null = null;
      if (jobData.benefits) {
        if (typeof jobData.benefits === 'string') {
          benefits = (jobData.benefits as string)
            .split(',')
            .map((item: string) => item.trim())
            .filter((item: string) => item.length > 0);
        } else if (Array.isArray(jobData.benefits)) {
          benefits = jobData.benefits as string[];
        }
      }

      const insertQuery = `
        INSERT INTO jobs (
          employer_id, company_id, title, description, requirements, responsibilities,
          location, employment_type, work_arrangement, salary_min, salary_max,
          currency, skills_required, experience_level, education_level, benefits,
          department, application_deadline, is_featured, status, applications_count, views_count,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *
      `;

      const values = [
        employerId, companyId, jobData.title, jobData.description,
        jobData.requirements || null, jobData.responsibilities || null,
        jobData.location, jobData.employment_type, jobData.work_arrangement,
        jobData.salary_min || null, jobData.salary_max || null,
        jobData.currency || 'USD', jobData.skills_required || [],
        jobData.experience_level || null, jobData.education_level || null,
        benefits, jobData.department || null,
        jobData.application_deadline ? new Date(jobData.application_deadline) : null,
        jobData.is_featured || false, 'Open', 0, 0,
        new Date(), new Date()
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');

      const newJob = result.rows[0] as Job;

      console.log(`✅ Job created: ${newJob.id} - "${newJob.title}"`);

      // 🔥 NOTIFY RELEVANT JOBSEEKERS
      if (newJob.status === 'Open') {
        this.notificationService.notifyJobseekersAboutNewJob(
          newJob.id,
          newJob.title,
          companyName,
          newJob.skills_required || [],
          newJob.location,
          newJob.employment_type
        ).catch(err => console.error('❌ Failed to notify jobseekers:', err));
      }

      return newJob;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error creating job:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get jobs by employer - CORRECTED: takes userId, not employerId
   */
  async getJobsByEmployer(userId: string, query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
    try {
      // First get the employer ID from user ID
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        throw new Error('Employer profile not found for this user');
      }

      const employerId = employerResult.rows[0].id;

      const {
        page = 1,
        limit = 10,
        status,
        employment_type,
        work_arrangement,
        search,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = query;

      const offset = (page - 1) * limit;

      let whereConditions = ['j.employer_id = $1'];
      let queryParams: any[] = [employerId]; // Use employerId from database
      let paramCount = 1;

      if (status) {
        paramCount++;
        whereConditions.push(`j.status = $${paramCount}`);
        queryParams.push(status);
      }

      if (employment_type) {
        paramCount++;
        whereConditions.push(`j.employment_type = $${paramCount}`);
        queryParams.push(employment_type);
      }

      if (work_arrangement) {
        paramCount++;
        whereConditions.push(`j.work_arrangement = $${paramCount}`);
        queryParams.push(work_arrangement);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          j.title ILIKE $${paramCount} OR 
          j.description ILIKE $${paramCount} OR 
          j.location ILIKE $${paramCount} OR 
          array_to_string(j.skills_required, ',') ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max', 'applications_count', 'views_count'];
      const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';

      const baseQuery = `
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE ${whereClause}
      `;

      const countResult = await pool.query(`
        SELECT COUNT(*) as total ${baseQuery}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);

      const jobsResult = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        ${baseQuery}
        ORDER BY j.${sortField} ${sortDirection}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return {
        jobs: jobsResult.rows as JobWithCompany[],
        total
      };
    } catch (error) {
      console.error('Error fetching jobs by employer:', error);
      throw error;
    }
  }

  async getAllJobs(query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'Open',
        employment_type,
        work_arrangement,
        location,
        skills,
        salary_min,
        salary_max,
        search,
        sort_by = 'created_at',
        sort_order = 'DESC',
        company_id,
        employer_id
      } = query;

      const offset = (page - 1) * limit;

      let whereConditions = ['j.status = $1'];
      let queryParams: any[] = [status];
      let paramCount = 1;

      if (employment_type) {
        paramCount++;
        whereConditions.push(`j.employment_type = $${paramCount}`);
        queryParams.push(employment_type);
      }

      if (work_arrangement) {
        paramCount++;
        whereConditions.push(`j.work_arrangement = $${paramCount}`);
        queryParams.push(work_arrangement);
      }

      if (location) {
        paramCount++;
        whereConditions.push(`j.location ILIKE $${paramCount}`);
        queryParams.push(`%${location}%`);
      }

      if (skills && skills.length > 0) {
        paramCount++;
        whereConditions.push(`j.skills_required && $${paramCount}`);
        queryParams.push(skills);
      }

      if (salary_min) {
        paramCount++;
        whereConditions.push(`j.salary_max >= $${paramCount}`);
        queryParams.push(salary_min);
      }

      if (salary_max) {
        paramCount++;
        whereConditions.push(`j.salary_min <= $${paramCount}`);
        queryParams.push(salary_max);
      }

      if (company_id) {
        paramCount++;
        whereConditions.push(`j.company_id = $${paramCount}`);
        queryParams.push(company_id);
      }

      if (employer_id) {
        paramCount++;
        whereConditions.push(`j.employer_id = $${paramCount}`);
        queryParams.push(employer_id);
      }

      if (search) {
        paramCount++;
        whereConditions.push(`(
          j.title ILIKE $${paramCount} OR 
          j.description ILIKE $${paramCount} OR 
          j.location ILIKE $${paramCount} OR 
          c.name ILIKE $${paramCount} OR
          array_to_string(j.skills_required, ',') ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max', 'applications_count', 'views_count'];
      const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';

      const baseQuery = `
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE ${whereClause}
      `;

      const countResult = await pool.query(`
        SELECT COUNT(*) as total ${baseQuery}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);

      const jobsResult = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        ${baseQuery}
        ORDER BY j.${sortField} ${sortDirection}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      return {
        jobs: jobsResult.rows as JobWithCompany[],
        total
      };
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      throw error;
    }
  }

  /**
   * Update job - WITH NOTIFICATIONS
   */
  async updateJob(jobId: string, userId: string, updateData: UpdateJobRequest): Promise<Job | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get old job data for comparison
      const oldJobResult = await client.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
      if (oldJobResult.rows.length === 0) {
        throw new Error('Job not found');
      }
      const oldJob = oldJobResult.rows[0];

      const { employerId } = await this.getEmployerAndCompany(userId);

      const ownershipCheck = await client.query(
        'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
        [jobId, employerId]
      );

      if (ownershipCheck.rows.length === 0) {
        throw new Error('Job not found or unauthorized');
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 0;

      const updatableFields = {
        title: 'title',
        description: 'description',
        requirements: 'requirements',
        responsibilities: 'responsibilities',
        location: 'location',
        employment_type: 'employment_type',
        work_arrangement: 'work_arrangement',
        salary_min: 'salary_min',
        salary_max: 'salary_max',
        currency: 'currency',
        skills_required: 'skills_required',
        experience_level: 'experience_level',
        education_level: 'education_level',
        benefits: 'benefits',
        department: 'department',
        status: 'status',
        application_deadline: 'application_deadline',
        is_featured: 'is_featured'
      };

      Object.entries(updateData).forEach(([key, value]) => {
        if (key in updatableFields && value !== undefined) {
          paramCount++;
          const typedKey = key as keyof typeof updatableFields;
          if (key === 'benefits' && typeof value === 'string') {
            updateFields.push(`${updatableFields[typedKey]} = $${paramCount}`);
            updateValues.push(
              value.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
            );
          } else if (key === 'application_deadline' && value) {
            updateFields.push(`${updatableFields[typedKey]} = $${paramCount}`);
            updateValues.push(new Date(value as string));
          } else {
            updateFields.push(`${updatableFields[typedKey]} = $${paramCount}`);
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());

      paramCount++;
      updateValues.push(jobId);

      const updateQuery = `
        UPDATE jobs 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);
      await client.query('COMMIT');

      const updatedJob = result.rows[0] as Job;

      console.log(`✅ Job updated: ${updatedJob.id} - "${updatedJob.title}"`);

      // 🔥 NOTIFY ABOUT STATUS CHANGES
      if (oldJob.status !== updatedJob.status) {
        if (updatedJob.status === 'Closed') {
          this.notificationService.notifyJobseekersSavedJob(
            jobId,
            updatedJob.title,
            'closed'
          ).catch(err => console.error('❌ Failed to notify closure:', err));
        } else if (updatedJob.status === 'Filled') {
          this.notificationService.notifyJobseekersSavedJob(
            jobId,
            updatedJob.title,
            'filled'
          ).catch(err => console.error('❌ Failed to notify filled:', err));
        } else if (updatedJob.status === 'Open' && oldJob.status !== 'Open') {
          // Job reopened
          this.notificationService.notifyJobseekersSavedJob(
            jobId,
            updatedJob.title,
            'updated'
          ).catch(err => console.error('❌ Failed to notify reopening:', err));
        }
      }

      // 🔥 NOTIFY ABOUT SIGNIFICANT UPDATES (title, description, requirements)
      const significantChanges = ['title', 'description', 'requirements', 'salary_min', 'salary_max'];
      const hasSignificantChange = significantChanges.some(field => 
        updateData[field as keyof UpdateJobRequest] !== undefined
      );

      if (hasSignificantChange && updatedJob.status === 'Open') {
        this.notificationService.notifyJobseekersSavedJob(
          jobId,
          updatedJob.title,
          'updated'
        ).catch(err => console.error('❌ Failed to notify update:', err));
      }

      return updatedJob;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error updating job:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete job - WITH NOTIFICATIONS
   */
  async deleteJob(jobId: string, userId: string): Promise<boolean> {
    try {
      const job = await this.getJobById(jobId);
      
      if (!job) {
        return false;
      }

      const { employerId } = await this.getEmployerAndCompany(userId);

      const result = await pool.query(
        'DELETE FROM jobs WHERE id = $1 AND employer_id = $2 RETURNING id',
        [jobId, employerId]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Job deleted: ${jobId} - "${job.title}"`);

        // 🔥 NOTIFY ALL USERS WHO SAVED OR APPLIED
        this.notificationService.notifyJobseekersSavedJob(
          jobId,
          job.title,
          'deleted'
        ).catch(err => console.error('❌ Failed to notify deletion:', err));
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Error deleting job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string): Promise<JobWithCompany | null> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.id = $1
      `, [jobId]);

      return result.rows.length > 0 ? result.rows[0] as JobWithCompany : null;
    } catch (error) {
      console.error('❌ Error fetching job by ID:', error);
      throw error;
    }
  }

  async incrementJobViews(jobId: string, ipAddress?: string, userAgent?: string, jobseekerId?: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO job_views (job_id, jobseeker_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
      `, [jobId, jobseekerId || null, ipAddress || null, userAgent || null]);

      await client.query(
        'UPDATE jobs SET views_count = views_count + 1 WHERE id = $1',
        [jobId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error incrementing job views:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get job stats - CORRECTED: takes userId and gets employerId internally
   */
  async getJobStats(userId: string): Promise<any> {
    const client = await pool.connect();
    
    try {
      // First, get the employer ID from user ID
      const employerResult = await client.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        throw new Error('Employer profile not found for this user');
      }

      const employerId = employerResult.rows[0].id;

      // Get job statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'Open' THEN 1 END) as active_jobs,
          COUNT(CASE WHEN status = 'Filled' THEN 1 END) as filled_jobs,
          COUNT(CASE WHEN status = 'Paused' THEN 1 END) as paused_jobs,
          COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_jobs,
          COALESCE(SUM(applications_count), 0) as total_applications,
          COALESCE(SUM(views_count), 0) as total_views,
          CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(applications_count), 2) ELSE 0 END as avg_applications_per_job,
          CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(views_count), 2) ELSE 0 END as avg_views_per_job,
          COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_jobs_count,
          COUNT(CASE WHEN work_arrangement = 'Remote' THEN 1 END) as remote_jobs_count,
          COUNT(CASE WHEN work_arrangement = 'Hybrid' THEN 1 END) as hybrid_jobs_count
        FROM jobs 
        WHERE employer_id = $1
      `;

      const statsResult = await client.query(statsQuery, [employerId]);
      const stats = statsResult.rows[0];

      // Get recent activity (last 30 days)
      const recentActivityQuery = `
        SELECT 
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as jobs_posted_last_30_days,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN applications_count ELSE 0 END), 0) as applications_last_30_days
        FROM jobs 
        WHERE employer_id = $1
      `;

      const activityResult = await client.query(recentActivityQuery, [employerId]);
      const activity = activityResult.rows[0];

      // Get top performing jobs
      const topJobsQuery = `
        SELECT id, title, applications_count, views_count, status, created_at
        FROM jobs 
        WHERE employer_id = $1
        ORDER BY (applications_count + views_count) DESC
        LIMIT 5
      `;

      const topJobsResult = await client.query(topJobsQuery, [employerId]);

      return {
        overview: {
          total_jobs: parseInt(stats.total_jobs),
          active_jobs: parseInt(stats.active_jobs),
          filled_jobs: parseInt(stats.filled_jobs),
          paused_jobs: parseInt(stats.paused_jobs),
          closed_jobs: parseInt(stats.closed_jobs),
          total_applications: parseInt(stats.total_applications),
          total_views: parseInt(stats.total_views),
          avg_applications_per_job: stats.avg_applications_per_job.toString(),
          avg_views_per_job: stats.avg_views_per_job.toString(),
          featured_jobs_count: parseInt(stats.featured_jobs_count),
          remote_jobs_count: parseInt(stats.remote_jobs_count),
          hybrid_jobs_count: parseInt(stats.hybrid_jobs_count)
        },
        recent_activity: {
          jobs_posted_last_30_days: parseInt(activity.jobs_posted_last_30_days),
          applications_last_30_days: parseInt(activity.applications_last_30_days)
        },
        top_performing_jobs: topJobsResult.rows,
        application_status_breakdown: {
          pending: 0,
          reviewing: 0,
          shortlisted: 0,
          interviewed: 0,
          offered: 0,
          hired: 0,
          rejected: 0
        }
      };
    } catch (error) {
      console.error('Error fetching job stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Rest of the methods remain the same as they don't deal with employer/user ID confusion
  async bookmarkJob(jobId: string, jobseekerId: string): Promise<JobBookmark> {
    try {
      const existingBookmark = await pool.query(
        'SELECT id FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2',
        [jobId, jobseekerId]
      );

      if (existingBookmark.rows.length > 0) {
        throw new Error('Job already bookmarked');
      }

      const result = await pool.query(`
        INSERT INTO job_bookmarks (job_id, jobseeker_id)
        VALUES ($1, $2)
        RETURNING *
      `, [jobId, jobseekerId]);

      return result.rows[0] as JobBookmark;
    } catch (error) {
      console.error('Error bookmarking job:', error);
      throw error;
    }
  }

  async removeBookmark(jobId: string, jobseekerId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'DELETE FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2 RETURNING id',
        [jobId, jobseekerId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }

  async getBookmarkedJobs(jobseekerId: string, query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = query;

      const offset = (page - 1) * limit;

      const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max'];
      const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
      const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';

      const baseQuery = `
        FROM job_bookmarks jb
        INNER JOIN jobs j ON jb.job_id = j.id
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE jb.jobseeker_id = $1
      `;

      const countResult = await pool.query(`
        SELECT COUNT(*) as total ${baseQuery}
      `, [jobseekerId]);

      const total = parseInt(countResult.rows[0].total);

      const jobsResult = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        ${baseQuery}
        ORDER BY jb.${sortField} ${sortDirection}
        LIMIT $2 OFFSET $3
      `, [jobseekerId, limit, offset]);

      return {
        jobs: jobsResult.rows as JobWithCompany[],
        total
      };
    } catch (error) {
      console.error('Error fetching bookmarked jobs:', error);
      throw error;
    }
  }

  async isJobBookmarked(jobId: string, jobseekerId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2',
        [jobId, jobseekerId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking bookmark status:', error);
      return false;
    }
  }

  async getJobViews(jobId: string, page: number = 1, limit: number = 10): Promise<{ views: JobView[]; total: number }> {
    try {
      const offset = (page - 1) * limit;

      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM job_views WHERE job_id = $1',
        [jobId]
      );

      const total = parseInt(countResult.rows[0].total);

      const viewsResult = await pool.query(`
        SELECT *
        FROM job_views
        WHERE job_id = $1
        ORDER BY viewed_at DESC
        LIMIT $2 OFFSET $3
      `, [jobId, limit, offset]);

      return {
        views: viewsResult.rows as JobView[],
        total
      };
    } catch (error) {
      console.error('Error fetching job views:', error);
      throw error;
    }
  }

  async updateJobApplicationCount(jobId: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE jobs 
        SET applications_count = (
          SELECT COUNT(*) 
          FROM job_applications 
          WHERE job_id = $1
        )
        WHERE id = $1
      `, [jobId]);
    } catch (error) {
      console.error('Error updating job application count:', error);
      throw error;
    }
  }

  async getFeaturedJobs(limit: number = 5): Promise<JobWithCompany[]> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.is_featured = true AND j.status = 'Open'
        ORDER BY j.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows as JobWithCompany[];
    } catch (error) {
      console.error('Error fetching featured jobs:', error);
      throw error;
    }
  }

  async getRecentJobs(limit: number = 10): Promise<JobWithCompany[]> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'Open'
        ORDER BY j.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows as JobWithCompany[];
    } catch (error) {
      console.error('Error fetching recent jobs:', error);
      throw error;
    }
  }

  async getPopularJobs(limit: number = 10): Promise<JobWithCompany[]> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'Open'
        ORDER BY j.applications_count DESC, j.views_count DESC
        LIMIT $1
      `, [limit]);

      return result.rows as JobWithCompany[];
    } catch (error) {
      console.error('Error fetching popular jobs:', error);
      throw error;
    }
  }

  async searchJobsBySkills(skills: string[], limit: number = 10): Promise<JobWithCompany[]> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'Open' AND j.skills_required && $1
        ORDER BY j.created_at DESC
        LIMIT $2
      `, [skills, limit]);

      return result.rows as JobWithCompany[];
    } catch (error) {
      console.error('Error searching jobs by skills:', error);
      throw error;
    }
  }

  async getJobsByLocation(location: string, limit: number = 10): Promise<JobWithCompany[]> {
    try {
      const result = await pool.query(`
        SELECT 
          j.*,
          c.name as company_name,
          c.logo_url as company_logo,
          c.industry as company_industry,
          c.company_size,
          c.website_url as company_website
        FROM jobs j
        LEFT JOIN companies c ON j.company_id = c.id
        WHERE j.status = 'Open' AND j.location ILIKE $1
        ORDER BY j.created_at DESC
        LIMIT $2
      `, [`%${location}%`, limit]);

      return result.rows as JobWithCompany[];
    } catch (error) {
      console.error('Error fetching jobs by location:', error);
      throw error;
    }
  }
}