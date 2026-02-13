// middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

// Simple validation helper
export const validateTrainingData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { title, description, category, level, duration_hours, cost_type, mode, provider_name } = req.body;
  
  const errors: string[] = [];

  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }

  if (!description || description.trim().length < 10) {
    errors.push('Description must be at least 10 characters long');
  }

  if (!category || category.trim().length < 2) {
    errors.push('Category is required');
  }

  if (!['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
    errors.push('Level must be Beginner, Intermediate, or Advanced');
  }

  if (!duration_hours || duration_hours < 1) {
    errors.push('Duration must be at least 1 hour');
  }

  if (!['Free', 'Paid'].includes(cost_type)) {
    errors.push('Cost type must be Free or Paid');
  }

  if (!['Online', 'Offline'].includes(mode)) {
    errors.push('Mode must be Online or Offline');
  }

  if (!provider_name || provider_name.trim().length < 2) {
    errors.push('Provider name is required');
  }

  if (cost_type === 'Paid' && (!req.body.price || req.body.price <= 0)) {
    errors.push('Price is required for paid trainings');
  }

  if (mode === 'Offline' && !req.body.location) {
    errors.push('Location is required for offline trainings');
  }

  // Validate user authentication
  if (!req.user?.id) {
    errors.push('User authentication required');
  }

  if (req.user?.user_type !== 'employer') {
    errors.push('Only employers can create trainings');
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  next();
};

export const validateId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  
  // Simple UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
    return;
  }
  
  next();
};