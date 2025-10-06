import { Router } from 'express';
import { PortfolioController } from '../controllers/portfolio.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { isJobseeker } from '../middleware/role.middleware';

const router = Router();
const portfolioController = new PortfolioController();

// Protected routes (require authentication)
router.get('/my-portfolio', authenticateToken, isJobseeker, portfolioController.getMyPortfolio);
router.get('/settings', authenticateToken, isJobseeker, portfolioController.getPortfolioSettings);
router.put('/settings', authenticateToken, isJobseeker, portfolioController.updatePortfolioSettings);
router.get('/analytics', authenticateToken, isJobseeker, portfolioController.getPortfolioAnalytics);
router.get('/export-pdf', authenticateToken, isJobseeker, portfolioController.exportPortfolioPDF);
router.post('/testimonials', authenticateToken, isJobseeker, portfolioController.addTestimonial);
router.delete('/testimonials/:testimonialId', authenticateToken, isJobseeker, portfolioController.deleteTestimonial);

// Public routes (no authentication required)
router.get('/public/:identifier', portfolioController.getPublicPortfolio);

export default router;