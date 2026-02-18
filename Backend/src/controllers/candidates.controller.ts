// src/controllers/candidates.controller.ts - FIXED FOR YOUR DATABASE SCHEMA

import { Request, Response } from "express";
import pool from "../db/db.config";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export class CandidatesController {
  /**
   * Get all candidates (applicants) with FULL PROFILE DATA + RATINGS
   * GET /api/employer/candidates
   */
  async getCandidates(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response> {
    try {
      const employerUserId = req.user?.id;
      console.log("🔍 GET CANDIDATES - Employer User ID:", employerUserId);

      const {
        job_id,
        match_score_min,
        location,
        experience,
        training,
        sort_by = "newest",
        page = 1,
        limit = 10,
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Get employer_id from user_id
      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [employerUserId]);

      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employer profile not found",
        });
      }

      const employerId = employerResult.rows[0].employer_id;
      console.log("✅ Found employer_id:", employerId);

      // Build WHERE conditions
      let whereConditions = [
        "j.employer_id = $1",
        "ja.status NOT IN ('withdrawn', 'cancelled')",
      ];
      const queryParams: any[] = [employerId];
      let paramIndex = 2;

      if (job_id) {
        whereConditions.push(`ja.job_id = $${paramIndex}`);
        queryParams.push(job_id);
        paramIndex++;
      }

      if (location) {
        whereConditions.push(`jp.location ILIKE $${paramIndex}`);
        queryParams.push(`%${location}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(" AND ");

      // Add LIMIT and OFFSET
      const limitIndex = paramIndex;
      const offsetIndex = paramIndex + 1;
      queryParams.push(Number(limit), offset);

      // ✅ FIXED QUERY: Proper aggregation with GROUP BY for ratings (rating is INTEGER not DECIMAL)
      const query = `
        SELECT
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.name,
          u.email,
          u.profile_picture,
          u.created_at as user_created_at,
          
          -- Jobseeker Profile
          jp.phone,
          jp.bio,
          jp.skills,
          jp.location,
          jp.linkedin_url,
          jp.github_url,
          jp.portfolio_url,
          jp.years_of_experience,
          jp.current_position,
          jp.availability_status,
          jp.preferred_job_types,
          jp.preferred_locations,
          jp.salary_expectation_min,
          jp.salary_expectation_max,
          
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
          
          -- ✅ FIXED: Rating statistics (rating is INTEGER)
          COALESCE(ROUND(AVG(r.rating::numeric), 1), 0) as average_rating,
          COUNT(r.id) as total_ratings,
          COUNT(CASE WHEN r.would_hire_again = true THEN 1 END) as would_hire_again_count
          
        FROM job_applications ja
        INNER JOIN jobs j ON ja.job_id = j.id
        INNER JOIN users u ON ja.user_id = u.id
        LEFT JOIN jobseeker_profiles jp ON u.id = jp.user_id
        LEFT JOIN employers e ON j.employer_id = e.id
        LEFT JOIN companies c ON e.company_id = c.id
        
        -- ✅ Join ratings table
        LEFT JOIN ratings r ON u.id = r.jobseeker_id
        
        WHERE ${whereClause}
        
        GROUP BY 
          u.id, u.first_name, u.last_name, u.name, u.email, u.profile_picture, u.created_at,
          jp.phone, jp.bio, jp.skills, jp.location, jp.linkedin_url, jp.github_url, 
          jp.portfolio_url, jp.years_of_experience, jp.current_position, jp.availability_status,
          jp.preferred_job_types, jp.preferred_locations, jp.salary_expectation_min, 
          jp.salary_expectation_max,
          ja.id, ja.job_id, ja.status, ja.cover_letter, ja.expected_salary, 
          ja.availability_date, ja.applied_at, ja.updated_at,
          j.title, j.employment_type, j.work_arrangement, j.skills_required,
          c.name
        
        ORDER BY ${this.getSortField(String(sort_by))}
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `;

      console.log("🔍 Executing query with ratings...");
      const result = await pool.query(query, queryParams);
      console.log("✅ Query returned", result.rows.length, "candidates");

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT ja.id) as total
        FROM job_applications ja
        INNER JOIN jobs j ON ja.job_id = j.id
        WHERE j.employer_id = $1
          AND ja.status NOT IN ('withdrawn', 'cancelled')
          ${job_id ? "AND ja.job_id = $2" : ""}
      `;

      const countParams = job_id ? [employerId, job_id] : [employerId];
      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].total);

      // Process candidates with ratings
      const candidates = result.rows.map((row) => {
        // Parse skills
        let skills: string[] = [];
        try {
          if (row.skills) {
            const parsed =
              typeof row.skills === "string"
                ? JSON.parse(row.skills)
                : row.skills;
            skills = Array.isArray(parsed) ? parsed : [];
          }
        } catch {
          skills = [];
        }

        // Calculate match score
        const jobSkills = row.skills_required || [];
        const matchScore = this.calculateMatchScore(skills, jobSkills);

        // Calculate experience string
        const experienceYears = row.years_of_experience || 0;
        const experience =
          experienceYears > 0
            ? `${experienceYears} years of experience`
            : "Entry level";

        // Get profile image
        const profilePicture = row.profile_picture
          ? row.profile_picture.startsWith("http")
            ? row.profile_picture
            : `${row.profile_picture}`
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || row.first_name + " " + row.last_name)}&background=4285f4&color=fff&size=128`;

        return {
          // Basic info
          id: row.user_id,
          application_id: row.application_id,
          name: row.name || `${row.first_name} ${row.last_name}`,
          email: row.email,
          phone: row.phone,

          // Profile data
          title: row.current_position || "Job Seeker",
          profile_picture: profilePicture,
          bio: row.bio || "",
          location: row.location || "Not specified",

          // Skills and match
          match_score: matchScore,
          skills: skills,

          // Experience
          experience: experience,
          years_of_experience: experienceYears,
          current_position: row.current_position,
          recent_work: row.current_position
            ? `Currently working as ${row.current_position}`
            : "No recent work history",

          // Availability
          availability: row.availability_date
            ? `Available from ${new Date(row.availability_date).toLocaleDateString()}`
            : "Available immediately",
          availability_status:
            row.availability_status || "open_to_opportunities",

          // Application details
          application_status: row.application_status,
          applied_at: row.applied_at,
          cover_letter: row.cover_letter,
          expected_salary: row.expected_salary,

          // Social links
          linkedin_url: row.linkedin_url,
          github_url: row.github_url,
          portfolio_url: row.portfolio_url,
          website_url: row.portfolio_url,

          // Job details
          job_id: row.job_id,
          job_title: row.job_title,

          // Career preferences
          preferred_job_types: this.parseJsonField(row.preferred_job_types),
          preferred_locations: this.parseJsonField(row.preferred_locations),
          salary_expectation_min: row.salary_expectation_min,
          salary_expectation_max: row.salary_expectation_max,

          // ✅ Rating information (safely parsed)
          average_rating: parseFloat(row.average_rating) || 0,
          total_ratings: parseInt(row.total_ratings) || 0,
          would_hire_again_count: parseInt(row.would_hire_again_count) || 0,
          success_rate: this.calculateSuccessRate(
            parseFloat(row.average_rating) || 0,
            parseInt(row.total_ratings) || 0
          ),

          // Status flags
          is_shortlisted: false,
          is_selected: false,

          // Activity
          last_active: this.formatLastActive(row.applied_at),
          activity_status: "Active",

          // Certifications & Education (placeholder)
          certifications: [],
          education: [],
        };
      });

      // Check shortlist status
      if (candidates.length > 0) {
        const candidateIds = candidates.map((c) => c.id);
        const shortlistQuery = `
          SELECT user_id
          FROM shortlisted_candidates
          WHERE employer_id = $1 AND user_id = ANY($2)
        `;

        try {
          const shortlistResult = await pool.query(shortlistQuery, [
            employerId,
            candidateIds,
          ]);
          const shortlistedIds = new Set(
            shortlistResult.rows.map((r) => r.user_id),
          );

          candidates.forEach((candidate) => {
            candidate.is_shortlisted = shortlistedIds.has(candidate.id);
          });
        } catch (shortlistError) {
          console.log(
            "⚠️ Shortlist check failed (non-critical):",
            shortlistError,
          );
        }
      }

      console.log(
        "✅ Returning",
        candidates.length,
        "candidates with ratings",
      );

      return res.json({
        success: true,
        data: {
          data: candidates,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: totalCount,
            total_pages: Math.ceil(totalCount / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching candidates:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch candidates",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * ✅ FIXED: Get candidate full profile with detailed ratings
   * GET /api/employer/candidates/:userId
   */
  async getCandidateProfile(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response> {
    try {
      const userId = req.user?.id;
      const { userId: candidateUserId } = req.params;
      const { jobId } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User ID not found",
        });
      }

      // Track profile view
      try {
        const trackViewQuery = `
          INSERT INTO profile_views (viewer_id, viewed_profile_id, viewed_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (viewer_id, viewed_profile_id) 
          DO UPDATE SET viewed_at = NOW()
        `;
        await pool.query(trackViewQuery, [userId, candidateUserId]);
        console.log(`✅ Tracked profile view: ${userId} viewed ${candidateUserId}`);
      } catch (viewError) {
        console.error("Failed to track profile view (non-critical):", viewError);
      }

      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);

      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employer profile not found",
        });
      }

      const employerId = employerResult.rows[0].employer_id;

      // Verify employer has access to this candidate
      const accessCheck = await pool.query(
        `SELECT 1 FROM job_applications ja
         INNER JOIN jobs j ON ja.job_id = j.id
         WHERE ja.user_id = $1 AND j.employer_id = $2
         ${jobId ? "AND ja.job_id = $3" : ""}
         LIMIT 1`,
        jobId
          ? [candidateUserId, employerId, jobId]
          : [candidateUserId, employerId],
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this candidate profile",
        });
      }

      // ✅ FIXED QUERY: Get full profile WITHOUT aggregation (we'll do separate query for ratings)
      const query = `
        SELECT 
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.name,
          u.email,
          u.profile_picture,
          
          -- Jobseeker Profile
          jp.phone,
          jp.bio,
          jp.skills,
          jp.location,
          jp.linkedin_url,
          jp.github_url,
          jp.portfolio_url,
          jp.years_of_experience,
          jp.current_position,
          jp.availability_status,
          jp.preferred_job_types,
          jp.preferred_locations,
          jp.salary_expectation_min,
          jp.salary_expectation_max,
          
          -- Application details
          ja.id as application_id,
          ja.status as application_status,
          ja.cover_letter,
          ja.expected_salary,
          ja.availability_date,
          ja.applied_at
          
        FROM users u
        LEFT JOIN jobseeker_profiles jp ON u.id = jp.user_id
        LEFT JOIN job_applications ja ON u.id = ja.user_id 
          ${jobId ? "AND ja.job_id = $2" : ""}
        WHERE u.id = $1 AND u.user_type = 'jobseeker'
        LIMIT 1
      `;

      const queryParams = jobId ? [candidateUserId, jobId] : [candidateUserId];
      const result = await pool.query(query, queryParams);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Candidate not found",
        });
      }

      const row = result.rows[0];

      // ✅ SEPARATE QUERY: Get rating statistics (rating is INTEGER in your schema)
      const ratingStatsQuery = `
        SELECT 
          COUNT(id) as total_ratings,
          COALESCE(ROUND(AVG(rating::numeric), 1), 0) as average_rating,
          COUNT(CASE WHEN would_hire_again = true THEN 1 END) as would_hire_again_count,
          
          -- Rating distribution
          COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1,
          
          -- Skill ratings averages (from JSONB)
          COALESCE(ROUND(AVG((skills_rating->>'technical')::numeric), 1), 0) as avg_technical,
          COALESCE(ROUND(AVG((skills_rating->>'communication')::numeric), 1), 0) as avg_communication,
          COALESCE(ROUND(AVG((skills_rating->>'professionalism')::numeric), 1), 0) as avg_professionalism,
          COALESCE(ROUND(AVG((skills_rating->>'quality')::numeric), 1), 0) as avg_quality,
          COALESCE(ROUND(AVG((skills_rating->>'timeliness')::numeric), 1), 0) as avg_timeliness
          
        FROM ratings
        WHERE jobseeker_id = $1
      `;

      const ratingStatsResult = await pool.query(ratingStatsQuery, [candidateUserId]);
      const ratingStats = ratingStatsResult.rows[0];

      // ✅ Get detailed ratings list
      const ratingsQuery = `
        SELECT 
          r.id,
          r.rating,
          r.feedback,
          r.would_hire_again,
          r.skills_rating,
          r.task_description,
          r.created_at,
          r.job_title,
          
          -- Employer info from ratings table (your schema has these fields)
          r.employer_name,
          r.role_in_company,
          r.company_name,
          r.company_industry,
          r.company_size,
          r.company_location,
          r.company_description,
          r.company_website,
          r.company_logo
          
        FROM ratings r
        WHERE r.jobseeker_id = $1
        ORDER BY r.created_at DESC
        LIMIT 50
      `;

      const ratingsResult = await pool.query(ratingsQuery, [candidateUserId]);
      const ratings = ratingsResult.rows;

      // Parse skills
      let skills: string[] = [];
      try {
        if (row.skills) {
          const parsed =
            typeof row.skills === "string"
              ? JSON.parse(row.skills)
              : row.skills;
          skills = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        skills = [];
      }

      // Construct profile image URL
      let profileImage =
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(row.name || `${row.first_name} ${row.last_name}`) +
        "&background=4285f4&color=fff&size=256";

      if (row.profile_picture) {
        if (row.profile_picture.startsWith("http")) {
          profileImage = row.profile_picture;
        } else {
          profileImage = `/uploads/profiles/${row.profile_picture.split("/").pop()}`;
        }
      }

      const candidateProfile = {
        user_id: row.user_id,
        name: row.name || `${row.first_name} ${row.last_name}`,
        email: row.email,
        phone: row.phone || "",
        location: row.location || "",
        profile_image: profileImage,

        bio: row.bio || "",
        title: row.current_position || "Job Seeker",

        years_of_experience: row.years_of_experience || 0,
        current_position: row.current_position || "",
        availability_status: row.availability_status || "open_to_opportunities",

        skills: skills,

        social_links: {
          linkedin: row.linkedin_url || "",
          github: row.github_url || "",
          portfolio: row.portfolio_url || "",
          website: row.portfolio_url || "",
        },

        application: row.application_id
          ? {
              id: row.application_id,
              status: row.application_status,
              cover_letter: row.cover_letter || "",
              expected_salary: row.expected_salary || 0,
              availability_date: row.availability_date || "",
              applied_at: row.applied_at,
            }
          : null,

        preferences: {
          job_types: this.parseJsonField(row.preferred_job_types),
          locations: this.parseJsonField(row.preferred_locations),
          salary_min: row.salary_expectation_min || 0,
          salary_max: row.salary_expectation_max || 0,
        },

        // ✅ Rating statistics
        rating_stats: {
          average_rating: parseFloat(ratingStats.average_rating) || 0,
          total_ratings: parseInt(ratingStats.total_ratings) || 0,
          would_hire_again_count: parseInt(ratingStats.would_hire_again_count) || 0,
          rating_distribution: {
            5: parseInt(ratingStats.rating_5) || 0,
            4: parseInt(ratingStats.rating_4) || 0,
            3: parseInt(ratingStats.rating_3) || 0,
            2: parseInt(ratingStats.rating_2) || 0,
            1: parseInt(ratingStats.rating_1) || 0,
          },
          success_rate: this.calculateSuccessRate(
            parseFloat(ratingStats.average_rating) || 0,
            parseInt(ratingStats.total_ratings) || 0
          ),
          
          // Skill ratings breakdown
          skill_ratings: {
            technical: parseFloat(ratingStats.avg_technical) || 0,
            communication: parseFloat(ratingStats.avg_communication) || 0,
            professionalism: parseFloat(ratingStats.avg_professionalism) || 0,
            quality: parseFloat(ratingStats.avg_quality) || 0,
            timeliness: parseFloat(ratingStats.avg_timeliness) || 0,
          },
        },

        // ✅ Detailed ratings list
        ratings: ratings.map(rating => ({
          id: rating.id,
          rating: rating.rating,
          feedback: rating.feedback,
          would_hire_again: rating.would_hire_again,
          task_description: rating.task_description,
          created_at: rating.created_at,
          
          employer: {
            name: rating.employer_name || "Employer",
            role: rating.role_in_company || "Employer",
            company_name: rating.company_name || "Company",
            company_industry: rating.company_industry,
            company_size: rating.company_size,
            company_location: rating.company_location,
            company_description: rating.company_description,
            company_website: rating.company_website,
            company_logo: rating.company_logo,
          },
          
          job_title: rating.job_title,
          
          skills_rating: rating.skills_rating || null,
        })),
      };

      return res.json({
        success: true,
        data: candidateProfile,
      });
    } catch (error) {
      console.error("❌ Error fetching candidate profile:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch candidate profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Helper methods
  private parseJsonField(field: any): string[] {
    if (!field) return [];
    try {
      if (typeof field === "string") {
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

  private calculateMatchScore(
    candidateSkills: string[],
    jobSkills: string[],
  ): number {
    if (!jobSkills || jobSkills.length === 0) return 85;
    if (!candidateSkills || candidateSkills.length === 0) return 60;

    const normalizedJobSkills = jobSkills.map((s) => s.toLowerCase().trim());
    const normalizedCandidateSkills = candidateSkills.map((s) =>
      s.toLowerCase().trim(),
    );

    const matches = normalizedCandidateSkills.filter((skill) =>
      normalizedJobSkills.some(
        (jobSkill) => jobSkill.includes(skill) || skill.includes(jobSkill),
      ),
    ).length;

    const matchPercentage = (matches / normalizedJobSkills.length) * 100;
    const bonusSkills = Math.max(0, candidateSkills.length - jobSkills.length);
    const bonus = Math.min(bonusSkills * 2, 10);

    return Math.min(Math.round(matchPercentage + bonus), 100);
  }

  // Calculate success rate from ratings
  private calculateSuccessRate(averageRating: number, totalRatings: number): number {
    if (totalRatings === 0) return 0;
    
    if (averageRating >= 4.5) return 100;
    if (averageRating >= 4.0) return Math.round(85 + (averageRating - 4.0) * 30);
    if (averageRating >= 3.0) return Math.round(60 + (averageRating - 3.0) * 25);
    
    return Math.round((averageRating / 5) * 100);
  }

  private formatLastActive(lastLogin: Date | null): string {
    if (!lastLogin) return "Recently active";

    const now = new Date();
    const diff = now.getTime() - new Date(lastLogin).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  }

  private getSortField(sortBy: string): string {
    const validSortFields: Record<string, string> = {
      match_score: "ja.applied_at DESC",
      newest: "ja.applied_at DESC",
      recent_activity: "ja.applied_at DESC",
      bestMatch: "ja.applied_at DESC",
      mostExperienced:
        "jp.years_of_experience DESC NULLS LAST, ja.applied_at DESC",
      recentlyActive: "ja.applied_at DESC",
    };

    return validSortFields[sortBy] || validSortFields["newest"];
  }

  // Existing methods remain the same
  async getJobPosts(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User ID not found",
        });
      }

      const employerQuery = `SELECT e.id as employer_id FROM employers e WHERE e.user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);

      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employer profile not found",
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

      const jobPosts = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        match_count: parseInt(row.application_count) || 0,
        pending_count: parseInt(row.pending_count) || 0,
        reviewed_count: parseInt(row.reviewed_count) || 0,
        shortlisted_count: parseInt(row.shortlisted_count) || 0,
        created_at: row.created_at,
        applications_count: parseInt(row.application_count) || 0,
      }));

      return res.json({
        success: true,
        data: jobPosts,
      });
    } catch (error) {
      console.error("❌ Error fetching job posts:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch job posts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async toggleShortlist(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> {
  try {
    const userId = req.user?.id;
    const { userId: candidateUserId } = req.params;
    const { jobId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found',
      });
    }

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'jobId is required in request body',
      });
    }

    // Get employer record
    const employerResult = await pool.query(
      'SELECT id as employer_id FROM employers WHERE user_id = $1',
      [userId]
    );

    if (employerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found',
      });
    }

    const employerId = employerResult.rows[0].employer_id;

    // Check if already shortlisted
    const checkResult = await pool.query(
      `SELECT id FROM shortlisted_candidates
       WHERE employer_id = $1 AND user_id = $2 AND job_id = $3`,
      [employerId, candidateUserId, jobId]
    );

    if (checkResult.rows.length > 0) {
      // ── REMOVE FROM SHORTLIST ──
      await pool.query(
        'DELETE FROM shortlisted_candidates WHERE id = $1',
        [checkResult.rows[0].id]
      );

      // Revert application status back to 'reviewed'
      await pool.query(
        `UPDATE job_applications
         SET status = 'reviewed', updated_at = NOW()
         WHERE user_id = $1 AND job_id = $2`,
        [candidateUserId, jobId]
      );

      return res.json({
        success: true,
        message: 'Candidate removed from shortlist',
        data: { is_shortlisted: false },
      });

    } else {
      // ── ADD TO SHORTLIST ──
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

      // ✅ Get job title for the notification message
      const jobResult = await pool.query(
        'SELECT title FROM jobs WHERE id = $1',
        [jobId]
      );
      const jobTitle = jobResult.rows.length > 0
        ? jobResult.rows[0].title
        : 'a position';

      // ✅ Get employer/company name for the notification message
      const companyResult = await pool.query(
        `SELECT c.name as company_name
         FROM employers e
         LEFT JOIN companies c ON e.company_id = c.id
         WHERE e.id = $1`,
        [employerId]
      );
      const companyName = companyResult.rows.length > 0 && companyResult.rows[0].company_name
        ? companyResult.rows[0].company_name
        : 'An employer';

      // ✅ Send notification to the jobseeker
      await pool.query(
  `INSERT INTO notifications (user_id, type, title, message, metadata, read, created_at)
   VALUES ($1, 'application_shortlisted', $2, $3, $4, false, NOW())`,
  [
    candidateUserId,
    '🎉 You have been shortlisted!',
    `${companyName} has shortlisted your application for "${jobTitle}". Congratulations!`,
    JSON.stringify({
      job_id: jobId,
      job_title: jobTitle,
      employer_id: employerId,
      company_name: companyName,
      type: 'application_shortlisted'
    })
  ]
);

      console.log(`✅ Shortlist notification sent to jobseeker ${candidateUserId} for job ${jobId}`);

      return res.json({
        success: true,
        message: 'Candidate added to shortlist',
        data: { is_shortlisted: true },
      });
    }
  } catch (error) {
    console.error('Error toggling shortlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update shortlist',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
  async inviteCandidate(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<Response> {
    try {
      const userId = req.user?.id;
      const { userId: candidateUserId } = req.params;
      const { jobId, message } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User ID not found",
        });
      }

      const employerQuery = `SELECT id as employer_id FROM employers WHERE user_id = $1`;
      const employerResult = await pool.query(employerQuery, [userId]);

      if (employerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employer profile not found",
        });
      }

      const employerId = employerResult.rows[0].employer_id;

      await pool.query(
        `INSERT INTO job_invitations (employer_id, user_id, job_id, message, status)
         VALUES ($1, $2, $3, $4, 'sent')`,
        [employerId, candidateUserId, jobId, message],
      );

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES ($1, 'job_invitation', 'Job Invitation', $2, $3)`,
        [
          candidateUserId,
          "You have been invited to apply for a position",
          JSON.stringify({ job_id: jobId, employer_id: employerId }),
        ],
      );

      return res.json({
        success: true,
        message: "Invitation sent successfully",
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send invitation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default new CandidatesController();