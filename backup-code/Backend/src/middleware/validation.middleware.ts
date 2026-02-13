// middleware/validation.middleware.ts - COMPLETE FIXED VERSION
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

// ============================================================================
// TRAINING VALIDATION
// ============================================================================

export const validateTrainingData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { 
    title, description, category, level, duration_hours, cost_type, mode, 
    provider_name, sessions, outcomes, 
    application_deadline, start_date, end_date, max_participants 
  } = req.body;
  
  const errors: string[] = [];
  const isCreating = req.method === 'POST';
  const isUpdating = req.method === 'PUT' || req.method === 'PATCH';

  console.log('🔍 Validating training data:', {
    method: req.method,
    isCreating,
    isUpdating,
    userId: req.user?.id,
    userType: req.user?.user_type,
    mode: mode,
    modeType: typeof mode
  });

  // ✅ Basic fields validation (required for creation, optional for update)
  if (isCreating) {
    if (!title || title.trim().length < 3) {
      errors.push('Title must be at least 3 characters long');
    }

    if (!description || description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!category || category.trim().length < 2) {
      errors.push('Category is required');
    }

    if (!level || !['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
      errors.push('Level must be Beginner, Intermediate, or Advanced');
    }

    if (!duration_hours || duration_hours < 1) {
      errors.push('Duration must be at least 1 hour');
    }

    if (!cost_type || !['Free', 'Paid'].includes(cost_type)) {
      errors.push('Cost type must be Free or Paid');
    }

    if (!mode || !['Online', 'Hybrid', 'Offline'].includes(mode)) {
      errors.push(`Mode must be Online, Hybrid, or Offline. Received: "${mode}"`);
    }

    if (!provider_name || provider_name.trim().length < 2) {
      errors.push('Provider name is required');
    }

    if (!application_deadline) {
      errors.push('Application deadline is required');
    }

    if (!start_date) {
      errors.push('Training start date is required');
    }

    if (!end_date) {
      errors.push('Training end date is required');
    }
  } else if (isUpdating) {
    // For updates, only validate if fields are provided
    if (title !== undefined && title.trim().length < 3) {
      errors.push('Title must be at least 3 characters long');
    }

    if (description !== undefined && description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (category !== undefined && category.trim().length < 2) {
      errors.push('Category is required');
    }

    if (level !== undefined && !['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
      errors.push('Level must be Beginner, Intermediate, or Advanced');
    }

    if (duration_hours !== undefined && duration_hours < 1) {
      errors.push('Duration must be at least 1 hour');
    }

    if (cost_type !== undefined && !['Free', 'Paid'].includes(cost_type)) {
      errors.push('Cost type must be Free or Paid');
    }

    if (mode !== undefined && !['Online', 'Hybrid', 'Offline'].includes(mode)) {
      errors.push(`Mode must be Online, Hybrid, or Offline. Received: "${mode}"`);
    }

    if (provider_name !== undefined && provider_name.trim().length < 2) {
      errors.push('Provider name is required');
    }
  }

  // Conditional field validation
  if (cost_type === 'Paid' && (!req.body.price || req.body.price <= 0)) {
    errors.push('Price is required for paid trainings');
  }

  if ((mode === 'Offline' || mode === 'Hybrid') && !req.body.location) {
    errors.push('Location is required for offline/hybrid trainings');
  }

  // Validate date sequence if dates are provided
  if (application_deadline && start_date) {
    const deadlineDate = new Date(application_deadline);
    const startDateObj = new Date(start_date);
    
    if (isNaN(deadlineDate.getTime())) {
      errors.push('Invalid application deadline format');
    }
    
    if (isNaN(startDateObj.getTime())) {
      errors.push('Invalid start date format');
    }
    
    if (!isNaN(deadlineDate.getTime()) && !isNaN(startDateObj.getTime())) {
      if (deadlineDate >= startDateObj) {
        errors.push('Application deadline must be before training start date');
      }
    }
  }

  if (start_date && end_date) {
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    if (isNaN(endDateObj.getTime())) {
      errors.push('Invalid end date format');
    }
    
    if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
      if (startDateObj >= endDateObj) {
        errors.push('Training end date must be after start date');
      }
    }
  }

  // Sessions validation
  if (sessions !== undefined && sessions !== null) {
    if (!Array.isArray(sessions)) {
      errors.push('Sessions must be an array');
    } else if (sessions.length > 0) {
      sessions.forEach((session: any, index: number) => {
        if (!session.title || session.title.trim().length < 3) {
          errors.push(`Session ${index + 1}: Title is required (min 3 characters)`);
        }
        if (!session.scheduled_at) {
          errors.push(`Session ${index + 1}: Scheduled date/time is required`);
        } else {
          const sessionDate = new Date(session.scheduled_at);
          if (isNaN(sessionDate.getTime())) {
            errors.push(`Session ${index + 1}: Invalid date format`);
          }
        }
        if (!session.duration_minutes || session.duration_minutes < 15) {
          errors.push(`Session ${index + 1}: Duration must be at least 15 minutes`);
        }
        if (session.meeting_url && !isValidUrl(session.meeting_url)) {
          errors.push(`Session ${index + 1}: Invalid meeting URL format`);
        }
      });
    }
  }

  // Validate outcomes
  if (outcomes && Array.isArray(outcomes)) {
    outcomes.forEach((outcome: any, index: number) => {
      if (!outcome.outcome_text || outcome.outcome_text.trim().length < 5) {
        errors.push(`Outcome ${index + 1}: Must be at least 5 characters`);
      }
    });
  }

  // Validate max_participants
  if (max_participants !== undefined && max_participants !== null) {
    if (max_participants < 1 || max_participants > 10000) {
      errors.push('Max participants must be between 1 and 10000');
    }
  }

  // ✅ Validate user authentication
  if (!req.user?.id) {
    errors.push('User authentication required');
  }

  if (req.user?.user_type !== 'employer') {
    errors.push('Only employers can create/update trainings');
  }

  if (errors.length > 0) {
    console.error('❌ Validation errors:', errors);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  console.log('✅ Validation passed');
  next();
};

// Helper function to validate URLs
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

// ============================================================================
// APPLICATION VALIDATION
// ============================================================================

export const validateApplicationData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const errors: string[] = [];

  console.log('🔍 Validating application data:', {
    userId: req.user?.id,
    userType: req.user?.user_type,
    hasMotivation: !!req.body.motivation
  });

  // Motivation is optional, but if provided must meet minimum length
  if (req.body.motivation && req.body.motivation.trim().length < 10) {
    errors.push('Motivation letter must be at least 10 characters if provided');
  }

  // ✅ Check authentication
  if (!req.user?.id) {
    errors.push('Authentication required');
  }

  // ✅ Check user type
  if (req.user?.user_type !== 'jobseeker') {
    errors.push('Only job-seekers can apply for trainings');
  }

  if (errors.length > 0) {
    console.error('❌ Application validation errors:', errors);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
    return;
  }

  console.log('✅ Application validation passed');
  next();
};

// ============================================================================
// SHORTLIST DECISION VALIDATION
// ============================================================================

export const validateShortlistDecision = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { decision, employer_notes } = req.body;
  const errors: string[] = [];

  if (!decision || !['shortlisted', 'rejected'].includes(decision)) {
    errors.push('Decision must be either "shortlisted" or "rejected"');
  }

  if (employer_notes && employer_notes.length > 1000) {
    errors.push('Employer notes must not exceed 1000 characters');
  }

  if (!req.user?.id) {
    errors.push('Authentication required');
  }

  if (req.user?.user_type !== 'employer') {
    errors.push('Only employers can shortlist applicants');
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

// ============================================================================
// COMPLETION MARKING VALIDATION
// ============================================================================

export const validateCompletionMarking = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { completed, employer_notes } = req.body;
  const errors: string[] = [];

  if (typeof completed !== 'boolean') {
    errors.push('Completed field must be a boolean (true or false)');
  }

  if (employer_notes && employer_notes.length > 1000) {
    errors.push('Employer notes must not exceed 1000 characters');
  }

  if (!req.user?.id) {
    errors.push('Authentication required');
  }

  if (req.user?.user_type !== 'employer') {
    errors.push('Only employers can mark completion');
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

// ============================================================================
// REVIEW VALIDATION
// ============================================================================

export const validateReviewData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { rating, review_text } = req.body;
  const errors: string[] = [];

  if (!rating || rating < 1 || rating > 5) {
    errors.push('Rating must be between 1 and 5');
  }

  if (review_text && review_text.trim().length < 5) {
    errors.push('Review text must be at least 5 characters if provided');
  }

  if (review_text && review_text.length > 1000) {
    errors.push('Review text must not exceed 1000 characters');
  }

  if (!req.user?.id) {
    errors.push('Authentication required');
  }

  if (req.user?.user_type !== 'jobseeker') {
    errors.push('Only enrolled job-seekers can submit reviews');
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

export const validateIntegerId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  
  const numericId = parseInt(id, 10);
  
  if (isNaN(numericId) || numericId < 1) {
    res.status(400).json({
      success: false,
      message: 'Invalid ID format - must be a positive integer'
    });
    return;
  }
  
  next();
};

// ============================================================================
// ID VALIDATION
// ============================================================================

export const validateId = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  
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

// ============================================================================
// MULTIPLE IDS VALIDATION
// ============================================================================

export const validateMultipleIds = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    paramNames.forEach(paramName => {
      const value = req.params[paramName];
      if (!value || !uuidRegex.test(value)) {
        errors.push(`Invalid ${paramName} format`);
      }
    });

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
};