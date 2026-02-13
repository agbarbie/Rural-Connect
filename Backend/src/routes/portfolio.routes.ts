import { Router } from 'express';
import {PortfolioController} from '../controllers/portfolio.controller';                            
import { authenticate } from '../middleware/auth.middleware';
import { isJobseeker } from '../middleware/role.middleware';

const router = Router();
const portfolioController = new PortfolioController();

// Protected routes (require authentication)
router.get('/my-portfolio', authenticate, isJobseeker, portfolioController.getMyPortfolio);
router.get('/settings', authenticate, isJobseeker, (portfolioController as any).getPortfolioSettings);
router.put('/settings', authenticate, isJobseeker, (portfolioController as any).updatePortfolioSettings);
router.get('/analytics', authenticate, isJobseeker, portfolioController.getPortfolioAnalytics);
router.get('/export-pdf', authenticate, isJobseeker, portfolioController.exportPortfolioPDF);
router.post('/testimonials', authenticate, isJobseeker, portfolioController.addTestimonial);
router.delete('/testimonials/:testimonialId', authenticate, isJobseeker, portfolioController.deleteTestimonial);

// Public routes (no authentication required)
router.get('/public/:identifier', (req, res, next) => {
  // call controller method if implemented, otherwise return 501
  const handler = (portfolioController as any).getPublicPortfolio;
  if (typeof handler === 'function') return handler.call(portfolioController, req, res, next);
  return res.status(501).json({ error: 'getPublicPortfolio not implemented' });
});

export default router;