import { Router } from 'express';
import { UserManagementController } from '../controllers/user.management.controller';
import { authenticate } from '../middleware/auth.middleware';
import { 
  requireAdmin, 
  logAdminAction, 
  preventSelfAction,
  validateBulkActionPermissions 
} from '../middleware/admin.middleware';
import asyncHandler from '../middleware/asyncHandler';

const router = Router();
const userManagementController = new UserManagementController();

// Apply authentication and admin requirement to all routes
router.use(authenticate);
router.use(requireAdmin);
router.use(logAdminAction); // Log all admin actions

// Debug route registration
console.log('Registering admin user management routes:');
console.log('- GET /api/admin/users');
console.log('- GET /api/admin/users/stats');
console.log('- GET /api/admin/users/export');
console.log('- GET /api/admin/users/:id');
console.log('- PUT /api/admin/users/:id');
console.log('- POST /api/admin/users/:id/action');
console.log('- POST /api/admin/users/bulk-action');
console.log('- DELETE /api/admin/users/:id/permanent');

/**
 * GET /api/admin/users/stats
 * Get user statistics for dashboard
 * Must come before /:id route to avoid route conflict
 */
router.get(
  '/stats',
  asyncHandler(userManagementController.getUserStats)
);

/**
 * GET /api/admin/users/export
 * Export users data as CSV
 * Must come before /:id route to avoid route conflict
 */
router.get(
  '/export',
  asyncHandler(userManagementController.exportUsers)
);

/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
 * Query params: search, role, status, verification, page, limit, sortBy, sortOrder
 */
router.get(
  '/',
  asyncHandler(userManagementController.getAllUsers)
);

/**
 * GET /api/admin/users/:id
 * Get detailed information about a specific user
 */
router.get(
  '/:id',
  asyncHandler(userManagementController.getUserById)
);

/**
 * PUT /api/admin/users/:id
 * Update user information
 * Body: { name?, email?, role?, status?, verification?, location?, contact_number? }
 */
router.put(
  '/:id',
  preventSelfAction('id'), // Prevent admin from modifying their own account
  asyncHandler(userManagementController.updateUser)
);

/**
 * POST /api/admin/users/:id/action
 * Perform action on a user (suspend, activate, verify, etc.)
 * Body: { action: string, reason?: string }
 * Valid actions: activate, deactivate, suspend, unsuspend, verify, reject, delete
 */
router.post(
  '/:id/action',
  preventSelfAction('id'), // Prevent admin from performing actions on themselves
  asyncHandler(userManagementController.performUserAction)
);

/**
 * POST /api/admin/users/bulk-action
 * Perform bulk action on multiple users
 * Body: { userIds: string[], action: string, reason?: string }
 * Valid actions: activate, deactivate, suspend, unsuspend, verify, reject, delete
 */
router.post(
  '/bulk-action',
  validateBulkActionPermissions, // Validate bulk action
  asyncHandler(userManagementController.performBulkAction)
);

/**
 * DELETE /api/admin/users/:id/permanent
 * Permanently delete a user (use with extreme caution)
 * Body: { confirmationToken: string, expectedToken: string }
 * Requires double confirmation to prevent accidental deletions
 */
router.delete(
  '/:id/permanent',
  preventSelfAction('id'), // Prevent admin from deleting their own account
  asyncHandler(userManagementController.deleteUserPermanently)
);

export default router;