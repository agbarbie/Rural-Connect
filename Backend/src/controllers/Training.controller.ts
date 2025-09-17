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

  getAllTrainings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
      return;
    }
  };

  getTrainingById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const training = await this.trainingService.getTrainingById(id);
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: training
      });
    } catch (error) {
      next(error);
      return;
    }
  };

  createTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Remove duplicate authorization - middleware already handles this
      // The requireEmployerWithId middleware ensures we have employer_id
      const trainingData: CreateTrainingRequest = req.body;
      const training = await this.trainingService.createTraining(trainingData, req.user!.employer_id!);
      
      res.status(201).json({
        success: true,
        message: 'Training created successfully',
        data: training
      });
    } catch (error) {
      next(error);
      return;
    }
  };

  updateTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Remove duplicate authorization - middleware already handles this
      const { id } = req.params;
      const updateData: UpdateTrainingRequest = req.body;
      
      const training = await this.trainingService.updateTraining(id, updateData, req.user!.employer_id!);
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training updated successfully',
        data: training
      });
    } catch (error) {
      next(error);
      return;
    }
  };

  deleteTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Remove duplicate authorization - middleware already handles this
      const { id } = req.params;
      const deleted = await this.trainingService.deleteTraining(id, req.user!.employer_id!);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training deleted successfully'
      });
    } catch (error) {
      next(error);
      return;
    }
  };

  getTrainingStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Remove duplicate authorization - middleware already handles this
      const stats = await this.trainingService.getTrainingStats(req.user!.employer_id!);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
      return;
    }
  };

  publishTraining = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Remove duplicate authorization - middleware already handles this
      const { id } = req.params;
      const training = await this.trainingService.updateTraining(
        id, 
        { status: 'published' }, 
        req.user!.employer_id!
      );
      
      if (!training) {
        res.status(404).json({
          success: false,
          message: 'Training not found or access denied'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Training published successfully',
        data: training
      });
    } catch (error) {
      next(error);
      return;
    }
  };
}