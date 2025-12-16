// src/controllers/candidates.controller.ts - FIXED WITH DISTINCT VALUES

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

        console.log('🔍 === CANDIDATES QUERY DEBUG ===');
        console.log('Employer User ID from JWT:', employerUserId);

        // Log the employer lookup
        const employerResultDebug = await pool.query(
          `SELECT id as employer_id, user_id, company_id
           FROM employers
           WHERE user_id = $1`,
          [employerUserId]
        );

        console.log('Employer query result:', employerResultDebug.rows);

        if (employerResultDebug.rows.length === 0) {
          console.error('❌ No employer record found!');
          console.error('Available employers in database:');

          const allEmployers = await pool.query(
            'SELECT id, user_id, company_id FROM employers LIMIT 10'
          );
          console.table(allEmployers.rows);

          return res.status(404).json({
            success: false,
            message: 'Employer profile not found. Please contact support.',
            debug: {
              userId: employerUserId,
              employersFound: allEmployers.rows.length
            }
          });
        }

        const employerIdDebug = employerResultDebug.rows[0].employer_id;
        console.log('✅ Found employer_id:', employerIdDebug);

        // Log job applications
        const applicationsCheck = await pool.query(
          `SELECT COUNT(*) as count
           FROM job_applications ja
           INNER JOIN jobs j ON ja.job_id = j.id
           WHERE j.employer_id = $1`,
          [employerIdDebug]
        );

        console.log(`📊 Total applications for this employer: ${applicationsCheck.rows[0].count}`);
        console.log('🔍 === END DEBUG ===\n');
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
      
      // 🔥 FIXED QUERY: Use DISTINCT to prevent duplicates in aggregation
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
          
          -- CV details (get primary or most recent CV)
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
          
          -- 🔥 FIXED: Use DISTINCT inside json_agg to prevent duplicates
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'skill_name', s.skill_name,
              'skill_level', s.skill_level,
              'category', s.category
            )) FILTER (WHERE s.id IS NOT NULL),
            '[]'::json
          ) as skills,
          
          -- 🔥 FIXED: DISTINCT for work experience
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'company', we.company,
              'position', we.position,
              'start_date', we.start_date,
              'end_date', we.end_date,
              'is_current', we.is_current,
              'responsibilities', we.responsibilities,
              'achievements', we.achievements
            ) ORDER BY jsonb_build_object(
              'company', we.company,
              'position', we.position,
              'start_date', we.start_date,
              'end_date', we.end_date,
              'is_current', we.is_current,
              'responsibilities', we.responsibilities,
              'achievements', we.achievements
            )) FILTER (WHERE we.id IS NOT NULL),
            '[]'::json
          ) as work_experience,
          
          -- 🔥 FIXED: DISTINCT for certifications
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'certification_name', cert.certification_name,
              'issuer', cert.issuer,
              'date_issued', cert.date_issued,
              'credential_id', cert.credential_id
            ) ORDER BY jsonb_build_object(
              'certification_name', cert.certification_name,
              'issuer', cert.issuer,
              'date_issued', cert.date_issued,
              'credential_id', cert.credential_id
            )) FILTER (WHERE cert.id IS NOT NULL),
            '[]'::json
          ) as certifications,
          
          -- 🔥 FIXED: DISTINCT for education
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'institution', edu.institution,
              'degree', edu.degree,
              'field_of_study', edu.field_of_study,
              'start_year', edu.start_year,
              'end_year', edu.end_year
            ) ORDER BY jsonb_build_object(
              'institution', edu.institution,
              'degree', edu.degree,
              'field_of_study', edu.field_of_study,
              'start_year', edu.start_year,
              'end_year', edu.end_year
            )) FILTER (WHERE edu.id IS NOT NULL),
            '[]'::json
          ) as education,
          
          -- 🔥 FIXED: DISTINCT for projects
          COALESCE(
            json_agg(DISTINCT jsonb_build_object(
              'project_name', proj.project_name,
              'description', proj.description,
              'technologies', proj.technologies,
              'github_link', proj.github_link,
              'demo_link', proj.demo_link
            ) ORDER BY jsonb_build_object(
              'project_name', proj.project_name,
              'description', proj.description,
              'technologies', proj.technologies,
              'github_link', proj.github_link,
              'demo_link', proj.demo_link
            )) FILTER (WHERE proj.id IS NOT NULL),
            '[]'::json
          ) as projects
          
        FROM job_applications ja
        INNER JOIN jobs j ON ja.job_id = j.id
        INNER JOIN users u ON ja.user_id = u.id
        
        -- Get primary CV or most recent CV
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
      
      // Get total count
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
      
      // Process candidates
      const candidates = result.rows.map(row => {
        // Parse aggregated JSON fields (already deduplicated by DISTINCT)
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
          
          // Skills and certifications (already deduplicated)
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
          
          // Education (already deduplicated)
          education: education.map((edu: any) => ({
            degree: edu.degree,
            institution: edu.institution,
            year: edu.end_year || new Date().getFullYear()
          })),
          
          // Contact
          email: row.email,
          phone: row.phone,
          
          // Additional aggregated data (already deduplicated)
          projects: projects
        };
      });
      
      // Check shortlist status
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
      
      console.log('✅ Returning', candidates.length, 'candidates with deduplicated data');
      
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
    if (!jobSkills || jobSkills.length === 0) return 85;
    if (!candidateSkills || candidateSkills.length === 0) return 60;
    
    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());
    const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase().trim());
    
    const matches = normalizedCandidateSkills.filter(skill =>
      normalizedJobSkills.some(jobSkill => 
        jobSkill.includes(skill) || skill.includes(jobSkill)
      )
    ).length;
    
    const matchPercentage = (matches / normalizedJobSkills.length) * 100;
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
      const endDate = exp.current || exp.is_current
        ? new Date() 
        : new Date(exp.end_date || exp.endDate || new Date());
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                      (endDate.getMonth() - startDate.getMonth());
        totalMonths += Math.max(0, months);
      }
    });
    
    return Math.round(totalMonths / 12 * 10) / 10;
  }

  /**
   * Get employer's job posts with application counts
   */
  async getJobPosts(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }
      
      const employerQuery = `SELECT e.id as employer_id FROM employers e WHERE e.user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);
      
      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employer profile not found'
        });
      }
      
      const employerId = employerResult.rows[0].employer_id;
      
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
   */
 async getCandidateProfile(req: AuthenticatedRequest, res: Response): Promise<Response> {
  try {
    const userId = req.user?.id;
    const { userId: candidateUserId } = req.params;
    const { jobId } = req.query;
    
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
    
    // Verify employer has access to this candidate (through job applications)
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
    
    // 🔥 ENHANCED QUERY: Fetch complete candidate profile with CV data
    const query = `
      SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.name,
      u.email,
      u.phone,
      u.profile_picture as profile_image,  -- ✅ Select as profile_image
      jp.location,
      jp.bio,
      jp.skills,
      jp.years_of_experience,
      jp.current_position,
      jp.availability_status,
      jp.linkedin_url,
      jp.github_url,
      jp.portfolio_url as website_url
      FROM users u
      LEFT JOIN jobseeker_profiles jp ON u.id = jp.user_id
      WHERE u.id = $1 AND u.user_type = 'jobseeker'
      LIMIT 1
    `;
    
    const queryParams = jobId ? [candidateUserId, employerId, jobId] : [candidateUserId, employerId];
    const result = await pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    const row = result.rows[0];
    
    // 🔥 CONSTRUCT PROFILE IMAGE URL
    let profileImage = 'https://ui-avatars.com/api/?name=' + 
      encodeURIComponent(row.full_name || `${row.first_name} ${row.last_name}`) +
      '&background=4285f4&color=fff&size=128';
    
    if (row.profile_image) {
      // If it's already a full URL, use as is
      if (row.profile_image.startsWith('http')) {
        profileImage = row.profile_image;
      } else {
        // Construct full URL for relative paths
        const baseUrl = process.env.API_URL || 'http://localhost:5000';
        profileImage = `${baseUrl}${row.profile_image.startsWith('/') ? '' : '/'}${row.profile_image}`;
      }
    }
    
    // Parse aggregated fields
    const cvSkills = Array.isArray(row.cv_skills) ? row.cv_skills : [];
    const profileSkills = this.parseJsonField(row.profile_skills);
    const allSkills = [...new Set([...cvSkills.map((s: any) => s.skill_name), ...profileSkills])];
    
    const workExperience = Array.isArray(row.work_experience) ? row.work_experience : [];
    const certifications = Array.isArray(row.certifications) ? row.certifications : [];
    const education = Array.isArray(row.education) ? row.education : [];
    const projects = Array.isArray(row.projects) ? row.projects : [];
    
    // Format the complete candidate profile
    const candidateProfile = {
      // Basic info
      user_id: row.user_id,
      name: row.full_name || `${row.first_name} ${row.last_name}`,
      email: row.email,
      phone: row.cv_phone || row.phone,
      location: row.address || row.location,
      profile_image: profileImage,
      
      // Professional summary
      bio: row.professional_summary || row.bio,
      title: workExperience.length > 0 ? workExperience[0].position : 'Job Seeker',
      
      // Career info
      years_of_experience: row.years_of_experience || this.calculateTotalExperience(workExperience),
      current_position: row.current_position || (workExperience.length > 0 ? workExperience[0].position : null),
      availability_status: row.availability_status,
      
      // Skills
      skills: allSkills,
      cv_skills: cvSkills,
      
      // Work experience
      work_experience: workExperience.map((exp: any) => ({
        company: exp.company,
        position: exp.position,
        start_date: exp.start_date,
        end_date: exp.end_date,
        is_current: exp.is_current,
        duration: this.calculateDuration(exp.start_date, exp.end_date, exp.is_current),
        responsibilities: exp.responsibilities ? exp.responsibilities.split('\n').filter((r: string) => r.trim()) : [],
        achievements: exp.achievements ? exp.achievements.split('\n').filter((a: string) => a.trim()) : []
      })),
      
      // Education
      education: education.map((edu: any) => ({
        institution: edu.institution,
        degree: edu.degree,
        field_of_study: edu.field_of_study,
        start_year: edu.start_year,
        end_year: edu.end_year
      })),
      
      // Certifications
      certifications: certifications.map((cert: any) => ({
        name: cert.certification_name,
        issuer: cert.issuer,
        date_issued: cert.date_issued,
        credential_id: cert.credential_id
      })),
      
      // Projects
      projects: projects.map((proj: any) => ({
        name: proj.project_name,
        description: proj.description,
        technologies: proj.technologies ? proj.technologies.split(',').map((t: string) => t.trim()) : [],
        github_link: proj.github_link,
        demo_link: proj.demo_link
      })),
      
      // Social links
      social_links: {
        linkedin: row.cv_linkedin || row.linkedin_url,
        github: row.cv_github || row.github_url,
        portfolio: row.cv_portfolio || row.portfolio_url,
        website: row.cv_website
      },
      
      // Application details (if jobId provided)
      application: row.application_id ? {
        id: row.application_id,
        status: row.application_status,
        cover_letter: row.cover_letter,
        expected_salary: row.expected_salary,
        availability_date: row.availability_date,
        applied_at: row.applied_at
      } : null,
      
      // Preferences
      preferences: {
        job_types: this.parseJsonField(row.preferred_job_types),
        locations: this.parseJsonField(row.preferred_locations),
        salary_min: row.salary_expectation_min,
        salary_max: row.salary_expectation_max
      },
      
      // CV metadata
      cv_info: {
        cv_id: row.cv_id,
        cv_status: row.cv_status,
        last_updated: row.cv_updated_at
      }
    };
    
    return res.json({
      success: true,
      data: candidateProfile
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

private parseJsonField(field: any): string[] {
  if (!field) return [];
  try {
    if (typeof field === 'string') {
      return JSON.parse(field);
    }
    if (Array.isArray(field)) {
      return field;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Helper: Calculate duration between dates
 */
private calculateDuration(startDate: string, endDate: string | null, isCurrent: boolean): string {
  const start = new Date(startDate);
  const end = isCurrent ? new Date() : (endDate ? new Date(endDate) : new Date());
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years > 0 && remainingMonths > 0) {
    return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
  } else if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''}`;
  } else {
    return `${remainingMonths || 1} month${remainingMonths > 1 ? 's' : ''}`;
  }
}

  /**
   * Toggle shortlist status
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