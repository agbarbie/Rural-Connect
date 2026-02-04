// src/routes/candidates.routes.ts - FIXED ROUTE ORDERING

import { Router } from 'express';
import { CandidatesController } from '../controllers/candidates.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const candidatesController = new CandidatesController();

/**
 * All routes require authentication and employer role
 */
router.use(authenticate);
router.use(requireRole('employer'));

/**
 * 🔥 CRITICAL: Route ordering matters!
 * Specific routes MUST come BEFORE dynamic parameter routes
 * Otherwise /:userId will match everything including "/candidates"
 */

// 1️⃣ GET /api/employer/job-posts - MUST be first (most specific)
router.get(
  '/job-posts',
  candidatesController.getJobPosts.bind(candidatesController)
);

// 2️⃣ GET /api/employer/candidates - Get all candidates (specific route)
router.get(
  '/candidates',
  candidatesController.getCandidates.bind(candidatesController)
);

// 3️⃣ POST /api/employer/candidates/:userId/shortlist - Specific action routes
router.post(
  '/candidates/:userId/shortlist',
  candidatesController.toggleShortlist.bind(candidatesController)
);

// 4️⃣ POST /api/employer/candidates/:userId/invite - Specific action routes
router.post(
  '/candidates/:userId/invite',
  candidatesController.inviteCandidate.bind(candidatesController)
);

// 5️⃣ GET /api/employer/candidates/:userId - MUST be last (catches all other /candidates/*)
router.get(
  '/candidates/:userId',
  candidatesController.getCandidateProfile.bind(candidatesController)
);

console.log('✅ Candidates routes registered in correct order:');
console.log('  1. GET  /api/employer/job-posts');
console.log('  2. GET  /api/employer/candidates');
console.log('  3. POST /api/employer/candidates/:userId/shortlist');
console.log('  4. POST /api/employer/candidates/:userId/invite');
console.log('  5. GET  /api/employer/candidates/:userId');

export default router;