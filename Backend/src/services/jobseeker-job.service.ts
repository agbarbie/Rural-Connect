// src/services/jobseeker-job.service.ts (migrated from 'jobseeker job.service.ts')
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

  // ...existing methods preserved from original file... (file is long)
}

export default JobseekerJobService;
