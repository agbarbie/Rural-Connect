// src/controllers/jobseeker-job.controller.ts - renamed from 'Jobseeker job.controller.ts'
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { JobseekerJobService } from '../services/jobseeker-job.service';
import { validate as isValidUUID } from 'uuid';

export class JobseekerJobController {
  private jobseekerJobService: JobseekerJobService;

  constructor() {
    this.jobseekerJobService = new JobseekerJobService();
  }

  // Get all jobs with filters for job explorer
  getAllJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
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
      } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        location: location as string,
        jobType: jobType as string,
        salaryMin: salaryMin ? parseInt(salaryMin as string) : undefined,
        salaryMax: salaryMax ? parseInt(salaryMax as string) : undefined,
        category: category as string,
        level: level as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const userId = req.user?.id;
      const result = await this.jobseekerJobService.getAllJobs(filters, userId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Withdraw application by job ID (convenience endpoint)
  withdrawApplicationByJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      // @ts-ignore
      const result = await this.jobseekerJobService.withdrawApplicationByJob(userId, jobId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Get job details for public viewing
  getJobDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      const userId = req.user?.id;
      // @ts-ignore
      const job = await this.jobseekerJobService.getJobDetails(jobId, userId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: job
      });
    } catch (error) {
      next(error);
    }
  };

  // Get recommended jobs for jobseeker
  getRecommendedJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10 } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await this.jobseekerJobService.getRecommendedJobs(userId, filters);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Save a job
  saveJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      // @ts-ignore
      const result = await this.jobseekerJobService.saveJob(userId, jobId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Job saved successfully',
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  };

  // Unsave a job
  unsaveJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      // @ts-ignore
      const result = await this.jobseekerJobService.unsaveJob(userId, jobId);

      res.status(200).json({
        success: true,
        message: 'Job removed from saved list',
        data: { removed: result }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get saved jobs
  getSavedJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10 } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await this.jobseekerJobService.getSavedJobs(userId, filters);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Apply to a job
  applyToJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;
      const { coverLetter, resumeId, portfolioUrl, expectedSalary, availabilityDate } = req.body;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      const applicationData = {
        coverLetter,
        resumeId,
        portfolioUrl,
        expectedSalary,
        availabilityDate
      };

      // @ts-ignore
      const result = await this.jobseekerJobService.applyToJob(userId, jobId, applicationData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  };

  // Get applied jobs
  getAppliedJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10, status } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string
      };

      const result = await this.jobseekerJobService.getAppliedJobs(userId, filters);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // Get application status for a specific job
  getApplicationStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user!.id;

      if (!isValidUUID(jobId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid job ID format'
        });
        return;
      }

      // @ts-ignore
      const application = await this.jobseekerJobService.getApplicationStatus(userId, jobId);

      res.status(200).json({
        success: true,
        data: application
      });
    } catch (error) {
      next(error);
    }
  };

  // Update application
  updateApplication = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      if (!isValidUUID(applicationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid application ID format'
        });
        return;
      }

      // @ts-ignore
      const result = await this.jobseekerJobService.updateApplication(userId, applicationId, updateData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application updated successfully',
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  };

  // Withdraw application by application ID
  withdrawApplication = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;

      if (!isValidUUID(applicationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid application ID format'
        });
        return;
      }

      // @ts-ignore
      const result = await this.jobseekerJobService.withdrawApplication(userId, applicationId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Application withdrawn successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Get jobseeker statistics
  getJobseekerStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await this.jobseekerJobService.getJobseekerStats(userId);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  };
}
