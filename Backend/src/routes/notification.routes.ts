// routes/notification.routes.ts
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import { authenticate } from '../middleware/auth.middleware';
import { validateId } from '../middleware/validation.middleware';
import { Pool } from 'pg';

export function createNotificationRoutes(db: Pool): Router {
  const router = Router();
  const trainingService = new TrainingService(db);
  const trainingController = new TrainingController(trainingService);

  // Bind methods to preserve 'this' context
  const bind = (fn: Function) => fn.bind(trainingController);

  // ==========================================================================
  // NOTIFICATION ENDPOINTS
  // ==========================================================================

  // Get user's notifications
  // GET /api/notifications
  // GET /api/notifications?read=false (unread only)
  // GET /api/notifications?page=1&limit=10
  router.get(
    '/',
    authenticate,
    bind(trainingController.getNotifications)
  );

  // Mark notification as read
  // PATCH /api/notifications/:id/read
  router.patch(
    '/:id/read',
    authenticate,
    validateId,
    bind(trainingController.markNotificationRead)
  );

  return router;
}