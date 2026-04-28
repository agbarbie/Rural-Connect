// index.ts - UPDATED with Meeting Routes Documentation
import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import jobRoutes from "./routes/jobs.routes";
import { createTrainingRoutes } from "./routes/Training.routes";
import { createNotificationRoutes } from "./routes/notification.routes";
import cvBuilderRoutes from "./routes/cv-builder.routes";
import portfolioRoutes from "./routes/portfolio.routes";
import profileRoutes from "./routes/profile.routes";
import geminiRoutes from "./routes/gemini.routes";
import candidatesRoutes from "./routes/candidates.routes";
import userManagementRoutes from "./routes/user-management.routes";
import ratingRoutes from "./routes/rating.routes";
import meetingRoutes from "./routes/meeting.routes";
import pool from "./db/db.config";
import path from "path";


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// Debug database connection values
console.log("DB Connection Debug:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD type:", typeof process.env.DB_PASSWORD);
console.log("DB_PASSWORD length:", process.env.DB_PASSWORD?.length);
console.log("DB_PORT:", process.env.DB_PORT);

// Validate required environment variables
const requiredEnvVars = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
] as const;
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error("Missing required environment variables:", missingEnvVars);
  console.error("Please ensure you have the following in your .env file:");
  console.error("- DB_HOST, DB_NAME, DB_USER, DB_PASSWORD");
  console.error("- JWT_SECRET");
  process.exit(1);
}

// Test database connection on startup
pool
  .connect()
  .then(async (client) => {
    console.log("Database connected successfully");

    // Test basic queries to ensure tables exist
    try {
      await client.query("SELECT 1 FROM users LIMIT 1");
      console.log("✓ Users table accessible");

      await client.query("SELECT 1 FROM jobs LIMIT 1");
      console.log("✓ Jobs table accessible");

      await client.query("SELECT 1 FROM job_applications LIMIT 1");
      console.log("✓ Job applications table accessible");

      // Test training-related tables (BOOTCAMP MODEL)
      await client.query("SELECT 1 FROM trainings LIMIT 1");
      console.log("✓ Trainings table accessible");

      await client.query("SELECT 1 FROM training_sessions LIMIT 1");
      console.log("✓ Training sessions table accessible");

      await client.query("SELECT 1 FROM training_applications LIMIT 1");
      console.log("✓ Training applications table accessible");

      await client.query("SELECT 1 FROM training_enrollments LIMIT 1");
      console.log("✓ Training enrollments table accessible");

      await client.query("SELECT 1 FROM certificate_verifications LIMIT 1");
      console.log("✓ Certificate verifications table accessible");

      await client.query("SELECT 1 FROM training_reviews LIMIT 1");
      console.log("✓ Training reviews table accessible");

      await client.query("SELECT 1 FROM training_outcomes LIMIT 1");
      console.log("✓ Training outcomes table accessible");

      // Test portfolio-related tables
      await client.query("SELECT 1 FROM portfolio_settings LIMIT 1");
      console.log("✓ Portfolio settings table accessible");

      await client.query("SELECT 1 FROM portfolio_views LIMIT 1");
      console.log("✓ Portfolio views table accessible");

      await client.query("SELECT 1 FROM portfolio_testimonials LIMIT 1");
      console.log("✓ Portfolio testimonials table accessible");

      // Test candidates-related tables
      await client.query("SELECT 1 FROM shortlisted_candidates LIMIT 1");
      console.log("✓ Shortlisted candidates table accessible");

      await client.query("SELECT 1 FROM job_invitations LIMIT 1");
      console.log("✓ Job invitations table accessible");

      await client.query("SELECT 1 FROM notifications LIMIT 1");
      console.log("✓ Notifications table accessible");

      await client.query("SELECT 1 FROM ratings LIMIT 1");
      console.log("✓ Ratings table accessible");

      // Test activity logs table
      try {
        await client.query("SELECT 1 FROM activity_logs LIMIT 1");
        console.log("✓ Activity logs table accessible");
      } catch (activityLogError) {
        console.warn(
          "⚠ Activity logs table not found - run migration script for admin features"
        );
      }

      // Test CV table
      try {
        await client.query("SELECT 1 FROM cvs LIMIT 1");
        console.log("✓ CVs table accessible");
      } catch (cvError) {
        console.warn("⚠ CVs table not found - may need migration");
      }

    } catch (tableError: any) {
      console.warn("Database tables might need migration:", tableError.message);
      console.warn(
        "Please run the database migration script to ensure all tables exist"
      );

      const expectedTables = [
        "users",
        "jobs",
        "job_applications",
        "trainings",
        "training_sessions",
        "training_applications",
        "training_outcomes",
        "training_enrollments",
        "certificate_verifications",
        "training_reviews",
        "cvs",
        "portfolio_settings",
        "portfolio_views",
        "portfolio_testimonials",
        "shortlisted_candidates",
        "job_invitations",
        "notifications",
        "ratings",
        "activity_logs",
      ];
      console.warn("Expected tables:", expectedTables.join(", "));
      console.warn("\n⚠️ OLD TABLES REMOVED (video-based model):");
      console.warn("- training_videos (REMOVED)");
      console.warn("- training_video_progress (REMOVED)");
    }

    client.release();
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
    });
    console.error(
      "\nPlease check your database configuration and ensure PostgreSQL is running"
    );
    process.exit(1);
  });

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:4200",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:8080",
    "https://rural-connect-frontend-511q.onrender.com",
  ],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  optionsSuccessStatus: 200,
};

if (process.env.FRONTEND_URL && !corsOptions.origin.includes(process.env.FRONTEND_URL)) {
  corsOptions.origin.push(process.env.FRONTEND_URL);
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});


// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);

  if (req.headers.authorization) {
    console.log("Authorization header present");
  }

  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    ["password", "token", "secret"].forEach((field) => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = "[REDACTED]";
      }
    });
    console.log("Request body:", sanitizedBody);
  }

  next();
});

// Status code validation middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalStatus = res.status;
  res.status = function (code: any) {
    if (typeof code !== "number" || isNaN(code) || code < 100 || code > 599) {
      console.error(
        `Invalid status code detected: ${code} for ${req.method} ${req.url}`
      );
      console.error("Stack trace:", new Error("Invalid status code").stack);
      return originalStatus.call(this, 500).json({
        success: false,
        message: "Internal server error: Invalid status code provided",
        endpoint: `${req.method} ${req.url}`,
        invalidCode: code,
        timestamp: new Date().toISOString(),
      });
    }
    return originalStatus.call(this, code);
  };
  next();
});

// Static file serving
app.use("/uploads/cvs", express.static(path.join(__dirname, "../uploads/cvs")));
app.use(
  "/uploads/profile-images",
  express.static(path.join(__dirname, "../uploads/profile-images"))
);
app.use(
  "/uploads/certificates",
  express.static(path.join(__dirname, "../uploads/certificates"))
);
app.use(
  "/uploads/training-thumbnails",
  express.static(path.join(__dirname, "../uploads/training-thumbnails"))
);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Debug route registration
console.log("Registering routes:");
console.log("- Auth routes: /api/auth/*");
console.log("- Job routes: /api/jobs/*");
console.log("- Training routes (BOOTCAMP MODEL): /api/trainings/*");
console.log("  ↳ sessions:    /sessions/:sessionId/iframe  (GET) - Employer iframe URL");
console.log("  ↳ sessions:    /sessions/:sessionId/join    (GET) - Join session URL");
console.log("  ↳ attendance:  /:id/sessions/:sessionId/attendance  (POST/GET)");
console.log("- Notification routes: /api/notifications/*");
console.log("- CV Builder routes: /api/cv/*");
console.log("- Portfolio routes: /api/portfolio/*");
console.log("- Profile routes: /api/profile/*");
console.log("- Gemini AI routes: /api/gemini/*");
console.log("- Employer candidates routes: /api/employer/*");
console.log("- Admin user management routes: /api/admin/users/*");
console.log("- Rating routes: /api/ratings/*");

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/trainings", createTrainingRoutes(pool));
app.use("/api/notifications", createNotificationRoutes(pool));
app.use("/api/cv", cvBuilderRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/employer", candidatesRoutes);
app.use("/api/admin/users", userManagementRoutes);
app.use("/api/ratings", ratingRoutes);

console.log("- Meeting routes: /api/meetings/*");
console.log("  ↳ create:     POST   /api/meetings/create - Create meeting (employer)");
console.log("  ↳ join:       GET    /api/meetings/:meetingId/join - Join meeting");
console.log("  ↳ details:    GET    /api/meetings/:meetingId - Get meeting details");
console.log("  ↳ end:        POST   /api/meetings/:meetingId/end - End meeting (employer)");

// Add this with your other app.use() statements
app.use("/api/meetings", meetingRoutes);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Job Portal API Server - BOOTCAMP TRAINING MODEL with Jitsi Integration",
    version: "2.1.0",
    endpoints: {
      auth: "/api/auth",
      jobs: "/api/jobs",
      trainings: "/api/trainings",
      notifications: "/api/notifications",
      cv: "/api/cv",
      portfolio: "/api/portfolio",
      profile: "/api/profile",
      gemini: "/api/gemini",
      employer: "/api/employer",
      admin_users: "/api/admin/users",
      ratings: "/api/ratings",
      health: "/health",
      database_health: "/health/db",
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: PORT,
    uptime: process.uptime(),
  });
});

// Database health check
app.get("/health/db", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const result = await pool.query(
      "SELECT NOW() as current_time, version() as postgres_version"
    );
    const responseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      message: "Database connection is healthy",
      timestamp: new Date().toISOString(),
      db_time: result.rows[0].current_time,
      postgres_version: result.rows[0].postgres_version,
      response_time_ms: responseTime,
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// API documentation endpoint
app.get("/api", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Job Portal API Documentation - BOOTCAMP TRAINING MODEL with Jitsi",
    version: "2.1.0",
    endpoints: {
      authentication: {
        base: "/api/auth",
        routes: [
          "POST /api/auth/register",
          "POST /api/auth/login",
          "POST /api/auth/logout",
          "GET /api/auth/profile",
          "PUT /api/auth/profile",
        ],
      },
      jobs: {
        base: "/api/jobs",
        public_routes: [
          "GET /api/jobs - Get all jobs (with filters)",
          "GET /api/jobs/details/:jobId - Get job details",
          "GET /api/jobs/stats",
        ],
        jobseeker_routes: [
          "GET /api/jobs/jobseeker/recommended - Get recommended jobs",
          "POST /api/jobs/jobseeker/bookmark/:jobId - Save job",
          "DELETE /api/jobs/jobseeker/bookmark/:jobId - Unsave job",
          "GET /api/jobs/jobseeker/bookmarked - Get saved jobs",
          "POST /api/jobs/jobseeker/apply/:jobId - Apply to job",
          "GET /api/jobs/jobseeker/applications - Get applications",
          "GET /api/jobs/jobseeker/stats - Get jobseeker statistics",
        ],
        employer_routes: [
          "POST /api/jobs - Create job",
          "GET /api/jobs/my-jobs - Get employer jobs",
          "PUT /api/jobs/employer/:jobId - Update job",
          "DELETE /api/jobs/employer/:jobId - Delete job",
          "GET /api/jobs/employer/:jobId/applications - Get job applications",
        ],
      },
      trainings: {
        base: "/api/trainings",
        model: "BOOTCAMP - Application-based with live sessions (Jitsi Integration)",
        public_routes: [
          "GET /api/trainings - Browse all published trainings",
          "GET /api/trainings/:id - Get training details",
          "GET /api/trainings/categories/list - Get training categories",
          "GET /api/trainings/popular/list - Get popular trainings",
          "GET /api/trainings/:id/reviews - Get training reviews",
          "GET /api/trainings/certificates/verify/:code - Verify certificate",
          "GET /api/trainings/meeting/:trainingId/:sessionId/:roomCode - Validate meeting room",
        ],
        session_routes: [
          "GET /api/trainings/sessions/:sessionId/iframe - Get iframe URL for employer (moderator)",
          "GET /api/trainings/sessions/:sessionId/join - Get join URL for participant/moderator",
        ],
        jobseeker_routes: [
          "POST /api/trainings/:id/apply - Apply for training",
          "GET /api/trainings/enrolled/list - Get enrolled trainings",
          "POST /api/trainings/:id/reviews - Submit review",
          "GET /api/trainings/jobseeker/stats - Get training statistics",
          "GET /api/trainings/recommended/list - Get recommended trainings",
        ],
        employer_routes: [
          "POST /api/trainings - Create new training",
          "PUT /api/trainings/:id - Update training",
          "DELETE /api/trainings/:id - Delete training",
          "PATCH /api/trainings/:id/status - Update training status",
          "GET /api/trainings/:id/applications - Get applications",
          "GET /api/trainings/:trainingId/applications/:applicationId/profile - Get applicant profile",
          "POST /api/trainings/:trainingId/applications/:applicationId/shortlist - Shortlist/reject applicant",
          "POST /api/trainings/:trainingId/applications/:applicationId/enroll - Enroll shortlisted applicant",
          "GET /api/trainings/:id/enrollments - Get enrollments",
          "PUT /api/trainings/:trainingId/enrollments/:enrollmentId/completion - Mark completion",
          "POST /api/trainings/:trainingId/enrollments/:enrollmentId/certificate - Issue certificate",
          "GET /api/trainings/stats/overview - Get training stats",
          "GET /api/trainings/:id/analytics - Get training analytics",
          "POST /api/trainings/:id/sessions/:sessionId/attendance - Mark attendance for session",
          "GET /api/trainings/:id/sessions/:sessionId/attendance - Get attendance for session",
        ],
        features: [
          "Application-based enrollment (no self-enrollment)",
          "Employer shortlisting and selection",
          "Live training sessions with auto-generated Jitsi meeting links",
          "Integrated video conferencing (Jitsi Meet)",
          "No external platform needed (Zoom/Google Meet)",
          "Employer iframe embed for starting meetings",
          "Participant join URLs with automatic role detection",
          "Employer-marked completion",
          "Digital certificate issuance",
          "Certificate verification with unique codes",
          "Training reviews and ratings",
          "Session attendance tracking",
          "Advanced analytics and statistics",
        ],
        workflow: [
          "1. Employer posts training opportunity",
          "2. Jobseekers apply with motivation",
          "3. Employer reviews and shortlists applicants",
          "4. Employer enrolls shortlisted applicants",
          "5. System auto-generates unique Jitsi meeting links for each session",
          "6. Live training sessions conducted via Jitsi (embedded in platform)",
          "7. Employer marks attendance per session",
          "8. Employer marks completion status",
          "9. Certificates issued to successful trainees",
          "10. Certificates verifiable via unique code",
        ],
      },
      notifications: {
        base: "/api/notifications",
        routes: [
          "GET /api/notifications - Get user notifications (supports ?read=false)",
          "PATCH /api/notifications/:id/read - Mark notification as read",
        ],
        authentication: "Required - All authenticated users",
        description: "Unified notification system for training updates, applications, certificates, and more",
      },
      cv_builder: {
        base: "/api/cv",
        routes: [
          "POST /api/cv/create - Create new CV",
          "GET /api/cv/my-cvs - Get all user CVs",
          "GET /api/cv/:id - Get specific CV",
          "PUT /api/cv/:id - Update CV",
          "DELETE /api/cv/:id - Delete CV",
          "POST /api/cv/upload - Upload CV file",
          "POST /api/cv/:id/draft - Save as draft",
          "POST /api/cv/:id/final - Save as final",
          "GET /api/cv/:id/export/pdf - Export to PDF",
          "GET /api/cv/:id/export/docx - Export to Word",
        ],
        authentication: "Required - Jobseeker role only",
      },
      portfolio: {
        base: "/api/portfolio",
        jobseeker_routes: [
          "GET /api/portfolio/my-portfolio - Get user portfolio data",
          "GET /api/portfolio/settings - Get portfolio settings",
          "PUT /api/portfolio/settings - Update portfolio settings",
          "GET /api/portfolio/analytics - Get portfolio analytics",
          "GET /api/portfolio/export-pdf - Export portfolio as PDF",
          "POST /api/portfolio/testimonials - Add testimonial",
          "DELETE /api/portfolio/testimonials/:testimonialId - Delete testimonial",
        ],
        public_routes: [
          "GET /api/portfolio/public/:identifier - Get public portfolio by user ID or email",
        ],
        authentication: "Required for protected routes - Jobseeker role only",
      },
      profile: {
        base: "/api/profile",
        routes: [
          "GET /api/profile - Get current user profile",
          "PATCH /api/profile - Update current user profile",
          "GET /api/profile/cv/:cvId - Get profile by specific CV ID",
          "GET /api/profile/completion - Get profile completion status",
          "PUT /api/profile/picture - Update profile picture",
          "POST /api/profile/share - Generate shareable profile link",
          "GET /api/profile/shared/:token - Get shared profile (public access)",
        ],
        authentication: "Required for most routes - Jobseeker role only",
      },
      gemini: {
        base: "/api/gemini",
        routes: [
          "GET /api/gemini/recommendations - Get initial career recommendations",
          "POST /api/gemini/chat - Send chat message to Gemini AI",
          "GET /api/gemini/jobs - Get job recommendations with filters",
          "GET /api/gemini/skill-gaps - Get skill gap analysis",
          "GET /api/gemini/career-path - Get career path recommendations",
          "POST /api/gemini/simulate-skill - Simulate adding a skill",
          "POST /api/gemini/feedback - Submit feedback on AI recommendations",
        ],
        authentication: "Required - Jobseeker role only",
      },
      employer: {
        base: "/api/employer",
        routes: [
          "GET /api/employer/candidates - Get all candidates",
          "GET /api/employer/job-posts - Get job posts with stats",
          "GET /api/employer/candidates/:userId - Get candidate profile",
          "POST /api/employer/candidates/:userId/shortlist - Shortlist candidate",
          "POST /api/employer/candidates/:userId/invite - Send invite",
        ],
        authentication: "Required - Employer role only",
      },
      admin_users: {
        base: "/api/admin/users",
        routes: [
          "GET /api/admin/users - Get all users",
          "GET /api/admin/users/stats - Get user statistics",
          "GET /api/admin/users/export - Export users as CSV",
          "GET /api/admin/users/:id - Get user details",
          "PUT /api/admin/users/:id - Update user",
          "POST /api/admin/users/:id/action - Perform action on user",
          "POST /api/admin/users/bulk-action - Bulk action",
          "DELETE /api/admin/users/:id/permanent - Permanently delete user",
        ],
        authentication: "Required - Admin role only",
      },
      ratings: {
        base: "/api/ratings",
        routes: [
          "POST /api/ratings - Submit rating",
          "GET /api/ratings/:entityType/:entityId - Get ratings",
        ],
      },
    },
    authentication: {
      type: "Bearer Token",
      header: "Authorization: Bearer <token>",
      note: "Include JWT token for protected routes",
      user_types: {
        jobseeker:
          "Apply for trainings, enroll after shortlisting, complete trainings, receive certificates, join training sessions",
        employer:
          "Create trainings, review applications, shortlist trainees, mark completion, issue certificates, mark attendance, start meetings as moderator",
        admin:
          "Full system access including user management and platform administration",
      },
    },
    meeting_integration: {
      platform: "Jitsi Meet",
      features: [
        "Auto-generated meeting rooms per session",
        "Secure password-protected rooms",
        "Moderator privileges for employers",
        "Iframe embedding for seamless integration",
        "No external accounts needed",
        "Full video/audio conferencing",
        "Screen sharing capabilities",
        "Chat and collaboration tools",
      ],
    },
  });
});

// 404 handler
app.all("*", (req: Request, res: Response) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_routes: [
      "/api/auth/*",
      "/api/jobs/*",
      "/api/trainings/*",
      "/api/trainings/sessions/:sessionId/iframe",
      "/api/trainings/sessions/:sessionId/join",
      "/api/notifications/*",
      "/api/cv/*",
      "/api/portfolio/*",
      "/api/profile/*",
      "/api/gemini/*",
      "/api/employer/*",
      "/api/admin/users/*",
      "/api/ratings/*",
      "/health",
      "/health/db",
      "/api",
    ],
    timestamp: new Date().toISOString(),
  });
});

// Global error handling middleware
app.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  console.error("Unhandled error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  if (error.code && error.code.startsWith("28")) {
    res.status(500).json({
      success: false,
      message: "Database connection error",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Token expired",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation error",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.code === "23505") {
    res.status(409).json({
      success: false,
      message: "Resource already exists",
      details: "This operation conflicts with existing data",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (error.code === "23503") {
    res.status(400).json({
      success: false,
      message: "Invalid reference",
      details: "Referenced resource does not exist",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && {
      error: error.message,
      stack: error.stack,
    }),
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  try {
    await pool.end();
    console.log("Database connections closed.");

    setTimeout(() => {
      console.log("Server shutdown complete.");
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Job Portal API Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`💾 Database health: http://localhost:${PORT}/health/db`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(` • Authentication: http://localhost:${PORT}/api/auth`);
  console.log(` • Jobs: http://localhost:${PORT}/api/jobs`);
  console.log(` • Training (BOOTCAMP + Jitsi): http://localhost:${PORT}/api/trainings`);
  console.log(` • Notifications: http://localhost:${PORT}/api/notifications`);
  console.log(` • CV Builder: http://localhost:${PORT}/api/cv`);
  console.log(` • Portfolio: http://localhost:${PORT}/api/portfolio`);
  console.log(` • Profile: http://localhost:${PORT}/api/profile`);
  console.log(` • Gemini AI: http://localhost:${PORT}/api/gemini`);
  console.log(` • Employer Candidates: http://localhost:${PORT}/api/employer`);
  console.log(` • Admin User Management: http://localhost:${PORT}/api/admin/users`);
  console.log(` • Ratings: http://localhost:${PORT}/api/ratings`);
  console.log(`\n🎥 Meeting Integration:`);
  console.log(` • Platform: Jitsi Meet (Open Source)`);
  console.log(` • Employer Iframe: GET /api/trainings/sessions/:id/iframe`);
  console.log(` • Join Session: GET /api/trainings/sessions/:id/join`);
  console.log(` • Auto-generated meeting links with passwords`);
  console.log(` • No external accounts needed`);
  console.log(`\n🎓 Features:`);
  console.log(
    ` • Jobseekers: CV building, portfolio, job applications, training applications, join live sessions`
  );
  console.log(
    ` • Employers: Job postings, training creation, applicant shortlisting, attendance marking, completion marking, certificate issuance, start meetings`
  );
  console.log(
    ` • Admins: User management, platform administration, activity monitoring`
  );
  console.log(
    ` • Training: Application-based bootcamp model with auto-generated Jitsi meeting links, live sessions, attendance & certificates`
  );
  console.log(
    ` • Portfolio: Public/private portfolios with analytics and PDF export`
  );
  console.log(
    ` • AI Assistant: Personalized career guidance powered by Gemini AI`
  );
  console.log(
    `\n🔐 Remember to include 'Authorization: Bearer <token>' header for protected routes`
  );
});

export default app;