// routes/notification.routes.ts
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import { authenticate } from '../middleware/auth.middleware';
import { Pool } from 'pg';

export function createNotificationRoutes(db: Pool): Router {
  const router = Router();
  const trainingService = new TrainingService(db);
  const trainingController = new TrainingController(trainingService);

  const bind = (fn: Function) => fn.bind(trainingController);

  // Get user's notifications
  router.get(
    '/',
    authenticate,
    bind(trainingController.getNotifications)
  );

  // Mark notification as read - REMOVED validateId since IDs are integers
  router.patch(
    '/:id/read',
    authenticate,
    bind(trainingController.markNotificationRead)
  );

  return router;
}