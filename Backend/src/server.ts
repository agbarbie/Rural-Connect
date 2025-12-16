import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import jobRoutes from './routes/jobs.routes';
import trainingRoutes from './routes/Training.routes';
import cvBuilderRoutes from './routes/cv-builder.routes';
import portfolioRoutes from './routes/portfolio.routes';
import profileRoutes from './routes/profile.routes';
import geminiRoutes from './routes/gemini.routes';
import candidatesRoutes from './routes/candidates.routes';
import pool from './db/db.config';
import path from 'path';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// Debug database connection values
console.log('DB Connection Debug:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD type:', typeof process.env.DB_PASSWORD);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD?.length);
console.log('DB_PORT:', process.env.DB_PORT);

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'] as const;
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.error('Please ensure you have the following in your .env file:');
  console.error('- DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
  console.error('- JWT_SECRET');
  process.exit(1);
}

// Test database connection on startup
pool.connect()
  .then(async (client) => {
    console.log('Database connected successfully');
    
    // Test basic queries to ensure tables exist
    try {
      await client.query('SELECT 1 FROM users LIMIT 1');
      console.log('✓ Users table accessible');
      
      await client.query('SELECT 1 FROM jobs LIMIT 1');
      console.log('✓ Jobs table accessible');
      
      await client.query('SELECT 1 FROM job_applications LIMIT 1');
      console.log('✓ Job applications table accessible');
      // Test training-related tables
      await client.query('SELECT 1 FROM trainings LIMIT 1');
      console.log('✓ Trainings table accessible');
      
      await client.query('SELECT 1 FROM training_enrollments LIMIT 1');
      console.log('✓ Training enrollments table accessible');
      // Test portfolio-related tables
      await client.query('SELECT 1 FROM portfolio_settings LIMIT 1');
      console.log('✓ Portfolio settings table accessible');
      
      await client.query('SELECT 1 FROM portfolio_views LIMIT 1');
      console.log('✓ Portfolio views table accessible');
      
      await client.query('SELECT 1 FROM portfolio_testimonials LIMIT 1');
      console.log('✓ Portfolio testimonials table accessible');
      // Test candidates-related tables
      await client.query('SELECT 1 FROM shortlisted_candidates LIMIT 1');
      console.log('✓ Shortlisted candidates table accessible');
      
      await client.query('SELECT 1 FROM job_invitations LIMIT 1');
      console.log('✓ Job invitations table accessible');
      
      await client.query('SELECT 1 FROM notifications LIMIT 1');
      console.log('✓ Notifications table accessible');
      
    } catch (tableError: any) {
      console.warn('Database tables might need migration:', tableError.message);
      console.warn('Please run the database migration script to ensure all tables exist');
      
      // List expected tables
      const expectedTables = [
        'users', 'jobs', 'job_applications',
        'trainings', 'training_videos', 'training_outcomes',
        'training_enrollments', 'training_video_progress', 'training_reviews',
        'cvs', 'portfolio_settings', 'portfolio_views', 'portfolio_testimonials',
        'shortlisted_candidates', 'job_invitations', 'notifications'
      ];
      console.warn('Expected tables:', expectedTables.join(', '));
    }
    
    client.release();
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
    console.error('\nPlease check your database configuration and ensure PostgreSQL is running');
    process.exit(1);
  });

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:4200', // Angular dev server
    'http://localhost:3000', // React dev server
    'http://localhost:5000', // This server
    'http://localhost:8080' // Alternative frontend port
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  optionsSuccessStatus: 200 // For legacy browser support
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  
  if (req.headers.authorization) {
    console.log('Authorization header present');
  }
  
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    ['password', 'token', 'secret'].forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });
    console.log('Request body:', sanitizedBody);
  }
  
  next();
});

// Status code validation middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalStatus = res.status;
  res.status = function (code: any) {
    if (typeof code !== 'number' || isNaN(code) || code < 100 || code > 599) {
      console.error(`Invalid status code detected: ${code} for ${req.method} ${req.url}`);
      console.error('Stack trace:', new Error('Invalid status code').stack);
      return originalStatus.call(this, 500).json({
        success: false,
        message: 'Internal server error: Invalid status code provided',
        endpoint: `${req.method} ${req.url}`,
        invalidCode: code,
        timestamp: new Date().toISOString()
      });
    }
    return originalStatus.call(this, code);
  };
  next();
});

// Static file serving
app.use('/uploads/cvs', express.static(path.join(__dirname, '../uploads/cvs')));
app.use('/uploads/profile-images', express.static(path.join(__dirname, '../uploads/profile-images')));
app.use('/uploads/certificates', express.static(path.join(__dirname, '../uploads/certificates')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Debug route registration
console.log('Registering routes:');
console.log('- Auth routes: /api/auth/*');
console.log('- Job routes: /api/jobs/*');
console.log('- Training routes: /api/trainings/*');
console.log('- CV Builder routes: /api/cv/*');
console.log('- Portfolio routes: /api/portfolio/*');
console.log('- Profile routes: /api/profile/*');
console.log('- Gemini AI routes: /api/gemini/*');
console.log('- Employer candidates routes: /api/employer/*');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/cv', cvBuilderRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/employer', candidatesRoutes);
app.use('/api/profile', profileRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Job Portal API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      jobs: '/api/jobs',
      trainings: '/api/trainings',
      cv: '/api/cv',
      portfolio: '/api/portfolio',
      profile: '/api/profile',
      gemini: '/api/gemini',
      employer: '/api/employer',
      health: '/health',
      database_health: '/health/db'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    uptime: process.uptime()
  });
});

// Database health check
app.get('/health/db', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    const responseTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      message: 'Database connection is healthy',
      timestamp: new Date().toISOString(),
      db_time: result.rows[0].current_time,
      postgres_version: result.rows[0].postgres_version,
      response_time_ms: responseTime
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API documentation endpoint
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Job Portal API Documentation',
    version: '1.0.0',
    endpoints: {
      authentication: {
        base: '/api/auth',
        routes: [
          'POST /api/auth/register',
          'POST /api/auth/login',
          'POST /api/auth/logout',
          'GET /api/auth/profile',
          'PUT /api/auth/profile'
        ]
      },
      jobs: {
        base: '/api/jobs',
        public_routes: [
          'GET /api/jobs - Get all jobs (with filters)',
          'GET /api/jobs/details/:jobId - Get job details',
          'GET /api/jobs/stats'
        ],
        jobseeker_routes: [
          'GET /api/jobs/jobseeker/recommended - Get recommended jobs',
          'POST /api/jobs/jobseeker/bookmark/:jobId - Save job',
          'DELETE /api/jobs/jobseeker/bookmark/:jobId - Unsave job',
          'GET /api/jobs/jobseeker/bookmarked - Get saved jobs',
          'POST /api/jobs/jobseeker/apply/:jobId - Apply to job',
          'GET /api/jobs/jobseeker/applications - Get applications',
          'GET /api/jobs/jobseeker/stats - Get jobseeker statistics'
        ],
        employer_routes: [
          'POST /api/jobs - Create job',
          'GET /api/jobs/my-jobs - Get employer jobs',
          'PUT /api/jobs/employer/:jobId - Update job',
          'DELETE /api/jobs/employer/:jobId - Delete job',
          'GET /api/jobs/employer/:jobId/applications - Get job applications'
        ]
      },
      trainings: {
        base: '/api/trainings',
        public_routes: [
          'GET /api/trainings - Get all trainings (with optional auth)',
          'GET /api/trainings/categories - Get training categories',
          'GET /api/trainings/:id - Get training by ID (with optional auth)'
        ],
        jobseeker_routes: [
          'GET /api/trainings/jobseeker/available - Get available trainings for jobseekers',
          'GET /api/trainings/jobseeker/enrolled - Get enrolled trainings',
          'GET /api/trainings/jobseeker/stats - Get jobseeker training statistics',
          'GET /api/trainings/jobseeker/recommendations - Get recommended trainings',
          'POST /api/trainings/:trainingId/enroll - Enroll in a training',
          'DELETE /api/trainings/:trainingId/enroll - Unenroll from a training',
          'GET /api/trainings/:trainingId/progress - Get training progress',
          'PUT /api/trainings/:trainingId/progress - Update training progress',
          'POST /api/trainings/:trainingId/review - Submit training review'
        ],
        employer_routes: [
          'GET /api/trainings/stats/overview - Get training statistics overview',
          'POST /api/trainings - Create new training',
          'PUT /api/trainings/:id - Update training',
          'DELETE /api/trainings/:id - Delete training',
          'POST /api/trainings/:id/publish - Publish training'
        ]
      },
      cv_builder: {
        base: '/api/cv',
        routes: [
          'POST /api/cv/create - Create new CV',
          'GET /api/cv/my-cvs - Get all user CVs',
          'GET /api/cv/:id - Get specific CV',
          'PUT /api/cv/:id - Update CV',
          'DELETE /api/cv/:id - Delete CV',
          'POST /api/cv/upload - Upload CV file',
          'POST /api/cv/:id/draft - Save as draft',
          'POST /api/cv/:id/final - Save as final',
          'GET /api/cv/:id/export/pdf - Export to PDF',
          'GET /api/cv/:id/export/docx - Export to Word'
        ],
        authentication: 'Required - Jobseeker role only'
      },
      portfolio: {
        base: '/api/portfolio',
        jobseeker_routes: [
          'GET /api/portfolio/my-portfolio - Get user portfolio data',
          'GET /api/portfolio/settings - Get portfolio settings',
          'PUT /api/portfolio/settings - Update portfolio settings',
          'GET /api/portfolio/analytics - Get portfolio analytics',
          'GET /api/portfolio/export-pdf - Export portfolio as PDF',
          'POST /api/portfolio/testimonials - Add testimonial',
          'DELETE /api/portfolio/testimonials/:testimonialId - Delete testimonial'
        ],
        public_routes: [
          'GET /api/portfolio/public/:identifier - Get public portfolio by user ID or email'
        ],
        authentication: 'Required for protected routes - Jobseeker role only',
        features: [
          'Public portfolio viewing with privacy controls',
          'View tracking and analytics',
          'Customizable themes and settings',
          'Testimonials management',
          'SEO optimization',
          'PDF export functionality'
        ]
      },
      profile: {
        base: '/api/profile',
        routes: [
          'GET /api/profile - Get current user profile',
          'PATCH /api/profile - Update current user profile',
          'GET /api/profile/cv/:cvId - Get profile by specific CV ID',
          'GET /api/profile/completion - Get profile completion status',
          'PUT /api/profile/picture - Update profile picture',
          'POST /api/profile/share - Generate shareable profile link',
          'GET /api/profile/shared/:token - Get shared profile (public access)'
        ],
        authentication: 'Required for most routes - Jobseeker role only'
      },
      gemini: {
        base: '/api/gemini',
        routes: [
          'GET /api/gemini/recommendations - Get initial career recommendations',
          'POST /api/gemini/chat - Send chat message to Gemini AI',
          'GET /api/gemini/jobs - Get job recommendations with filters',
          'GET /api/gemini/skill-gaps - Get skill gap analysis',
          'GET /api/gemini/career-path - Get career path recommendations',
          'POST /api/gemini/simulate-skill - Simulate adding a skill',
          'POST /api/gemini/feedback - Submit feedback on AI recommendations'
        ],
        authentication: 'Required - Jobseeker role only',
        features: [
          'AI-powered career recommendations',
          'Personalized job matching',
          'Skill gap analysis',
          'Career path guidance',
          'Conversational AI assistant',
          'What-if skill simulation'
        ]
      },
      employer: {
        base: '/api/employer',
        routes: [
          'GET /api/employer/candidates - Get all candidates (applicants) for employer\'s jobs',
          'GET /api/employer/job-posts - Get employer\'s job posts with application counts',
          'GET /api/employer/candidates/:userId - Get candidate full profile',
          'POST /api/employer/candidates/:userId/shortlist - Shortlist/Unshortlist a candidate',
          'POST /api/employer/candidates/:userId/invite - Send invite to candidate'
        ],
        authentication: 'Required - Employer role only',
        features: [
          'Candidate filtering and sorting by match score, location, experience',
          'Batch shortlisting and bulk invitations',
          'Application status management',
          'AI-powered candidate insights'
        ]
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Include JWT token for protected routes',
      user_types: {
        jobseeker: 'Can manage CV, portfolio, enroll in trainings, apply for jobs, use AI assistant',
        employer: 'Can create jobs and trainings, manage applications and candidates',
        admin: 'Full system access'
      }
    }
  });
});

// 404 handler - Updated to app.all for Express v5 compatibility
app.all('*', (req: Request, res: Response) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_routes: [
      '/api/auth/*',
      '/api/jobs/*',
      '/api/trainings/*',
      '/api/cv/*',
      '/api/portfolio/*',
      '/api/profile/*',
      '/api/gemini/*',
      '/api/employer/*',
      '/health',
      '/health/db',
      '/api'
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  // Database connection errors
  if (error.code && error.code.startsWith('28')) {
    res.status(500).json({
      success: false,
      message: 'Database connection error',
      timestamp: new Date().toISOString()
    });
    return;
  }
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    });
    return;
  }
  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Token expired',
      timestamp: new Date().toISOString()
    });
    return;
  }
  // Validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
    return;
  }
  // Database constraint errors
  if (error.code === '23505') { // Unique constraint violation
    res.status(409).json({
      success: false,
      message: 'Resource already exists',
      details: 'This operation conflicts with existing data',
      timestamp: new Date().toISOString()
    });
    return;
  }
  if (error.code === '23503') { // Foreign key constraint violation
    res.status(400).json({
      success: false,
      message: 'Invalid reference',
      details: 'Referenced resource does not exist',
      timestamp: new Date().toISOString()
    });
    return;
  }
  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      error: error.message,
      stack: error.stack
    })
  });
  return;
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  try {
    await pool.end();
    console.log('Database connections closed.');
    
    setTimeout(() => {
      console.log('Server shutdown complete.');
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Job Portal API Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`💾 Database health: http://localhost:${PORT}/health/db`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(` • Authentication: http://localhost:${PORT}/api/auth`);
  console.log(` • Jobs: http://localhost:${PORT}/api/jobs`);
  console.log(` • Training: http://localhost:${PORT}/api/trainings`);
  console.log(` • CV Builder: http://localhost:${PORT}/api/cv`);
  console.log(` • Portfolio: http://localhost:${PORT}/api/portfolio`);
  console.log(` • Profile: http://localhost:${PORT}/api/profile`);
  console.log(` • Gemini AI: http://localhost:${PORT}/api/gemini`);
  console.log(` • Employer Candidates: http://localhost:${PORT}/api/employer`);
  console.log(`\n🎓 Features:`);
  console.log(` • Jobseekers: CV building, portfolio management, job applications, training enrollment`);
  console.log(` • Employers: Job postings, training creation, applicant management, candidate shortlisting`);
  console.log(` • Portfolio: Public/private portfolios with analytics and PDF export`);
  console.log(` • AI Assistant: Personalized career guidance powered by Gemini AI`);
  console.log(`\n🔐 Remember to include 'Authorization: Bearer <token>' header for protected routes`);
});

export default app;