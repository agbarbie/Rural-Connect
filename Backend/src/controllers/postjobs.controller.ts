import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/job.service';
import { CreateJobRequest, UpdateJobRequest, JobQuery, Job } from '../types/job.types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import pool from '../db/db.config';

/**
 * Controller for handling job posting operations
 */
export class PostJobsController {
  private jobService: JobService;

  constructor() {
    // Create JobService instance without parameters since it imports pool directly
    this.jobService = new JobService();
  }

  /**
   * Get job applications for a specific job (for employers)
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async getJobApplications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // Verify job ownership
      // @ts-ignore
      const job = await this.jobService.getJobById(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      // Check ownership - simplified since we removed employer_id from interface
      if (job.employer_id !== userId && req.user?.user_type !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view applications for your own jobs'
        });
        return;
      }

      const { page = 1, limit = 10, status } = req.query;

      // @ts-ignore
      const applications = await this.jobService.getJobApplications(jobId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string
      });

      res.status(200).json({
        success: true,
        message: 'Job applications retrieved successfully',
        data: applications
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a new job posting
   * @param req Authenticated request containing job data
   * @param res Response object
   * @param next Error handling middleware
   */
  async createJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const jobData = req.body as CreateJobRequest;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can create job postings'
        });
        return;
      }

      // Validate required fields
      if (!jobData.title || !jobData.description || !jobData.location) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: title, description, and location are required'
        });
        return;
      }

      // Create the job using the service method
      const newJob = await this.jobService.createJob(userId, jobData);

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: newJob
      });
    } catch (error: any) {
      console.error('Error in createJob controller:', error);
      
      if (error.message === 'Employer not found') {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found. Please complete your employer registration.'
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Retrieves all jobs posted by the authenticated employer
   * @param req Authenticated request containing query parameters
   * @param res Response object
   * @param next Error handling middleware
   */
  async getMyJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can view their job postings'
        });
        return;
      }

      const query: JobQuery = {
        page: Number(req.query.page as string) || 1,
        limit: Math.min(Number(req.query.limit as string) || 10, 50),
        status: ['Open', 'Closed', 'Paused', 'Filled'].includes(req.query.status as string as string)
          ? (req.query.status as string as 'Open' | 'Closed' | 'Paused' | 'Filled')
          : undefined,
        employment_type: req.query.employment_type as string as string,
        work_arrangement: req.query.work_arrangement as string as string,
        search: req.query.search as string as string,
        sort_by: ['created_at', 'salary_max', 'applications_count', 'views_count'].includes(req.query.sort_by as string as string)
          ? (req.query.sort_by as string as 'created_at' | 'salary_max' | 'applications_count' | 'views_count')
          : 'created_at',
        sort_order: (req.query.sort_order as string === 'ASC' || req.query.sort_order as string === 'DESC')
          ? (req.query.sort_order as string as 'ASC' | 'DESC')
          : 'DESC'
      };

      const result = await this.jobService.getJobsByEmployer(userId, query);

      res.status(200).json({
        success: true,
        message: 'Jobs retrieved successfully',
        data: {
          jobs: result.jobs,
          pagination: {
            current_page: query.page,
            per_page: query.limit,
            total: result.total,
            total_pages: Math.ceil(result.total / (query.limit || 10))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves a specific job by ID if owned by the employer
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async getJobById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // @ts-ignore
      const job = await this.jobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      // Check ownership
      if (job.employer_id !== userId && req.user?.user_type !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view your own job postings'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Job retrieved successfully',
        data: job
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing job posting
   * @param req Authenticated request containing job ID and update data
   * @param res Response object
   * @param next Error handling middleware
   */
  async updateJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can update job postings'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      const { employment_type, work_arrangement, salary_min, salary_max, status } = req.body;

      if (employment_type) {
        const validEmploymentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
        if (!validEmploymentTypes.includes(employment_type)) {
          res.status(400).json({
            success: false,
            message: `Invalid employment type. Must be one of: ${validEmploymentTypes.join(', ')}`
          });
          return;
        }
      }

      if (work_arrangement) {
        const validWorkArrangements = ['Remote', 'Hybrid', 'On-site'];
        if (!validWorkArrangements.includes(work_arrangement)) {
          res.status(400).json({
            success: false,
            message: `Invalid work arrangement. Must be one of: ${validWorkArrangements.join(', ')}`
          });
          return;
        }
      }

      if (salary_min !== undefined && salary_max !== undefined && Number(salary_min) > Number(salary_max)) {
        res.status(400).json({
          success: false,
          message: 'Minimum salary cannot be greater than maximum salary'
        });
        return;
      }

      if (status) {
        const validStatuses = ['Open', 'Closed', 'Paused', 'Filled'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          });
          return;
        }
      }

      const updateData: UpdateJobRequest = {};
      const updatableFields = [
        'title', 'description', 'requirements', 'responsibilities',
        'location', 'employment_type', 'work_arrangement', 'salary_min',
        'salary_max', 'currency', 'skills_required', 'experience_level',
        'education_level', 'benefits', 'department', 'status',
        'application_deadline', 'is_featured'
      ];

      updatableFields.forEach(field => {
        if (req.body[field] !== undefined) {
          if (field === 'skills_required' && Array.isArray(req.body[field])) {
            updateData[field] = req.body[field].map((skill: string) => skill.trim());
          } else if (field === 'salary_min' || field === 'salary_max') {
            updateData[field] = req.body[field] ? Number(req.body[field]) : undefined;
          } else if (typeof req.body[field] === 'string') {
            (updateData as any)[field] = req.body[field].trim();
          } else {
            (updateData as any)[field] = req.body[field];
          }
        }
      });

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
        return;
      }

      // @ts-ignore
      const updatedJob = await this.jobService.updateJob(jobId, userId, updateData);

      if (!updatedJob) {
        res.status(404).json({
          success: false,
          message: 'Job not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Job updated successfully',
        data: updatedJob
      });
    } catch (error: any) {
      if (error.message === 'Job not found or unauthorized' || error.message === 'No valid fields to update') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Deletes a job posting
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async deleteJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can delete job postings'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // @ts-ignore
      const deleted = await this.jobService.deleteJob(jobId, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Job not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves job statistics for the employer
   * @param req Authenticated request
   * @param res Response object
   * @param next Error handling middleware
   */
  async getJobStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (req.user?.user_type !== 'employer') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only employers can view job statistics'
        });
        return;
      }

      const stats = await this.jobService.getJobStats(userId);

      res.status(200).json({
        success: true,
        message: 'Job statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves view analytics for a specific job
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async getJobViews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // @ts-ignore
      const job = await this.jobService.getJobById(jobId);
      
      if (!job || (job.employer_id !== userId && req.user?.user_type !== 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view analytics for your own jobs'
        });
        return;
      }

      const page = Number(req.query.page as string) || 1;
      const limit = Math.min(Number(req.query.limit as string) || 10, 100);

      // @ts-ignore
      const result = await this.jobService.getJobViews(jobId, page, limit);

      res.status(200).json({
        success: true,
        message: 'Job views retrieved successfully',
        data: {
          views: result.views,
          pagination: {
            current_page: page,
            per_page: limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggles job status between Open and Paused
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async toggleJobStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      console.log(`toggleJobStatus - userId: ${userId}, jobId: ${jobId}, user_type: ${req.user?.user_type}`);

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found in token'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // FIXED: Get employer_id from user_id first
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found for this user'
        });
        return;
      }

      const employerId = employerResult.rows[0].id;

      // @ts-ignore
      const job = await this.jobService.getJobById(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      // FIXED: Now compare employer_id with employer_id
      if (job.employer_id !== employerId) {
        console.log(`toggleJobStatus - Ownership check failed: job.employer_id=${job.employer_id}, employerId=${employerId}`);
        res.status(403).json({
          success: false,
          message: `Forbidden: You can only modify your own job postings`
        });
        return;
      }

      const newStatus = job.status === 'Open' ? 'Paused' : 'Open';
      // @ts-ignore
      const updatedJob = await this.jobService.updateJob(jobId, userId, { status: newStatus });

      res.status(200).json({
        success: true,
        message: `Job ${newStatus.toLowerCase()} successfully`,
        data: updatedJob
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marks a job as filled
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async markJobAsFilled(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // @ts-ignore
      const updatedJob = await this.jobService.updateJob(jobId, userId, { status: 'Filled' });

      if (!updatedJob) {
        res.status(404).json({
          success: false,
          message: 'Job not found or unauthorized'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Job marked as filled successfully',
        data: updatedJob
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a duplicate of an existing job
   * @param req Authenticated request containing job ID
   * @param res Response object
   * @param next Error handling middleware
   */
  async duplicateJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      console.log(`duplicateJob - userId: ${userId}, jobId: ${jobId}, user_type: ${req.user?.user_type}`);

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: User ID not found in token'
        });
        return;
      }

      if (!jobId) {
        res.status(400).json({
          success: false,
          message: 'Job ID is required'
        });
        return;
      }

      // FIXED: Get employer_id from user_id first
      const employerResult = await pool.query(
        'SELECT id FROM employers WHERE user_id = $1',
        [userId]
      );

      if (employerResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Employer profile not found for this user'
        });
        return;
      }

      const employerId = employerResult.rows[0].id;

      // @ts-ignore
      const originalJob = await this.jobService.getJobById(jobId);
      
      if (!originalJob) {
        res.status(404).json({
          success: false,
          message: 'Original job not found'
        });
        return;
      }

      // FIXED: Now compare employer_id with employer_id
      if (originalJob.employer_id !== employerId) {
        console.log(`duplicateJob - Ownership check failed: job.employer_id=${originalJob.employer_id}, employerId=${employerId}`);
        res.status(403).json({
          success: false,
          message: `Forbidden: You can only duplicate your own job postings`
        });
        return;
      }

      const duplicateJobData: CreateJobRequest = {
        title: `${originalJob.title} (Copy)`,
        description: originalJob.description,
        requirements: originalJob.requirements,
        responsibilities: originalJob.responsibilities,
        location: originalJob.location,
        employment_type: originalJob.employment_type,
        work_arrangement: originalJob.work_arrangement,
        salary_min: originalJob.salary_min,
        salary_max: originalJob.salary_max,
        currency: originalJob.currency,
        skills_required: originalJob.skills_required,
        experience_level: originalJob.experience_level,
        education_level: originalJob.education_level,
        benefits: originalJob.benefits,
        department: originalJob.department,
        is_featured: false
      };

      const duplicatedJob = await this.jobService.createJob(userId, duplicateJobData);

      res.status(201).json({
        success: true,
        message: 'Job duplicated successfully',
        data: duplicatedJob
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates the status of a job application and notifies the jobseeker
   * @param req Authenticated request containing application ID and new status
   * @param res Response object
   * @param next Error handling middleware
   */
  async updateApplicationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized: User ID not found' });
        return;
      }

      if (!applicationId) {
        res.status(400).json({ success: false, message: 'Application ID is required' });
        return;
      }

      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required' });
        return;
      }

      const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted', 'withdrawn'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        return;
      }

      // @ts-ignore
      const result = await this.jobService.updateApplicationStatus(applicationId, userId, status);

      if (result.success) {
        res.status(200).json({ success: true, message: result.message, data: result.application });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      next(error);
    }
  }
}
