import { Request, Response, NextFunction } from 'express';
import { PortfolioService } from '../services/portfolio.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class PortfolioController {
  private portfolioService: PortfolioService;

  constructor() {
    this.portfolioService = new PortfolioService();
  }

// In portfolio.controller.ts, update getMyPortfolio:

getMyPortfolio = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;

    console.log('🎯 getMyPortfolio called for user:', userId);

    if (!userId) {
      console.error('❌ No user ID in request');
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    console.log('📞 Calling portfolioService.getPortfolioByUserId');
    const portfolio = await this.portfolioService.getPortfolioByUserId(userId);

    console.log('✅ Portfolio retrieved successfully');

    res.status(200).json({
      success: true,
      message: 'Portfolio data retrieved successfully',
      data: portfolio
    });
  } catch (error: any) {
    console.error('❌ ERROR in getMyPortfolio controller:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch portfolio data',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

  // Get public portfolio by username or user ID
  getPublicPortfolio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier } = req.params; // Can be UUID or email
      const viewerIp = req.ip || req.socket.remoteAddress || 'unknown';

      const portfolio = await this.portfolioService.getPublicPortfolio(
        identifier,
        viewerIp,
        req.headers['user-agent'],
        req.headers.referer
      );

      res.status(200).json({
        success: true,
        message: 'Portfolio retrieved successfully',
        data: portfolio
      });
    } catch (error: any) {
      console.error('Error fetching public portfolio:', error);
      res.status(error.message.includes('not found') || error.message.includes('private') ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to fetch portfolio'
      });
    }
  };

  // Get or create portfolio settings
  getPortfolioSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const settings = await this.portfolioService.getOrCreateSettings(userId);

      res.status(200).json({
        success: true,
        message: 'Portfolio settings retrieved successfully',
        data: settings
      });
    } catch (error: any) {
      console.error('Error fetching portfolio settings:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch portfolio settings' });
    }
  };

  // Update portfolio settings
  updatePortfolioSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const settingsData = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const updatedSettings = await this.portfolioService.updateSettings(userId, settingsData);

      res.status(200).json({
        success: true,
        message: 'Portfolio settings updated successfully',
        data: updatedSettings
      });
    } catch (error: any) {
      console.error('Error updating portfolio settings:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to update portfolio settings' });
    }
  };

  // Get portfolio analytics
  getPortfolioAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const analytics = await this.portfolioService.getAnalytics(
        userId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: analytics
      });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch analytics' });
    }
  };

  // Export portfolio as PDF
  exportPortfolioPDF = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const pdfBuffer = await this.portfolioService.generatePortfolioPDF(userId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="portfolio.pdf"');
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating portfolio PDF:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate portfolio PDF' });
    }
  };

  // Add testimonial
  addTestimonial = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const testimonialData = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      if (!testimonialData.name || !testimonialData.text) {
        res.status(400).json({ success: false, message: 'Name and text are required for testimonials' });
        return;
      }

      const testimonial = await this.portfolioService.addTestimonial(userId, testimonialData);

      res.status(201).json({
        success: true,
        message: 'Testimonial added successfully',
        data: testimonial
      });
    } catch (error: any) {
      console.error('Error adding testimonial:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to add testimonial' });
    }
  };

  // Delete testimonial
  deleteTestimonial = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { testimonialId } = req.params;

      if (!userId) {
        res.status(401).json({ success: false, message: 'User not authenticated' });
        return;
      }

      const id = Number(testimonialId);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'Invalid testimonial ID' });
        return;
      }

      await this.portfolioService.deleteTestimonial(userId, id);

      res.status(200).json({
        success: true,
        message: 'Testimonial deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting testimonial:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to delete testimonial' });
    }
  };
}
