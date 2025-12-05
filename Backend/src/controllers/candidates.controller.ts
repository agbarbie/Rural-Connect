// src/controllers/candidates.controller.ts - FULLY FIXED VERSION
import { Request, Response } from 'express';
import pool from '../db/db.config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class CandidatesController {
/**
 * Get all candidates (applicants) for employer's jobs
 * GET /api/employer/candidates
 */
async getCandidates(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const employerUserId = req.user?.id;
    console.log('🔍 GET CANDIDATES - Employer User ID:', employerUserId);
    
    const {
      job_id,
      match_score_min,
      location,
      experience,
      training,
      sort_by = 'newest',
      page = 1,
      limit = 10
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get employer_id from user_id
    const employerQuery = `
      SELECT id as employer_id
      FROM employers
      WHERE user_id = $1
    `;
    
    const employerResult = await pool.query(employerQuery, [employerUserId]);
    
    if (employerResult.rows.length === 0) {
      console.error('❌ No employer record found for user:', employerUserId);
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }
    
    const employerId = employerResult.rows[0].employer_id;
    console.log('✅ Found employer_id:', employerId);
    
    // Build WHERE conditions
    let whereConditions = [
      'j.employer_id = $1',
      "ja.status NOT IN ('withdrawn', 'cancelled')"
    ];
    const queryParams: any[] = [employerId];
    let paramIndex = 2;
    
    // Filter by specific job
    if (job_id) {
      whereConditions.push(`ja.job_id = $${paramIndex}`);
      queryParams.push(job_id);
      paramIndex++;
    }
    
    // Filter by location (from normalized personal_info table)
    if (location) {
      whereConditions.push(`pi.address ILIKE $${paramIndex}`);
      queryParams.push(`%${location}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Add LIMIT and OFFSET
    const limitIndex = paramIndex;
    const offsetIndex = paramIndex + 1;
    queryParams.push(Number(limit), offset);
    
    console.log('📊 Query params:', queryParams);
    console.log('🔍 WHERE clause:', whereClause);
    
    // FIXED QUERY: Use normalized tables with json_agg for JSON reconstruction
    // Prioritizes primary CV, aggregates sections into JSON arrays
    const query = `
      SELECT
        u.id as user_id,
        u.first_name,
        u.last_name,
        COALESCE(u.first_name || ' ' || u.last_name, u.email) as name,
        u.email,
        u.created_at as user_created_at,
        
        -- Application details
        ja.id as application_id,
        ja.job_id,
        ja.status as application_status,
        ja.cover_letter,
        ja.expected_salary,
        ja.availability_date,
        ja.applied_at,
        ja.updated_at as last_updated,
        
        -- Job details
        j.title as job_title,
        j.employment_type,
        j.work_arrangement,
        j.skills_required,
        
        -- Company info
        c.name as company_name,
        
        -- CV details (get primary or most recent CV) - explicit columns only
        cv.id as cv_id,
        cv.status as cv_status,
        cv.is_primary,
        
        -- Personal info (from normalized table)
        pi.full_name,
        pi.phone,
        pi.address,
        pi.linkedin_url,
        pi.website_url,
        pi.professional_summary,
        pi.profile_image,
        
        -- Aggregated skills (as JSON array)
        COALESCE(
          json_agg(
            jsonb_build_object(
              'skill_name', s.skill_name,
              'skill_level', s.skill_level,
              'category', s.category
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) as skills,
        
        -- Aggregated work experience (as JSON array)
        COALESCE(
          json_agg(
            jsonb_build_object(
              'company', we.company,
              'position', we.position,
              'start_date', we.start_date,
              'end_date', we.end_date,
              'is_current', we.is_current,
              'responsibilities', we.responsibilities,
              'achievements', we.achievements
            )
          ) FILTER (WHERE we.id IS NOT NULL),
          '[]'::json
        ) as work_experience,
        
        -- Aggregated certifications (as JSON array)
        COALESCE(
          json_agg(
            jsonb_build_object(
              'certification_name', cert.certification_name,
              'issuer', cert.issuer,
              'date_issued', cert.date_issued,
              'credential_id', cert.credential_id
            )
          ) FILTER (WHERE cert.id IS NOT NULL),
          '[]'::json
        ) as certifications,
        
        -- Aggregated education (as JSON array)
        COALESCE(
          json_agg(
            jsonb_build_object(
              'institution', edu.institution,
              'degree', edu.degree,
              'field_of_study', edu.field_of_study,
              'start_year', edu.start_year,
              'end_year', edu.end_year
            )
          ) FILTER (WHERE edu.id IS NOT NULL),
          '[]'::json
        ) as education,
        
        -- Aggregated projects (as JSON array)
        COALESCE(
          json_agg(
            jsonb_build_object(
              'project_name', proj.project_name,
              'description', proj.description,
              'technologies', proj.technologies,
              'github_link', proj.github_link,
              'demo_link', proj.demo_link
            )
          ) FILTER (WHERE proj.id IS NOT NULL),
          '[]'::json
        ) as projects
        
      FROM job_applications ja
      INNER JOIN jobs j ON ja.job_id = j.id
      INNER JOIN users u ON ja.user_id = u.id
      
      -- Get primary CV or most recent CV (select explicit columns only to avoid unexpected json columns)
      LEFT JOIN LATERAL (
        SELECT id, status, is_primary
        FROM cvs
        WHERE user_id = u.id
        ORDER BY is_primary DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) cv ON true
      
      -- Join normalized CV sections
      LEFT JOIN cv_personal_info pi ON cv.id = pi.cv_id
      LEFT JOIN cv_skills s ON cv.id = s.cv_id
      LEFT JOIN cv_work_experience we ON cv.id = we.cv_id
      LEFT JOIN cv_certifications cert ON cv.id = cert.cv_id
      LEFT JOIN cv_education edu ON cv.id = edu.cv_id
      LEFT JOIN cv_projects proj ON cv.id = proj.cv_id
      
      LEFT JOIN employers e ON j.employer_id = e.id
      LEFT JOIN companies c ON e.company_id = c.id
      
      WHERE ${whereClause}
      
      GROUP BY
        u.id, u.first_name, u.last_name, u.email, u.created_at,
        ja.id, ja.job_id, ja.status, ja.cover_letter, ja.expected_salary,
        ja.availability_date, ja.applied_at, ja.updated_at,
        j.title, j.employment_type, j.work_arrangement, j.skills_required,
        c.name,
        cv.id, cv.status, cv.is_primary,
        pi.full_name, pi.phone, pi.address, pi.linkedin_url,
        pi.website_url, pi.professional_summary, pi.profile_image
        
      ORDER BY ${this.getSortField(String(sort_by))}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;
    
    console.log('🔍 Executing main query...');
    const result = await pool.query(query, queryParams);
    console.log('✅ Query returned', result.rows.length, 'candidates');
    
    // Get total count (unchanged)
    const countQuery = `
      SELECT COUNT(DISTINCT ja.id) as total
      FROM job_applications ja
      INNER JOIN jobs j ON ja.job_id = j.id
      WHERE j.employer_id = $1
        AND ja.status NOT IN ('withdrawn', 'cancelled')
        ${job_id ? 'AND ja.job_id = $2' : ''}
    `;
    
    const countParams = job_id ? [employerId, job_id] : [employerId];
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);
    console.log('📊 Total candidates:', totalCount);
    
    // Process candidates (updated to use aggregated JSON fields)
    const candidates = result.rows.map(row => {
      // Parse aggregated JSON fields
      const skills = Array.isArray(row.skills) ? row.skills : [];
      const workExperience = Array.isArray(row.work_experience) ? row.work_experience : [];
      const certifications = Array.isArray(row.certifications) ? row.certifications : [];
      const education = Array.isArray(row.education) ? row.education : [];
      const projects = Array.isArray(row.projects) ? row.projects : [];
      
      // Extract skill names for matching
      const skillNames = skills.map((s: any) => s.skill_name).filter(Boolean);
      
      // Calculate match score
      const jobSkills = row.skills_required || [];
      const matchScore = this.calculateMatchScore(skillNames, jobSkills);
      
      // Format experience string
      const experience = workExperience.length > 0
        ? `${workExperience.length} position(s) • ${this.calculateTotalExperience(workExperience)} years`
        : 'No experience listed';
      
      const recentWork = workExperience.length > 0
        ? `${workExperience[0].position} at ${workExperience[0].company}`
        : 'No recent work history';
      
      // Get profile image
      const profilePicture = row.profile_image ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=4285f4&color=fff&size=128`;
      
      return {
        id: row.user_id,
        application_id: row.application_id,
        name: row.full_name || row.name || 'Applicant',
        title: workExperience[0]?.position || 'Job Seeker',
        profile_picture: profilePicture,
        match_score: matchScore,
        
        // Skills and certifications
        skills: skillNames,
        certifications: certifications.map((cert: any) => ({
          name: cert.certification_name,
          issuer: cert.issuer,
          verified: !!cert.date_issued,
          date_issued: cert.date_issued
        })),
        
        // Experience
        experience: experience,
        recent_work: recentWork,
        
        // Location and availability
        location: row.address || 'Not specified',
        availability: row.availability_date
          ? `Available from ${new Date(row.availability_date).toLocaleDateString()}`
          : 'Available immediately',
        
        // Application details
        application_status: row.application_status,
        applied_at: row.applied_at,
        cover_letter: row.cover_letter,
        expected_salary: row.expected_salary,
        
        // Activity status
        last_active: this.formatLastActive(row.applied_at),
        activity_status: 'Active',
        
        // Job details
        job_id: row.job_id,
        job_title: row.job_title,
        
        // Profile links
        portfolio_url: row.website_url || null,
        linkedin_url: row.linkedin_url || null,
        
        // Status flags
        is_shortlisted: false,
        is_selected: false,
        
        // Education
        education: education.map((edu: any) => ({
          degree: edu.degree,
          institution: edu.institution,
          year: edu.end_year || new Date().getFullYear()
        })),
        
        // Contact
        email: row.email,
        phone: row.phone,
        
        // Additional aggregated data
        projects: projects  // Pass through for full profile view
      };
    });
    
    // Check shortlist status (unchanged)
    if (candidates.length > 0) {
      const candidateIds = candidates.map(c => c.id);
      const shortlistQuery = `
        SELECT user_id
        FROM shortlisted_candidates
        WHERE employer_id = $1 AND user_id = ANY($2)
      `;
      
      try {
        const shortlistResult = await pool.query(shortlistQuery, [employerId, candidateIds]);
        const shortlistedIds = new Set(shortlistResult.rows.map(r => r.user_id));
        
        candidates.forEach(candidate => {
          candidate.is_shortlisted = shortlistedIds.has(candidate.id);
        });
        
        console.log('✅ Shortlist status checked');
      } catch (shortlistError) {
        console.log('⚠️ Shortlist check failed (non-critical):', shortlistError);
      }
    }
    
    console.log('✅ Returning', candidates.length, 'candidates with full data');
    
    return res.json({
      success: true,
      data: {
        data: candidates,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          total_pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching candidates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch candidates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

  /**
   * Calculate match score between candidate skills and job requirements
   */
  private calculateMatchScore(candidateSkills: string[], jobSkills: string[]): number {
    if (!jobSkills || jobSkills.length === 0) return 85; // Default score
    if (!candidateSkills || candidateSkills.length === 0) return 60;
    
    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());
    const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase().trim());
    
    const matches = normalizedCandidateSkills.filter(skill =>
      normalizedJobSkills.some(jobSkill => 
        jobSkill.includes(skill) || skill.includes(jobSkill)
      )
    ).length;
    
    const matchPercentage = (matches / normalizedJobSkills.length) * 100;
    
    // Bonus for having more skills than required
    const bonusSkills = Math.max(0, candidateSkills.length - jobSkills.length);
    const bonus = Math.min(bonusSkills * 2, 10);
    
    return Math.min(Math.round(matchPercentage + bonus), 100);
  }

  /**
   * Calculate total years of experience
   */
  private calculateTotalExperience(workExperience: any[]): number {
    if (!Array.isArray(workExperience) || workExperience.length === 0) return 0;
    
    let totalMonths = 0;
    
    workExperience.forEach(exp => {
      const startDate = new Date(exp.start_date || exp.startDate);
      const endDate = exp.current 
        ? new Date() 
        : new Date(exp.end_date || exp.endDate || new Date());
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());
        totalMonths += Math.max(0, months);
      }
    });
    
    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get employer's job posts with application counts
   * GET /api/employer/job-posts
   */
  async getJobPosts(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      
      console.log('🔍 Fetching job posts for user:', userId);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }
      
      // Get employer_id from user_id
      const employerQuery = `
        SELECT e.id as employer_id
        FROM employers e
        WHERE e.user_id = $1
      `;
      
      const employerResult = await pool.query(employerQuery, [userId]);
      
      if (employerResult.rows.length === 0) {
        console.error('❌ No employer record found for user:', userId);
        return res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
      }
      
      const employerId = employerResult.rows[0].employer_id;
      console.log('✅ Found employer_id:', employerId);
      
      // Get jobs with application counts
      const query = `
        SELECT
          j.id,
          j.title,
          j.status,
          j.created_at,
          j.employer_id,
          COUNT(DISTINCT ja.id) as application_count,
          COUNT(DISTINCT CASE WHEN ja.status = 'pending' THEN ja.id END) as pending_count,
          COUNT(DISTINCT CASE WHEN ja.status = 'reviewed' THEN ja.id END) as reviewed_count,
          COUNT(DISTINCT CASE WHEN ja.status = 'shortlisted' THEN ja.id END) as shortlisted_count
        FROM jobs j
        LEFT JOIN job_applications ja ON j.id = ja.job_id
        WHERE j.employer_id = $1
        GROUP BY j.id, j.title, j.status, j.created_at, j.employer_id
        ORDER BY j.created_at DESC
      `;
      
      const result = await pool.query(query, [employerId]);
      
      console.log('📊 Query result:', {
        rowCount: result.rows.length,
        employerId: employerId
      });
      
      const jobPosts = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        match_count: parseInt(row.application_count) || 0,
        pending_count: parseInt(row.pending_count) || 0,
        reviewed_count: parseInt(row.reviewed_count) || 0,
        shortlisted_count: parseInt(row.shortlisted_count) || 0,
        created_at: row.created_at
      }));
      
      console.log('✅ Processed job posts:', jobPosts.length);
      
      return res.json({
        success: true,
        data: jobPosts
      });
      
    } catch (error) {
      console.error('❌ Error fetching job posts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch job posts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get candidate full profile
   * GET /api/employer/candidates/:userId
   */
  async getCandidateProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const { userId: candidateUserId } = req.params;
      const { jobId } = req.query;
      
      console.log('🔍 Getting candidate profile:', {
        employerUserId: userId,
        candidateUserId,
        jobId
      });
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }
      
      // Get employer_id
      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);
      
      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
      }
      
      const employerId = employerResult.rows[0].employer_id;
      
      // Check access rights
      const accessCheck = await pool.query(
        `SELECT 1 FROM job_applications ja
         INNER JOIN jobs j ON ja.job_id = j.id
         WHERE ja.user_id = $1 AND j.employer_id = $2
         ${jobId ? 'AND ja.job_id = $3' : ''}
         LIMIT 1`,
        jobId ? [candidateUserId, employerId, jobId] : [candidateUserId, employerId]
      );
      
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this candidate profile'
        });
      }
      
      // Get candidate profile with CV (normalized schema)
      const query = `
        SELECT
          u.*,
          cv.id as cv_id,
          cv.status as cv_status,
          cv.updated_at as cv_updated_at,
          pi.full_name,
          pi.phone,
          pi.address,
          pi.linkedin_url,
          pi.website_url,
          pi.portfolio_url,
          pi.github_url,
          pi.professional_summary,
          pi.profile_image
        FROM users u
        LEFT JOIN LATERAL (
          SELECT * FROM cvs
          WHERE user_id = u.id
          ORDER BY is_primary DESC NULLS LAST, created_at DESC
          LIMIT 1
        ) cv ON true
        LEFT JOIN cv_personal_info pi ON cv.id = pi.cv_id
        WHERE u.id = $1
      `;
      
      const result = await pool.query(query, [candidateUserId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Candidate not found'
        });
      }
      
      const row = result.rows[0];
      
      const formattedCandidate = {
        ...row,
        cv_data: {
          id: row.cv_id,
          status: row.cv_status,
          updated_at: row.cv_updated_at,
          personal_info: {
            full_name: row.full_name || null,
            phone: row.phone || null,
            address: row.address || null,
            linkedin_url: row.linkedin_url || null,
            website_url: row.website_url || null,
            portfolio_url: row.portfolio_url || null,
            github_url: row.github_url || null,
            professional_summary: row.professional_summary || null,
            profile_image: row.profile_image || null
          }
        },
        portfolio_url: row.portfolio_url || null,
        github_url: row.github_url || null,
        linkedin_url: row.linkedin_url || null,
        website_url: row.website_url || null
      };
      
      console.log('✅ Candidate profile fetched successfully');
      
      return res.json({
        success: true,
        data: formattedCandidate
      });
      
    } catch (error) {
      console.error('❌ Error fetching candidate profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch candidate profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Toggle shortlist status
   * POST /api/employer/candidates/:userId/shortlist
   */
  async toggleShortlist(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const { userId: candidateUserId } = req.params;
      const { jobId } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }
      
      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);
      
      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
      }
      
      const employerId = employerResult.rows[0].employer_id;
      
      const checkQuery = `
        SELECT id FROM shortlisted_candidates
        WHERE employer_id = $1 AND user_id = $2 AND job_id = $3
      `;
      
      const checkResult = await pool.query(checkQuery, [employerId, candidateUserId, jobId]);
      
      if (checkResult.rows.length > 0) {
        await pool.query(
          'DELETE FROM shortlisted_candidates WHERE id = $1',
          [checkResult.rows[0].id]
        );
        
        return res.json({
          success: true,
          message: 'Candidate removed from shortlist',
          data: { is_shortlisted: false }
        });
      } else {
        await pool.query(
          `INSERT INTO shortlisted_candidates (employer_id, user_id, job_id)
           VALUES ($1, $2, $3)`,
          [employerId, candidateUserId, jobId]
        );
        
        await pool.query(
          `UPDATE job_applications
           SET status = 'shortlisted', updated_at = NOW()
           WHERE user_id = $1 AND job_id = $2`,
          [candidateUserId, jobId]
        );
        
        return res.json({
          success: true,
          message: 'Candidate added to shortlist',
          data: { is_shortlisted: true }
        });
      }
      
    } catch (error) {
      console.error('Error toggling shortlist:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update shortlist',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send invite to candidate
   * POST /api/employer/candidates/:userId/invite
   */
  async inviteCandidate(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      const { userId: candidateUserId } = req.params;
      const { jobId, message } = req.body;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }
      
      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);
      
      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
      }
      
      const employerId = employerResult.rows[0].employer_id;
      
      await pool.query(
        `INSERT INTO job_invitations (employer_id, user_id, job_id, message, status)
         VALUES ($1, $2, $3, $4, 'sent')`,
        [employerId, candidateUserId, jobId, message]
      );
      
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES ($1, 'job_invitation', 'Job Invitation', $2, $3)`,
        [
          candidateUserId,
          'You have been invited to apply for a position',
          JSON.stringify({ job_id: jobId, employer_id: employerId })
        ]
      );
      
      return res.json({
        success: true,
        message: 'Invitation sent successfully'
      });
      
    } catch (error) {
      console.error('Error sending invitation:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send invitation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Helper: Format last active time
   */
  private formatLastActive(lastLogin: Date | null): string {
    if (!lastLogin) return 'Recently active';
    
    const now = new Date();
    const diff = now.getTime() - new Date(lastLogin).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  }

  /**
   * Helper: Get sort field SQL
   */
  private getSortField(sortBy: string): string {
    const validSortFields: Record<string, string> = {
      'match_score': 'ja.applied_at DESC',
      'newest': 'ja.applied_at DESC',
      'recent_activity': 'ja.applied_at DESC',
      'bestMatch': 'ja.applied_at DESC',
      'mostExperienced': 'ja.applied_at DESC',
      'recentlyActive': 'ja.applied_at DESC'
    };
    
    return validSortFields[sortBy] || validSortFields['newest'];
  }
}