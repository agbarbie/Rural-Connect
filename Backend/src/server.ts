import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import jobRoutes from './routes/jobs.routes';
import trainingRoutes from './routes/Training.routes';
import pool from './db/db.config';

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
      
    } catch (tableError: any) {
      console.warn('Database tables might need migration:', tableError.message);
      console.warn('Please run the database migration script to ensure all tables exist');
      
      // List expected training tables
      const expectedTables = [
        'trainings', 'training_videos', 'training_outcomes', 
        'training_enrollments', 'training_video_progress', 'training_reviews'
      ];
      console.warn('Expected training tables:', expectedTables.join(', '));
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
    'http://localhost:8080'  // Alternative frontend port
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

// Debug route registration
console.log('Registering routes:');
console.log('- Auth routes: /api/auth/*');
console.log('- Job routes: /api/jobs/*');
console.log('- Training routes: /api/trainings/*');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/trainings', trainingRoutes);

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
          'GET /stats'
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
          'GET /api/jobs/employer/:jobId/applications - Get job applications',
          
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
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Include JWT token for protected routes',
      user_types: {
        jobseeker: 'Can enroll in trainings, track progress, submit reviews',
        employer: 'Can create, manage, and publish trainings',
        admin: 'Full system access'
      }
    },
    training_features: {
      jobseeker_capabilities: [
        'Browse and search available trainings',
        'Enroll in and unenroll from trainings',
        'Track learning progress and completion',
        'Submit reviews and ratings',
        'Get personalized recommendations',
        'View training statistics and achievements'
      ],
      employer_capabilities: [
        'Create and manage training content',
        'Add videos, outcomes, and materials',
        'Set pricing and access controls',
        'Monitor enrollment and completion rates',
        'Publish/unpublish trainings',
        'View detailed analytics'
      ]
    }
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_routes: [
      '/api/auth/*',
      '/api/jobs/*',
      '/api/trainings/*',
      '/api/jobs/stats ',
      '/health',
      '/health/db',
      '/api'
    ],
    training_routes_hint: 'Use /api/trainings for training-related operations',
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

  // Training specific errors
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
  console.log(`   • Authentication: http://localhost:${PORT}/api/auth`);
  console.log(`   • Jobs: http://localhost:${PORT}/api/jobs`);
  console.log(`   • Training: http://localhost:${PORT}/api/trainings`);
  console.log(`\n🎓 Training Features:`);
  console.log(`   • Jobseekers: Enroll, track progress, submit reviews`);
  console.log(`   • Employers: Create, manage, publish trainings`);
  console.log(`\n🔐 Remember to include 'Authorization: Bearer <token>' header for protected routes`);
});

export default app;