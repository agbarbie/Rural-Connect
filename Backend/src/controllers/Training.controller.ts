// controllers/training.controller.ts
import { Response, NextFunction } from 'express';
import { TrainingService } from '../services/training.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { 
  CreateTrainingRequest, 
  UpdateTrainingRequest,
  TrainingSearchParams
} from '../types/training.type';

export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  getAllTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const params: TrainingSearchParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sort_by: (req.query.sort_by as any) || 'created_at',
        sort_order: (req.query.sort_order as 'asc' | 'desc') || 'desc',
        filters: {
          category: req.query.category as string,
          level: req.query.level ? [req.query.level as string] : undefined,
          search: req.query.search as string
        }
      };

      const employerId = req.user?.user_type === 'employer' ? req.user.employer_id : undefined;
      const result = await this.trainingService.getAllTrainings(params, employerId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getTrainingById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const training = await this.trainingService.getTrainingById(id);
      
      if (!training) {
        return res.status(404).json({
          success: false,
          message: 'Training not found'
        });
      }

      res.status(200).json({
        success: true,
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  createTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.user_type !== 'employer' || !req.user.employer_id) {
        return res.status(403).json({
          success: false,
          message: 'Only employers can create trainings'
        });
      }

      const trainingData: CreateTrainingRequest = req.body;
      const training = await this.trainingService.createTraining(trainingData, req.user.employer_id);
      
      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  updateTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.user_type !== 'employer' || !req.user.employer_id) {
        return res.status(403).json({
          success: false,
          message: 'Only employers can update trainings'
        });
      }

      const { id } = req.params;
      const updateData: UpdateTrainingRequest = req.body;
      
      const training = await this.trainingService.updateTraining(id, updateData, req.user.employer_id);
      
      if (!training) {
        return res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Training updated successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.user_type !== 'employer' || !req.user.employer_id) {
        return res.status(403).json({
          success: false,
          message: 'Only employers can delete trainings'
        });
      }

      const { id } = req.params;
      const deleted = await this.trainingService.deleteTraining(id, req.user.employer_id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Training deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getTrainingStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.user_type !== 'employer' || !req.user.employer_id) {
        return res.status(403).json({
          success: false,
          message: 'Only employers can view training statistics'
        });
      }

      const stats = await this.trainingService.getTrainingStats(req.user.employer_id);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  publishTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.user_type !== 'employer' || !req.user.employer_id) {
        return res.status(403).json({
          success: false,
          message: 'Only employers can publish trainings'
        });
      }

      const { id } = req.params;
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'published' }, 
        req.user.employer_id
      );
      
      if (!training) {
        return res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Training published successfully',
        data: training
      });
    } catch (error) {
      next(error);
    }
  };
}