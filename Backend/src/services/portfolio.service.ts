// src/services/portfolio.service.ts - FIXED VERSION

import db from '../db/db.config';
import { PortfolioSettings } from '../types/portfolio.type';
import PDFDocument from 'pdfkit';
import { CVBuilderService } from './cv-builder.service';
import { validate as isValidUUID } from 'uuid';

export class PortfolioService {

  // FIXED: Get portfolio data by user ID
  async getPortfolioByUserId(userId: string): Promise<any> {
    try {
      // Validate UUID first
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      console.log('📊 Loading portfolio for user:', userId);

      // FIX 1: Remove ::uuid cast and cv_data column (doesn't exist in schema)
      const cvQuery = `
        SELECT id::text, status, created_at, updated_at
        FROM cvs 
        WHERE user_id = $1
        ORDER BY 
          CASE WHEN status = 'final' THEN 0 ELSE 1 END,
          updated_at DESC 
        LIMIT 1
      `;
      
      const cvResult = await db.query(cvQuery, [userId]);

      if (cvResult.rows.length === 0) {
        console.warn('⚠️ No CV found for user:', userId);
        throw new Error('No CV found for this user. Please create a CV in the CV Builder first.');
      }

      const cvRow = cvResult.rows[0];
      const cvId = cvRow.id;

      console.log('✅ Found CV:', cvId);

      // FIX 2: Use CVBuilderService properly with error handling
      const cvService = new CVBuilderService();
      const fullCV = await cvService.getCVById(cvId, userId);

      if (!fullCV) {
        console.error('❌ Failed to load full CV data');
        throw new Error('Failed to load CV data');
      }

      console.log('✅ Loaded full CV with sections');

      // Get portfolio settings
      const settings = await this.getOrCreateSettings(userId);

      // Get testimonials - FIX: Use 'name' instead of 'author'
      const testimonialsQuery = `
        SELECT id, text as content, name as author, position, created_at
        FROM portfolio_testimonials 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const testimonials = await db.query(testimonialsQuery, [userId]);

      // Get view count
      const viewCountQuery = `
        SELECT COUNT(*)::int as total_views 
        FROM portfolio_views 
        WHERE portfolio_user_id = $1
      `;
      const viewCount = await db.query(viewCountQuery, [userId]);

      const portfolioData = {
        cvId: cvId,
        userId: userId,
        cvData: fullCV.cv_data,
        settings: settings,
        testimonials: testimonials.rows,
        viewCount: parseInt(viewCount.rows[0]?.total_views || '0', 10),
        createdAt: fullCV.created_at,
        updatedAt: fullCV.updated_at
      };

      console.log('✅ Portfolio data assembled successfully');
      return portfolioData;

    } catch (error: any) {
      // FIX 3: Better error logging
      console.error('❌ Error in getPortfolioByUserId:', {
        message: error.message,
        stack: error.stack,
        userId: userId
      });
      throw error;
    }
  }

  // FIXED: Get public portfolio
  async getPublicPortfolio(
    identifier: string,
    viewerIp: string,
    userAgent?: string,
    referrer?: string
  ): Promise<any> {
    try {
      let userResult;

      console.log('🔍 Looking up user by identifier:', identifier);

      // FIX: Better identifier detection
      if (isValidUUID(identifier)) {
        userResult = await db.query(
          `SELECT id::text FROM users WHERE id = $1 LIMIT 1`,
          [identifier]
        );
      } else {
        userResult = await db.query(
          `SELECT id::text FROM users WHERE email = $1 LIMIT 1`,
          [identifier]
        );
      }

      if (userResult.rows.length === 0) {
        throw new Error('Portfolio not found');
      }

      const userId: string = userResult.rows[0].id;

      // Check if portfolio is public
      const settingsQuery = `
        SELECT is_public FROM portfolio_settings 
        WHERE user_id = $1
      `;
      const settingsResult = await db.query(settingsQuery, [userId]);

      if (settingsResult.rows.length > 0 && !settingsResult.rows[0].is_public) {
        throw new Error('This portfolio is private');
      }

      // Track view
      await this.trackView(userId, viewerIp, userAgent, referrer);

      // Return portfolio data
      return await this.getPortfolioByUserId(userId);
    } catch (error: any) {
      console.error('❌ Error in getPublicPortfolio:', error);
      throw error;
    }
  }

  // Get or create portfolio settings
  async getOrCreateSettings(userId: string): Promise<PortfolioSettings> {
    try {
      const query = `SELECT * FROM portfolio_settings WHERE user_id = $1`;
      const result = await db.query(query, [userId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create default settings
      const insertQuery = `
        INSERT INTO portfolio_settings (
          user_id, theme, is_public, analytics_enabled, 
          show_contact_form, show_download_cv, social_links
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const insertResult = await db.query(insertQuery, [
        userId, 'light', true, true, true, true, JSON.stringify([])
      ]);

      return insertResult.rows[0];
    } catch (error: any) {
      console.error('Error in getOrCreateSettings:', error);
      throw new Error('Failed to get portfolio settings');
    }
  }

  // Update portfolio settings
  async updateSettings(userId: string, settingsData: Partial<PortfolioSettings>): Promise<PortfolioSettings> {
    try {
      const {
        theme, is_public, custom_domain, seo_title, seo_description,
        seo_keywords, analytics_enabled, show_contact_form,
        show_download_cv, social_links, custom_sections
      } = settingsData;

      const query = `
        UPDATE portfolio_settings 
        SET 
          theme = COALESCE($1, theme),
          is_public = COALESCE($2, is_public),
          custom_domain = $3,
          seo_title = $4,
          seo_description = $5,
          seo_keywords = $6,
          analytics_enabled = COALESCE($7, analytics_enabled),
          show_contact_form = COALESCE($8, show_contact_form),
          show_download_cv = COALESCE($9, show_download_cv),
          social_links = COALESCE($10, social_links),
          custom_sections = $11,
          updated_at = NOW()
        WHERE user_id = $12
        RETURNING *
      `;

      const result = await db.query(query, [
        theme, is_public, custom_domain, seo_title, seo_description,
        seo_keywords, analytics_enabled, show_contact_form, show_download_cv,
        social_links ? JSON.stringify(social_links) : null,
        custom_sections ? JSON.stringify(custom_sections) : null,
        userId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Portfolio settings not found');
      }

      return result.rows[0];
    } catch (error: any) {
      console.error('Error in updateSettings:', error);
      throw new Error('Failed to update portfolio settings');
    }
  }

  // Track portfolio view
  private async trackView(
    portfolioUserId: string,
    viewerIp: string,
    userAgent?: string,
    referrer?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO portfolio_views (
          portfolio_user_id, viewer_ip, user_agent, referrer
        ) VALUES ($1, $2, $3, $4)
      `;
      await db.query(query, [portfolioUserId, viewerIp, userAgent, referrer]);
    } catch (error: any) {
      console.error('Error tracking view:', error);
    }
  }

  // Get analytics
  async getAnalytics(userId: string, startDate?: string, endDate?: string): Promise<any> {
    try {
      const dateFilter = startDate && endDate ? `AND viewed_at BETWEEN $2 AND $3` : '';
      const params: any[] = [userId];
      
      if (startDate && endDate) {
        params.push(startDate, endDate);
      }

      const totalViewsQuery = `
        SELECT COUNT(*) as total_views 
        FROM portfolio_views 
        WHERE portfolio_user_id = $1 ${dateFilter}
      `;
      const totalViews = await db.query(totalViewsQuery, params);

      const viewsByDateQuery = `
        SELECT DATE(viewed_at) as date, COUNT(*) as views
        FROM portfolio_views
        WHERE portfolio_user_id = $1 ${dateFilter}
        GROUP BY DATE(viewed_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      const viewsByDate = await db.query(viewsByDateQuery, params);

      const topReferrersQuery = `
        SELECT referrer, COUNT(*) as count
        FROM portfolio_views
        WHERE portfolio_user_id = $1 ${dateFilter} AND referrer IS NOT NULL
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 10
      `;
      const topReferrers = await db.query(topReferrersQuery, params);

      return {
        totalViews: parseInt(totalViews.rows[0]?.total_views ?? '0', 10),
        viewsByDate: viewsByDate.rows,
        topReferrers: topReferrers.rows
      };
    } catch (error: any) {
      console.error('Error in getAnalytics:', error);
      throw new Error('Failed to fetch analytics');
    }
  }

  // FIXED: Generate portfolio PDF with better error handling
  async generatePortfolioPDF(userId: string): Promise<Buffer> {
    try {
      console.log('📄 Generating PDF for user:', userId);
      
      const portfolioData = await this.getPortfolioByUserId(userId);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          console.log('✅ PDF generated successfully');
          resolve(Buffer.concat(buffers));
        });
        doc.on('error', (err) => {
          console.error('❌ PDF generation error:', err);
          reject(err);
        });

        const cvData = portfolioData.cvData;
        const pi = cvData.personal_info || {};

        // Portfolio Header
        doc.fontSize(28).fillColor('#2c3e50').text('PROFESSIONAL PORTFOLIO', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(20).text(pi.full_name || 'Portfolio', { align: 'center' });
        doc.moveDown(0.3);
        
        doc.fontSize(11).fillColor('#7f8c8d');
        const contact = [pi.email, pi.phone, pi.address].filter(Boolean).join(' • ');
        if (contact) {
          doc.text(contact, { align: 'center' });
        }
        doc.moveDown(1.5);

        // Professional Summary
        if (pi.professional_summary) {
          doc.fontSize(16).fillColor('#2c3e50').text('ABOUT ME', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(11).fillColor('#34495e').text(pi.professional_summary, { align: 'justify' });
          doc.moveDown(1);
        }

        // Skills
        if (cvData.skills && cvData.skills.length > 0) {
          doc.fontSize(16).fillColor('#2c3e50').text('SKILLS & EXPERTISE', { underline: true });
          doc.moveDown(0.5);
          
          const skillsByCategory: any = {};
          cvData.skills.forEach((skill: any) => {
            const category = skill.category || 'General';
            if (!skillsByCategory[category]) {
              skillsByCategory[category] = [];
            }
            skillsByCategory[category].push(skill.skill_name);
          });

          Object.keys(skillsByCategory).forEach((category) => {
            doc.fontSize(12).fillColor('#2c3e50').text(category + ':', { continued: true });
            doc.fontSize(10).fillColor('#34495e').text(' ' + skillsByCategory[category].join(', '));
            doc.moveDown(0.5);
          });
          doc.moveDown(1);
        }

        // Projects
        if (cvData.projects && cvData.projects.length > 0) {
          doc.fontSize(16).fillColor('#2c3e50').text('FEATURED PROJECTS', { underline: true });
          doc.moveDown(0.5);
          
          cvData.projects.forEach((project: any, index: number) => {
            doc.fontSize(13).fillColor('#2c3e50').text(`${index + 1}. ${project.project_name}`);
            if (project.description) {
              doc.fontSize(10).fillColor('#34495e').text(project.description);
            }
            if (project.technologies) {
              doc.fontSize(9).fillColor('#7f8c8d').text(`Tech Stack: ${project.technologies}`);
            }
            doc.moveDown(0.7);
          });
          doc.moveDown(1);
        }

        // Work Experience
        if (cvData.work_experience && cvData.work_experience.length > 0) {
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

        // Certifications
        if (cvData.certifications && cvData.certifications.length > 0) {
          doc.fontSize(16).fillColor('#2c3e50').text('CERTIFICATIONS', { underline: true });
          doc.moveDown(0.5);
          
          cvData.certifications.forEach((cert: any) => {
            doc.fontSize(11).fillColor('#2c3e50').text(`• ${cert.certification_name}`);
            doc.fontSize(9).fillColor('#7f8c8d').text(`  ${cert.issuer} - ${cert.date_issued}`);
            doc.moveDown(0.5);
          });
        }

        doc.fontSize(8).fillColor('#95a5a6').text(
          `Portfolio generated on ${new Date().toLocaleDateString()}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

        doc.end();
      });
    } catch (error: any) {
      console.error('❌ Error generating portfolio PDF:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Add testimonial
  async addTestimonial(userId: string, testimonialData: any): Promise<any> {
    try {
      const query = `
        INSERT INTO portfolio_testimonials (
          user_id, name, position, company, text, date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await db.query(query, [
        userId,
        testimonialData.name,
        testimonialData.position,
        testimonialData.company,
        testimonialData.text,
        testimonialData.date || new Date()
      ]);

      return result.rows[0];
    } catch (error: any) {
      console.error('Error adding testimonial:', error);
      throw new Error('Failed to add testimonial');
    }
  }

  // Delete testimonial
  async deleteTestimonial(userId: string, testimonialId: number): Promise<void> {
    try {
      const query = `
        DELETE FROM portfolio_testimonials 
        WHERE id = $1 AND user_id = $2
      `;
      await db.query(query, [testimonialId, userId]);
    } catch (error: any) {
      console.error('Error deleting testimonial:', error);
      throw new Error('Failed to delete testimonial');
    }
  }
}