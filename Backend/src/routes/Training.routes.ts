// routes/training.routes.ts
import { Router } from 'express';
import { TrainingController } from '../controllers/Training.controller';
import { TrainingService } from '../services/training.service';
import {
   authenticateToken,
   requireEmployerWithId, // Changed from requireEmployer
   optionalAuth
} from '../middleware/auth.middleware';
import db from '../db/db.config';

const router = Router();
const trainingService = new TrainingService(db);
const trainingController = new TrainingController(trainingService);

// Public routes
router.get('/', optionalAuth, trainingController.getAllTrainings);

// Protected routes - require authentication
router.use(authenticateToken);

// Employer-only routes - SPECIFIC ROUTES FIRST!
router.get('/stats/overview', requireEmployerWithId, trainingController.getTrainingStats);
router.post('/', requireEmployerWithId, trainingController.createTraining);
router.put('/:id', requireEmployerWithId, trainingController.updateTraining);
router.delete('/:id', requireEmployerWithId, trainingController.deleteTraining);
router.post('/:id/publish', requireEmployerWithId, trainingController.publishTraining);

// PARAMETERIZED ROUTES LAST
router.get('/:id', optionalAuth, trainingController.getTrainingById);

export default router;