// src/services/portfolio.service.ts - SCHEMA COMPATIBLE VERSION

import db from '../db/db.config';
import { PortfolioSettings } from '../types/portfolio.type';
import PDFDocument from 'pdfkit';
import { CVBuilderService } from './cv-builder.service';
import { validate as isValidUUID } from 'uuid';
import { CVData } from '@/types/cv.type';

export class PortfolioService {

// src/services/portfolio.service.ts - Fixed getPortfolioByUserId method

// src/services/portfolio.service.ts - Fixed getPortfolioByUserId method

async getPortfolioByUserId(userId: string): Promise<any> {
  try {
    if (!isValidUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    console.log('📊 Loading portfolio for user:', userId);

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

    const cvService = new CVBuilderService();
    const fullCV = await cvService.getCVById(cvId, userId);

    if (!fullCV) {
      console.error('❌ Failed to load full CV data');
      throw new Error('Failed to load CV data');
    }

    console.log('✅ Loaded full CV with sections');
    
    // Add null check for cv_data
    if (!fullCV.cv_data) {
      console.error('❌ CV data is undefined');
      throw new Error('CV data is missing');
    }

    const cvData = fullCV.cv_data;
    console.log('📝 Skills from CV:', cvData.skills);

    // Get portfolio settings
    const settings = await this.getOrCreateSettings(userId);

    // Get testimonials
    const testimonialsQuery = `
      SELECT id, testimonial_text as content, author_name as author, 
             author_position as position, author_company as company, created_at
      FROM portfolio_testimonials 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const testimonials = await db.query(testimonialsQuery, [userId]);

    // Get view count
    const viewCountQuery = `
      SELECT COUNT(*)::int as total_views 
      FROM portfolio_views 
      WHERE user_id = $1
    `;
    const viewCount = await db.query(viewCountQuery, [userId]);

    // Debug log the skills
    console.log('Skills before portfolio assembly:', cvData.skills);
    console.log('Skills array length:', cvData.skills?.length || 0);
    if (cvData.skills && cvData.skills.length > 0) {
      console.log('First skill structure:', cvData.skills[0]);
    }

    const portfolioData = {
      cvId: cvId,
      userId: userId,
      cvData: {
        personalInfo: cvData.personal_info || {},
        personal_info: cvData.personal_info || {}, // Include both formats
        skills: cvData.skills || [], // Ensure it's always an array
        work_experience: cvData.work_experience || [],
        workExperience: cvData.work_experience || [], // Include camelCase too
        education: cvData.education || [],
        projects: cvData.projects || [],
        certifications: cvData.certifications || []
      },
      settings: settings,
      testimonials: testimonials.rows,
      viewCount: parseInt(viewCount.rows[0]?.total_views || '0', 10),
      createdAt: fullCV.created_at,
      updatedAt: fullCV.updated_at
    };

    console.log('✅ Portfolio data assembled successfully');
    console.log('Skills in final portfolio data:', portfolioData.cvData.skills);
    console.log('Total skills count:', portfolioData.cvData.skills.length);
    
    return portfolioData;

  } catch (error: any) {
    console.error('❌ Error in getPortfolioByUserId:', {
      message: error.message,
      stack: error.stack,
      userId: userId
    });
    throw error;
  }
}

  async getPublicPortfolio(
    identifier: string,
    viewerIp: string,
    userAgent?: string,
    referrer?: string
  ): Promise<any> {
    try {
      let userResult;

      console.log('🔍 Looking up user by identifier:', identifier);

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

      // Check if portfolio is public using privacy_level
      const settingsQuery = `
        SELECT privacy_level FROM portfolio_settings 
        WHERE user_id = $1
      `;
      const settingsResult = await db.query(settingsQuery, [userId]);

      if (settingsResult.rows.length > 0 && settingsResult.rows[0].privacy_level === 'private') {
        throw new Error('This portfolio is private');
      }

      // Track view
      await this.trackView(userId, viewerIp, userAgent, referrer);

      return await this.getPortfolioByUserId(userId);
    } catch (error: any) {
      console.error('❌ Error in getPublicPortfolio:', error);
      throw error;
    }
  }

  // FIXED: Get or create portfolio settings - uses actual schema columns
  async getOrCreateSettings(userId: string): Promise<PortfolioSettings> {
    try {
      const query = `SELECT * FROM portfolio_settings WHERE user_id = $1`;
      const result = await db.query(query, [userId]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        // Map database columns to expected interface
        return {
          user_id: row.user_id,
          theme: row.theme || 'default',
          is_public: row.privacy_level === 'public', // Map privacy_level to is_public
          custom_domain: row.custom_domain,
          seo_title: row.seo_title,
          seo_description: row.seo_description,
          seo_keywords: row.seo_keywords,
          analytics_enabled: row.analytics_enabled !== false,
          show_contact_form: true, // Default since column doesn't exist
          show_download_cv: true,  // Default since column doesn't exist
          social_links: row.social_links || [],
          custom_sections: row.custom_sections,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      }

      // Create default settings using actual schema
      const insertQuery = `
        INSERT INTO portfolio_settings (
          user_id, theme, privacy_level, analytics_enabled
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const insertResult = await db.query(insertQuery, [
        userId, 'default', 'public', true
      ]);

      const row = insertResult.rows[0];
      return {
        user_id: row.user_id,
        theme: row.theme,
        is_public: row.privacy_level === 'public',
        custom_domain: row.custom_domain,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        seo_keywords: row.seo_keywords,
        analytics_enabled: row.analytics_enabled,
        show_contact_form: true,
        show_download_cv: true,
        social_links: [],
        custom_sections: undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error: any) {
      console.error('Error in getOrCreateSettings:', error);
      throw new Error('Failed to get portfolio settings');
    }
  }

  // FIXED: Update portfolio settings - uses actual schema
  async updateSettings(userId: string, settingsData: Partial<PortfolioSettings>): Promise<PortfolioSettings> {
    try {
      const {
        theme,
        is_public,
        custom_domain,
        seo_title,
        seo_description,
        seo_keywords,
        analytics_enabled
      } = settingsData;

      // Map is_public to privacy_level if provided
      const actualPrivacyLevel = is_public !== undefined 
        ? (is_public ? 'public' : 'private')
        : undefined;

      const query = `
        UPDATE portfolio_settings 
        SET 
          theme = COALESCE($1, theme),
          privacy_level = COALESCE($2, privacy_level),
          custom_domain = COALESCE($3, custom_domain),
          seo_title = COALESCE($4, seo_title),
          seo_description = COALESCE($5, seo_description),
          analytics_enabled = COALESCE($6, analytics_enabled),
          updated_at = NOW()
        WHERE user_id = $7
        RETURNING *
      `;

      const result = await db.query(query, [
        theme,
        actualPrivacyLevel,
        custom_domain,
        seo_title,
        seo_description,
        analytics_enabled,
        userId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Portfolio settings not found');
      }

      const row = result.rows[0];
      return {
        user_id: row.user_id,
        theme: row.theme,
        is_public: row.privacy_level === 'public',
        custom_domain: row.custom_domain,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        seo_keywords: row.seo_keywords,
        analytics_enabled: row.analytics_enabled,
        show_contact_form: true,
        show_download_cv: true,
        social_links: row.social_links || [],
        custom_sections: row.custom_sections,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error: any) {
      console.error('Error in updateSettings:', error);
      throw new Error('Failed to update portfolio settings');
    }
  }

  private async trackView(
    portfolioUserId: string,
    viewerIp: string,
    userAgent?: string,
    referrer?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO portfolio_views (
          user_id, viewer_ip, viewer_user_agent, referrer_url
        ) VALUES ($1, $2, $3, $4)
      `;
      await db.query(query, [portfolioUserId, viewerIp, userAgent, referrer]);
    } catch (error: any) {
      console.error('Error tracking view:', error);
    }
  }

  // Add this method to handle camelCase to snake_case conversion
private mapToSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => this.mapToSnakeCase(item));
  }
  
  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = this.mapToSnakeCase(obj[key]);
  }
  return result;
}

// Add this method to normalize CV data format
private _normalizeCVData(input?: Partial<CVData>): CVData {
  const mappedInput = this.mapToSnakeCase(input);
  
  // Handle skills that might come in different formats
  let skillsArray: any[] = [];
  if (mappedInput?.skills) {
    if (Array.isArray(mappedInput.skills)) {
      skillsArray = mappedInput.skills;
    } else if (typeof mappedInput.skills === 'object') {
      const skillsObj = mappedInput.skills as any;
      
      if (skillsObj.technical || skillsObj.soft) {
        const technical = (skillsObj.technical || []).map((skill: any) => ({
          ...skill,
          category: skill.category || 'Technical'
        }));
        const soft = (skillsObj.soft || []).map((skill: any) => ({
          ...skill,
          category: skill.category || 'Soft Skills'
        }));
        skillsArray = [...technical, ...soft];
      } else {
        skillsArray = Object.values(skillsObj).flat();
      }
    }
  }
  
  return {
    personal_info: mappedInput?.personal_info || {
      full_name: '',
      email: '',
      phone: '',
      address: '',
      professional_summary: ''
    },
    skills: skillsArray,
    work_experience: mappedInput?.work_experience || [],
    education: mappedInput?.education || [],
    projects: mappedInput?.projects || [],
    certifications: mappedInput?.certifications || [],
  };
}

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
        WHERE user_id = $1 ${dateFilter}
      `;
      const totalViews = await db.query(totalViewsQuery, params);

      const viewsByDateQuery = `
        SELECT DATE(viewed_at) as date, COUNT(*) as views
        FROM portfolio_views
        WHERE user_id = $1 ${dateFilter}
        GROUP BY DATE(viewed_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      const viewsByDate = await db.query(viewsByDateQuery, params);

      const topReferrersQuery = `
        SELECT referrer_url as referrer, COUNT(*) as count
        FROM portfolio_views
        WHERE user_id = $1 ${dateFilter} AND referrer_url IS NOT NULL
        GROUP BY referrer_url
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

        if (pi.professional_summary) {
          doc.fontSize(16).fillColor('#2c3e50').text('ABOUT ME', { underline: true });
          doc.moveDown(0.3);
          doc.fontSize(11).fillColor('#34495e').text(pi.professional_summary, { align: 'justify' });
          doc.moveDown(1);
        }

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

  async addTestimonial(userId: string, testimonialData: any): Promise<any> {
    try {
      const query = `
        INSERT INTO portfolio_testimonials (
          user_id, author_name, author_position, author_company, testimonial_text
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await db.query(query, [
        userId,
        testimonialData.name,
        testimonialData.position,
        testimonialData.company,
        testimonialData.text
      ]);

      return result.rows[0];
    } catch (error: any) {
      console.error('Error adding testimonial:', error);
      throw new Error('Failed to add testimonial');
    }
  }

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