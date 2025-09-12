// src/services/job.service.ts
import { Pool } from 'pg';
import { Job, CreateJobRequest, UpdateJobRequest, JobQuery, JobWithCompany, JobStats, JobBookmark, JobView } from '../types/job.types';

export class JobService {
  constructor(private db: Pool) {}

  async createJob(employerId: string, jobData: CreateJobRequest): Promise<Job> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get employer's company_id
      const employerResult = await client.query(
        'SELECT company_id FROM employers WHERE id = $1',
        [employerId]
      );
      
      if (employerResult.rows.length === 0) {
        throw new Error('Employer not found');
      }
      
      const companyId = employerResult.rows[0].company_id;
      
      if (!companyId) {
        throw new Error('Employer must be associated with a company to post jobs');
      }
      
      // Insert the job
      const insertQuery = `
        INSERT INTO jobs (
          employer_id, company_id, title, description, requirements, responsibilities,
          location, employment_type, work_arrangement, salary_min, salary_max,
          currency, skills_required, experience_level, education_level, benefits,
          department, application_deadline, is_featured
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;
      
      const values = [
        employerId,
        companyId,
        jobData.title,
        jobData.description,
        jobData.requirements || null,
        jobData.responsibilities || null,
        jobData.location,
        jobData.employment_type,
        jobData.work_arrangement,
        jobData.salary_min || null,
        jobData.salary_max || null,
        jobData.currency || 'USD',
        jobData.skills_required,
        jobData.experience_level || null,
        jobData.education_level || null,
        jobData.benefits || null,
        jobData.department || null,
        jobData.application_deadline ? new Date(jobData.application_deadline) : null,
        jobData.is_featured || false
      ];
      
      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');
      
      return result.rows[0] as Job;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getJobsByEmployer(employerId: string, query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
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
    let queryParams: any[] = [employerId];
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
    
    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max', 'applications_count', 'views_count'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';
    
    const baseQuery = `
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE ${whereClause}
    `;
    
    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total ${baseQuery}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get jobs with pagination
    const jobsResult = await this.db.query(`
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
  }

  async getAllJobs(query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
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
    
    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max', 'applications_count', 'views_count'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';
    
    const baseQuery = `
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE ${whereClause}
    `;
    
    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total ${baseQuery}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get jobs with pagination
    const jobsResult = await this.db.query(`
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
  }

  async getJobById(jobId: string): Promise<JobWithCompany | null> {
    const result = await this.db.query(`
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
  }

  async updateJob(jobId: string, employerId: string, updateData: UpdateJobRequest): Promise<Job | null> {
    const client = await this.db.connect();
    
    try {
      // First, verify the job belongs to the employer
      const ownershipCheck = await client.query(
        'SELECT id FROM jobs WHERE id = $1 AND employer_id = $2',
        [jobId, employerId]
      );
      
      if (ownershipCheck.rows.length === 0) {
        throw new Error('Job not found or unauthorized');
      }
      
      // Build dynamic update query
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
          updateFields.push(`${updatableFields[key as keyof typeof updatableFields]} = $${paramCount}`);
          
          if (key === 'application_deadline' && value) {
            updateValues.push(new Date(value as string));
          } else {
            updateValues.push(value);
          }
        }
      });
      
      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      // Add updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());
      
      // Add WHERE condition parameters
      paramCount++;
      updateValues.push(jobId);
      
      const updateQuery = `
        UPDATE jobs 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, updateValues);
      return result.rows[0] as Job;
    } finally {
      client.release();
    }
  }

  async deleteJob(jobId: string, employerId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM jobs WHERE id = $1 AND employer_id = $2 RETURNING id',
      [jobId, employerId]
    );
    
    return result.rows.length > 0;
  }

  async incrementJobViews(jobId: string, ipAddress?: string, userAgent?: string, jobseekerId?: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert job view record
      await client.query(`
        INSERT INTO job_views (job_id, jobseeker_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
      `, [jobId, jobseekerId || null, ipAddress || null, userAgent || null]);
      
      // Update job views count
      await client.query(
        'UPDATE jobs SET views_count = views_count + 1 WHERE id = $1',
        [jobId]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getJobStats(employerId?: string): Promise<JobStats> {
    let whereCondition = '';
    const queryParams: any[] = [];
    
    if (employerId) {
      whereCondition = 'WHERE employer_id = $1';
      queryParams.push(employerId);
    }
    
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as active_jobs,
        SUM(CASE WHEN status = 'Paused' THEN 1 ELSE 0 END) as paused_jobs,
        SUM(CASE WHEN status = 'Closed' OR status = 'Filled' THEN 1 ELSE 0 END) as closed_jobs,
        SUM(applications_count) as total_applications,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND(SUM(applications_count)::numeric / COUNT(*), 2)
          ELSE 0 
        END as average_applications_per_job,
        SUM(CASE WHEN is_featured = true THEN 1 ELSE 0 END) as featured_jobs_count,
        SUM(CASE WHEN work_arrangement = 'Remote' THEN 1 ELSE 0 END) as remote_jobs_count,
        SUM(CASE WHEN work_arrangement = 'Hybrid' THEN 1 ELSE 0 END) as hybrid_jobs_count
      FROM jobs 
      ${whereCondition}
    `, queryParams);
    
    const row = result.rows[0];
    return {
      total_jobs: parseInt(row.total_jobs),
      active_jobs: parseInt(row.active_jobs),
      paused_jobs: parseInt(row.paused_jobs),
      closed_jobs: parseInt(row.closed_jobs),
      total_applications: parseInt(row.total_applications),
      average_applications_per_job: parseFloat(row.average_applications_per_job),
      featured_jobs_count: parseInt(row.featured_jobs_count),
      remote_jobs_count: parseInt(row.remote_jobs_count),
      hybrid_jobs_count: parseInt(row.hybrid_jobs_count)
    };
  }

  async bookmarkJob(jobId: string, jobseekerId: string): Promise<JobBookmark> {
    // Check if bookmark already exists
    const existingBookmark = await this.db.query(
      'SELECT id FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2',
      [jobId, jobseekerId]
    );
    
    if (existingBookmark.rows.length > 0) {
      throw new Error('Job already bookmarked');
    }
    
    const result = await this.db.query(`
      INSERT INTO job_bookmarks (job_id, jobseeker_id)
      VALUES ($1, $2)
      RETURNING *
    `, [jobId, jobseekerId]);
    
    return result.rows[0] as JobBookmark;
  }

  async removeBookmark(jobId: string, jobseekerId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2 RETURNING id',
      [jobId, jobseekerId]
    );
    
    return result.rows.length > 0;
  }

  async getBookmarkedJobs(jobseekerId: string, query: JobQuery = {}): Promise<{ jobs: JobWithCompany[]; total: number }> {
    const { 
      page = 1, 
      limit = 10,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = query;
    
    const offset = (page - 1) * limit;
    
    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'salary_max'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'ASC' ? 'ASC' : 'DESC';
    
    const baseQuery = `
      FROM job_bookmarks jb
      INNER JOIN jobs j ON jb.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE jb.jobseeker_id = $1
    `;
    
    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total ${baseQuery}
    `, [jobseekerId]);
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get bookmarked jobs with pagination
    const jobsResult = await this.db.query(`
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
  }

  async isJobBookmarked(jobId: string, jobseekerId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM job_bookmarks WHERE job_id = $1 AND jobseeker_id = $2',
      [jobId, jobseekerId]
    );
    
    return result.rows.length > 0;
  }

  async getJobViews(jobId: string, page: number = 1, limit: number = 10): Promise<{ views: JobView[]; total: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.db.query(
      'SELECT COUNT(*) as total FROM job_views WHERE job_id = $1',
      [jobId]
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get views with pagination
    const viewsResult = await this.db.query(`
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
  }

  async updateJobApplicationCount(jobId: string): Promise<void> {
    await this.db.query(`
      UPDATE jobs 
      SET applications_count = (
        SELECT COUNT(*) 
        FROM job_applications 
        WHERE job_id = $1
      )
      WHERE id = $1
    `, [jobId]);
  }

  async getFeaturedJobs(limit: number = 5): Promise<JobWithCompany[]> {
    const result = await this.db.query(`
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
  }

  async getRecentJobs(limit: number = 10): Promise<JobWithCompany[]> {
    const result = await this.db.query(`
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
  }

  async getPopularJobs(limit: number = 10): Promise<JobWithCompany[]> {
    const result = await this.db.query(`
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
  }

  async searchJobsBySkills(skills: string[], limit: number = 10): Promise<JobWithCompany[]> {
    const result = await this.db.query(`
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
  }

  async getJobsByLocation(location: string, limit: number = 10): Promise<JobWithCompany[]> {
    const result = await this.db.query(`
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
  }
}