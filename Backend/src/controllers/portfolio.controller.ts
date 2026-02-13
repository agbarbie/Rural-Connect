// portfolio.controller.ts - WORKING VERSION with fixed PDF export
import { Request, Response } from 'express';
import pool from '../db/db.config';
import PDFDocument from 'pdfkit';

export class PortfolioController {
  
  async getMyPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      console.log('📂 Fetching portfolio for user:', userId);

      const userQuery = `SELECT id, name, email, profile_picture FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const userData = userResult.rows[0];
      console.log('✅ User data loaded');

      const profileQuery = `SELECT * FROM jobseeker_profiles WHERE user_id = $1`;
      const profileResult = await pool.query(profileQuery, [userId]);
      let profileData: any = profileResult.rows[0] || {};

      const parseJsonField = (field: any): any[] => {
        if (!field) return [];
        try {
          if (typeof field === 'string') return JSON.parse(field);
          if (Array.isArray(field)) return field;
          return [];
        } catch { return []; }
      };

      const skills = parseJsonField(profileData.skills);
      const preferredJobTypes = parseJsonField(profileData.preferred_job_types);
      const preferredLocations = parseJsonField(profileData.preferred_locations);

      let cvData: any = null;
      let cvId: string | null = null;

      try {
        const cvQuery = `
          SELECT id::text, status, cv_data, created_at, updated_at
          FROM cvs WHERE user_id = $1
          ORDER BY CASE WHEN status = 'final' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1
        `;
        const cvResult = await pool.query(cvQuery, [userId]);
        if (cvResult.rows.length > 0) {
          const cv = cvResult.rows[0];
          cvId = cv.id;
          cvData = typeof cv.cv_data === 'string' ? JSON.parse(cv.cv_data) : cv.cv_data;
          console.log('✅ CV data found:', cvId);
        }
      } catch (cvError) {
        console.warn('⚠️ CV query failed:', cvError);
      }

      const settingsQuery = `SELECT * FROM portfolio_settings WHERE user_id = $1`;
      const settingsResult = await pool.query(settingsQuery, [userId]);
      
      const settings = settingsResult.rows.length > 0 
        ? { ...settingsResult.rows[0], is_public: settingsResult.rows[0].privacy_level === 'public' }
        : { user_id: userId, theme: 'default', is_public: false, privacy_level: 'private', analytics_enabled: true, social_links: [] };

      const testimonialsQuery = `
        SELECT id, testimonial_text as text, author_name as author, 
               author_position as position, author_company as company, created_at
        FROM portfolio_testimonials 
        WHERE user_id = $1 AND is_approved = true ORDER BY created_at DESC
      `;
      const testimonialsResult = await pool.query(testimonialsQuery, [userId]);

      const viewCountQuery = `SELECT COUNT(*) as count FROM portfolio_views WHERE user_id = $1`;
      const viewCountResult = await pool.query(viewCountQuery, [userId]);
      const viewCount = parseInt(viewCountResult.rows[0]?.count || '0');

      const categorizeSkill = (skillName: string): string => {
        const tech = skillName.toLowerCase();
        const technicalKeywords = ['javascript', 'python', 'java', 'c++', 'react', 'angular', 'vue', 'node', 'sql', 'mongodb', 'aws', 'docker'];
        const softKeywords = ['communication', 'leadership', 'teamwork', 'management', 'problem solving'];
        if (technicalKeywords.some(kw => tech.includes(kw))) return 'Technical';
        if (softKeywords.some(kw => tech.includes(kw))) return 'Soft Skills';
        return 'General';
      };

      const portfolioResponse = {
        success: true,
        message: 'Portfolio retrieved successfully',
        data: {
          userId, cvId,
          personalInfo: {
            fullName: userData.name,
            email: userData.email,
            phone: profileData.phone || '',
            location: profileData.location || '',
            profileImage: userData.profile_picture || null,
            bio: profileData.bio || '',
            linkedIn: profileData.linkedin_url || '',
            github: profileData.github_url || '',
            website: profileData.portfolio_url || '',
            yearsOfExperience: profileData.years_of_experience || 0,
            currentPosition: profileData.current_position || '',
            availabilityStatus: profileData.availability_status || 'open_to_opportunities'
          },
          skills: skills.map((skillName: string) => ({
            skill_name: skillName, name: skillName,
            category: categorizeSkill(skillName), skill_level: 'Intermediate'
          })),
          careerPreferences: {
            preferredJobTypes, preferredLocations,
            salaryMin: profileData.salary_expectation_min,
            salaryMax: profileData.salary_expectation_max
          },
          workExperience: cvData?.work_experience || [],
          education: cvData?.education || [],
          projects: cvData?.projects || [],
          certifications: cvData?.certifications || [],
          cvData: cvData || {},
          profileData: { name: userData.name, email: userData.email, ...profileData, profile_image: userData.profile_picture },
          settings, testimonials: testimonialsResult.rows, viewCount,
          createdAt: profileData.created_at || new Date(),
          updatedAt: profileData.updated_at || new Date()
        }
      };

      console.log('✅ Portfolio assembled successfully');
      res.json(portfolioResponse);
    } catch (error) {
      console.error('❌ Error fetching portfolio:', error);
      res.status(500).json({ success: false, message: 'Failed to load portfolio' });
    }
  }

  /**
   * ✅ FIXED: Export portfolio as PDF - Standalone function (no this.getPortfolioData)
   */
  async exportPortfolioPDF(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      console.log('📄 Generating PDF for user:', userId);

      // ✅ INLINE data fetching (no separate helper method)
      const userQuery = `SELECT id, name, email FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);
      if (userResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      const userData = userResult.rows[0];

      const profileQuery = `SELECT * FROM jobseeker_profiles WHERE user_id = $1`;
      const profileResult = await pool.query(profileQuery, [userId]);
      const profileData = profileResult.rows[0] || {};

      const parseJsonField = (field: any): any[] => {
        if (!field) return [];
        try {
          if (typeof field === 'string') return JSON.parse(field);
          if (Array.isArray(field)) return field;
          return [];
        } catch { return []; }
      };

      const skills = parseJsonField(profileData.skills);

      let cvData: any = null;
      try {
        const cvQuery = `SELECT cv_data FROM cvs WHERE user_id = $1 ORDER BY CASE WHEN status = 'final' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`;
        const cvResult = await pool.query(cvQuery, [userId]);
        if (cvResult.rows.length > 0) {
          cvData = typeof cvResult.rows[0].cv_data === 'string' ? JSON.parse(cvResult.rows[0].cv_data) : cvResult.rows[0].cv_data;
        }
      } catch (err) {
        console.warn('No CV data available');
      }

      const testimonialsQuery = `SELECT testimonial_text as text, author_name as author, author_position as position FROM portfolio_testimonials WHERE user_id = $1 AND is_approved = true ORDER BY created_at DESC LIMIT 3`;
      const testimonialsResult = await pool.query(testimonialsQuery, [userId]);

      const viewCountQuery = `SELECT COUNT(*) as count FROM portfolio_views WHERE user_id = $1`;
      const viewCountResult = await pool.query(viewCountQuery, [userId]);
      const viewCount = parseInt(viewCountResult.rows[0]?.count || '0');

      // Create PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${userData.name.replace(/\s+/g, '_')}_Portfolio.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(28).fillColor('#2c3e50').text('PROFESSIONAL PORTFOLIO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(20).text(userData.name || 'Portfolio', { align: 'center' });
      doc.moveDown(0.3);
      
      // Contact
      doc.fontSize(11).fillColor('#7f8c8d');
      const contact = [userData.email, profileData.phone, profileData.location].filter(Boolean).join(' • ');
      if (contact) doc.text(contact, { align: 'center' });
      
      const socialLinks = [profileData.linkedin_url, profileData.github_url, profileData.portfolio_url].filter(Boolean);
      if (socialLinks.length > 0) {
        doc.fontSize(9).text(socialLinks.join(' | '), { align: 'center' });
      }
      doc.moveDown(1.5);

      // Bio
      if (profileData.bio) {
        doc.fontSize(16).fillColor('#2c3e50').text('PROFESSIONAL SUMMARY', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#34495e').text(profileData.bio, { align: 'justify' });
        doc.moveDown(1);
      }

      // Current Position
      if (profileData.current_position) {
        doc.fontSize(14).fillColor('#2c3e50').text('Current Position: ', { continued: true });
        doc.fontSize(12).fillColor('#34495e').text(profileData.current_position);
        doc.moveDown(0.5);
      }

      // Experience
      if (profileData.years_of_experience) {
        doc.fontSize(14).fillColor('#2c3e50').text('Experience: ', { continued: true });
        doc.fontSize(12).fillColor('#34495e').text(`${profileData.years_of_experience} years`);
        doc.moveDown(1);
      }

      // Skills
      if (skills && skills.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('SKILLS & EXPERTISE', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#34495e').text(skills.join(', '), { align: 'justify' });
        doc.moveDown(1);
      }

      // Work Experience
      if (cvData?.work_experience && cvData.work_experience.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('PROFESSIONAL EXPERIENCE', { underline: true });
        doc.moveDown(0.5);
        cvData.work_experience.forEach((work: any) => {
          doc.fontSize(12).fillColor('#2c3e50').text(`${work.position} at ${work.company}`);
          doc.fontSize(9).fillColor('#95a5a6').text(`${work.start_date} - ${work.is_current ? 'Present' : work.end_date}`);
          if (work.responsibilities) {
            doc.fontSize(10).fillColor('#34495e').text(work.responsibilities);
          }
          doc.moveDown(0.7);
        });
        doc.moveDown(1);
      }

      // Education
      if (cvData?.education && cvData.education.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('EDUCATION', { underline: true });
        doc.moveDown(0.5);
        cvData.education.forEach((edu: any) => {
          doc.fontSize(12).fillColor('#2c3e50').text(`${edu.degree} - ${edu.institution}`);
          doc.fontSize(9).fillColor('#7f8c8d').text(`${edu.start_date} - ${edu.end_date}`);
          if (edu.achievements) {
            doc.fontSize(10).fillColor('#34495e').text(edu.achievements);
          }
          doc.moveDown(0.7);
        });
        doc.moveDown(1);
      }

      // Projects
      if (cvData?.projects && cvData.projects.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('FEATURED PROJECTS', { underline: true });
        doc.moveDown(0.5);
        cvData.projects.forEach((project: any, index: number) => {
          doc.fontSize(13).fillColor('#2c3e50').text(`${index + 1}. ${project.project_name || project.name}`);
          if (project.description) {
            doc.fontSize(10).fillColor('#34495e').text(project.description);
          }
          if (project.technologies || project.tech_stack) {
            doc.fontSize(9).fillColor('#7f8c8d').text(`Tech: ${project.technologies || project.tech_stack}`);
          }
          doc.moveDown(0.7);
        });
        doc.moveDown(1);
      }

      // Certifications
      if (cvData?.certifications && cvData.certifications.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('CERTIFICATIONS', { underline: true });
        doc.moveDown(0.5);
        cvData.certifications.forEach((cert: any) => {
          doc.fontSize(11).fillColor('#2c3e50').text(`• ${cert.certification_name || cert.name}`);
          doc.fontSize(9).fillColor('#7f8c8d').text(`  ${cert.issuer} - ${cert.date_issued || cert.dateIssued}`);
          doc.moveDown(0.5);
        });
        doc.moveDown(1);
      }

      // Testimonials
      if (testimonialsResult.rows.length > 0) {
        doc.fontSize(16).fillColor('#2c3e50').text('RECOMMENDATIONS', { underline: true });
        doc.moveDown(0.5);
        testimonialsResult.rows.forEach((test: any) => {
          doc.fontSize(10).fillColor('#34495e').text(`"${test.text}"`);
          doc.fontSize(9).fillColor('#7f8c8d').text(`- ${test.author}, ${test.position}`, { align: 'right' });
          doc.moveDown(0.7);
        });
      }

      // Footer
      doc.fontSize(8).fillColor('#95a5a6').text(
        `Generated on ${new Date().toLocaleDateString()} | ${viewCount} profile views`,
        50, doc.page.height - 50, { align: 'center' }
      );

      doc.end();
      console.log('✅ PDF generated successfully');

    } catch (error) {
      console.error('❌ Error generating portfolio PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getPublicPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const { identifier } = req.params;
      const userQuery = `SELECT id FROM users WHERE email = $1 OR id::text = $1`;
      const userResult = await pool.query(userQuery, [identifier]);

      if (userResult.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Portfolio not found' });
        return;
      }

      const userId = userResult.rows[0].id;
      const settingsQuery = `SELECT privacy_level FROM portfolio_settings WHERE user_id = $1`;
      const settingsResult = await pool.query(settingsQuery, [userId]);

      if (settingsResult.rows.length === 0 || settingsResult.rows[0].privacy_level !== 'public') {
        res.status(403).json({ success: false, message: 'This portfolio is private' });
        return;
      }

      try {
        const viewQuery = `INSERT INTO portfolio_views (user_id, viewed_at, viewer_ip) VALUES ($1, NOW(), $2)`;
        await pool.query(viewQuery, [userId, req.ip]);
      } catch (viewError) {
        console.warn('Failed to track view:', viewError);
      }

      (req as any).user = { id: userId };
      await this.getMyPortfolio(req, res);
    } catch (error) {
      console.error('❌ Error:', error);
      res.status(500).json({ success: false, message: 'Failed to load portfolio' });
    }
  }

  async getPortfolioSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const query = `SELECT * FROM portfolio_settings WHERE user_id = $1`;
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        res.json({
          success: true,
          data: { user_id: userId, theme: 'default', is_public: false, privacy_level: 'private', analytics_enabled: true, social_links: [] }
        });
        return;
      }

      res.json({
        success: true,
        data: { ...result.rows[0], is_public: result.rows[0].privacy_level === 'public' }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load settings' });
    }
  }

  async updatePortfolioSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const settings = req.body;
      const privacyLevel = settings.is_public ? 'public' : 'private';

      const checkQuery = `SELECT id FROM portfolio_settings WHERE user_id = $1`;
      const checkResult = await pool.query(checkQuery, [userId]);

      let query: string, values: any[];

      if (checkResult.rows.length === 0) {
        query = `INSERT INTO portfolio_settings (user_id, theme, privacy_level, analytics_enabled, social_links) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        values = [userId, settings.theme || 'default', privacyLevel, settings.analytics_enabled !== false, JSON.stringify(settings.social_links || [])];
      } else {
        query = `UPDATE portfolio_settings SET theme = COALESCE($2, theme), privacy_level = COALESCE($3, privacy_level), analytics_enabled = COALESCE($4, analytics_enabled), social_links = COALESCE($5, social_links), updated_at = NOW() WHERE user_id = $1 RETURNING *`;
        values = [userId, settings.theme, privacyLevel, settings.analytics_enabled, settings.social_links ? JSON.stringify(settings.social_links) : null];
      }

      const result = await pool.query(query, values);
      res.json({
        success: true,
        data: { ...result.rows[0], is_public: result.rows[0].privacy_level === 'public' },
        message: 'Settings updated successfully'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
  }

  async getPortfolioAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { startDate, endDate } = req.query;

      let query = `SELECT DATE(viewed_at) as date, COUNT(*) as views, COUNT(DISTINCT viewer_ip) as unique_visitors FROM portfolio_views WHERE user_id = $1`;
      const values: any[] = [userId];

      if (startDate && endDate) {
        query += ` AND viewed_at BETWEEN $2 AND $3`;
        values.push(startDate, endDate);
      }

      query += ` GROUP BY DATE(viewed_at) ORDER BY date DESC LIMIT 30`;
      const result = await pool.query(query, values);

      const totalQuery = `SELECT COUNT(*) as total_views, COUNT(DISTINCT viewer_ip) as total_unique_visitors FROM portfolio_views WHERE user_id = $1`;
      const totalResult = await pool.query(totalQuery, [userId]);

      res.json({
        success: true,
        data: { dailyStats: result.rows, totalStats: totalResult.rows[0] }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load analytics' });
    }
  }

  async addTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { text, author, position, company } = req.body;

      if (!text || !author) {
        res.status(400).json({ success: false, message: 'Text and author are required' });
        return;
      }

      const query = `
        INSERT INTO portfolio_testimonials (user_id, testimonial_text, author_name, author_position, author_company)
        VALUES ($1, $2, $3, $4, $5) RETURNING id, testimonial_text as text, author_name as author, author_position as position, author_company as company, created_at
      `;
      const result = await pool.query(query, [userId, text, author, position || '', company || '']);

      res.status(201).json({ success: true, data: result.rows[0], message: 'Testimonial added successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to add testimonial' });
    }
  }

  async deleteTestimonial(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { testimonialId } = req.params;

      const query = `DELETE FROM portfolio_testimonials WHERE id = $1 AND user_id = $2 RETURNING id`;
      const result = await pool.query(query, [testimonialId, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Testimonial not found' });
        return;
      }

      res.json({ success: true, message: 'Testimonial deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
    }
  }
}

export default new PortfolioController();