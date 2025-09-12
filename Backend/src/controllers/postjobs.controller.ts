// src/controllers/postjobs.controller.ts
import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/job.service';
import { CreateJobRequest, UpdateJobRequest, JobQuery } from '../types/job.types';
type AuthRequest = Request & { user?: { id?: string; user_type?: string } }; 

export class PostJobsController {
  constructor(private jobService: JobService) {}

  // Create a new job posting
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.user?.id;
      
      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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
      const {
        title,
        description,
        location,
        employment_type,
        work_arrangement,
        skills_required
      } = req.body as CreateJobRequest;

      if (!title || !description || !location || !employment_type || !work_arrangement) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: title, description, location, employment_type, work_arrangement are required'
        });
        return;
      }

      if (!skills_required || !Array.isArray(skills_required) || skills_required.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one skill is required'
        });
        return;
      }

      // Validate employment_type
      const validEmploymentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
      if (!validEmploymentTypes.includes(employment_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid employment type. Must be one of: ' + validEmploymentTypes.join(', ')
        });
        return;
      }

      // Validate work_arrangement
      const validWorkArrangements = ['Remote', 'Hybrid', 'On-site'];
      if (!validWorkArrangements.includes(work_arrangement)) {
        res.status(400).json({
          success: false,
          message: 'Invalid work arrangement. Must be one of: ' + validWorkArrangements.join(', ')
        });
        return;
      }

      // Validate salary range if provided
      const { salary_min, salary_max } = req.body;
      if (salary_min && salary_max && salary_min > salary_max) {
        res.status(400).json({
          success: false,
          message: 'Minimum salary cannot be greater than maximum salary'
        });
        return;
      }

      const jobData: CreateJobRequest = {
        title: title.trim(),
        description: description.trim(),
        requirements: req.body.requirements?.trim() || undefined,
        responsibilities: req.body.responsibilities?.trim() || undefined,
        location: location.trim(),
        employment_type,
        work_arrangement,
        salary_min: salary_min ? parseInt(salary_min) : undefined,
        salary_max: salary_max ? parseInt(salary_max) : undefined,
        currency: req.body.currency || 'USD',
        skills_required: skills_required.map((skill: string) => skill.trim()),
        experience_level: req.body.experience_level?.trim() || undefined,
        education_level: req.body.education_level?.trim() || undefined,
        benefits: req.body.benefits || undefined,
        department: req.body.department?.trim() || undefined,
        application_deadline: req.body.application_deadline || undefined,
        is_featured: req.body.is_featured || false
      };

      const job = await this.jobService.createJob(employerId, jobData);

      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job
      });
    } catch (error: any) {
      if (error.message === 'Employer not found' || error.message === 'Employer must be associated with a company to post jobs') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }
      next(error);
    }
  }

  // Get all jobs posted by the authenticated employer
  async getMyJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.user?.id;
      
      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 10, 50), // Max 50 per page
        status: req.query.status as any,
        employment_type: req.query.employment_type as string,
        work_arrangement: req.query.work_arrangement as string,
        search: req.query.search as string,
        sort_by: req.query.sort_by as any || 'created_at',
        sort_order: req.query.sort_order as any || 'DESC'
      };

      const result = await this.jobService.getJobsByEmployer(employerId, query);

      res.status(200).json({
        success: true,
        message: 'Jobs retrieved successfully',
        data: {
          jobs: result.jobs,
          pagination: {
            current_page: query.page,
            per_page: query.limit,
            total: result.total,
            total_pages: Math.ceil(result.total / query.limit!)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a specific job by ID (only if owned by the employer)
  async getJobById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      const job = await this.jobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      // Check if the job belongs to the authenticated employer
      if (job.employer_id !== employerId && req.user?.user_type !== 'admin') {
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

  // Update a job posting
  async updateJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      // Validate employment_type if provided
      const { employment_type, work_arrangement, salary_min, salary_max } = req.body;
      
      if (employment_type) {
        const validEmploymentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
        if (!validEmploymentTypes.includes(employment_type)) {
          res.status(400).json({
            success: false,
            message: 'Invalid employment type. Must be one of: ' + validEmploymentTypes.join(', ')
          });
          return;
        }
      }

      if (work_arrangement) {
        const validWorkArrangements = ['Remote', 'Hybrid', 'On-site'];
        if (!validWorkArrangements.includes(work_arrangement)) {
          res.status(400).json({
            success: false,
            message: 'Invalid work arrangement. Must be one of: ' + validWorkArrangements.join(', ')
          });
          return;
        }
      }

      // Validate salary range if both are provided
      if (salary_min !== undefined && salary_max !== undefined && salary_min > salary_max) {
        res.status(400).json({
          success: false,
          message: 'Minimum salary cannot be greater than maximum salary'
        });
        return;
      }

      // Validate status if provided
      if (req.body.status) {
        const validStatuses = ['Open', 'Closed', 'Paused', 'Filled'];
        if (!validStatuses.includes(req.body.status)) {
          res.status(400).json({
            success: false,
            message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
          });
          return;
        }
      }

      const updateData: UpdateJobRequest = {};

      // Only include fields that are provided in the request
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
            (updateData as any)[field] = req.body[field].map((skill: string) => skill.trim());
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

      const updatedJob = await this.jobService.updateJob(jobId, employerId, updateData);

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

  // Delete a job posting
  async deleteJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      const deleted = await this.jobService.deleteJob(jobId, employerId);

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

  // Get job statistics for the employer
  async getJobStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      const stats = await this.jobService.getJobStats(employerId);

      res.status(200).json({
        success: true,
        message: 'Job statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Get job views for a specific job
  async getJobViews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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
      const job = await this.jobService.getJobById(jobId);
      if (!job || (job.employer_id !== employerId && req.user?.user_type !== 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view analytics for your own jobs'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

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

  // Toggle job status (Open/Paused)
  async toggleJobStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      // Get current job status
      const job = await this.jobService.getJobById(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      if (job.employer_id !== employerId) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only modify your own job postings'
        });
        return;
      }

      // Toggle between Open and Paused
      const newStatus = job.status === 'Open' ? 'Paused' : 'Open';

      const updatedJob = await this.jobService.updateJob(jobId, employerId, { status: newStatus });

      res.status(200).json({
        success: true,
        message: `Job ${newStatus.toLowerCase()} successfully`,
        data: updatedJob
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark job as filled
  async markJobAsFilled(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      const updatedJob = await this.jobService.updateJob(jobId, employerId, { status: 'Filled' });

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

  // Duplicate/Clone a job posting
  async duplicateJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const employerId = req.user?.id;

      if (!employerId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: Employer ID not found'
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

      // Get the original job
      const originalJob = await this.jobService.getJobById(jobId);
      
      if (!originalJob) {
        res.status(404).json({
          success: false,
          message: 'Original job not found'
        });
        return;
      }

      if (originalJob.employer_id !== employerId) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only duplicate your own job postings'
        });
        return;
      }

      // Create new job data based on original
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
        is_featured: false // New jobs should not be featured by default
      };

      const duplicatedJob = await this.jobService.createJob(employerId, duplicateJobData);

      res.status(201).json({
        success: true,
        message: 'Job duplicated successfully',
        data: duplicatedJob
      });
    } catch (error) {
      next(error);
    }
  }
}