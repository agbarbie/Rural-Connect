import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserManagementService } from '../services/user-management.service';
import { 
  UserManagementFilters, 
  UserActionRequest, 
  BulkActionRequest,
  UpdateUserRequest
} from '../types/user.management.types';

export class UserManagementController {
  private userManagementService: UserManagementService;

  constructor() {
    this.userManagementService = new UserManagementService();
  }

  /**
   * GET /api/admin/users
   * Get all users with filtering and pagination
   */
  getAllUsers = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      // Extract query parameters
      const filters: UserManagementFilters = {
        search: req.query.search as string as string,
        role: req.query.role as string as any,
        status: req.query.status as string as any,
        verification: req.query.verification as string as any,
        page: req.query.page as string ? parseInt(req.query.page as string as string) : 1,
        limit: req.query.limit as string ? parseInt(req.query.limit as string as string) : 10,
        sortBy: req.query.sortBy as string as string,
        sortOrder: req.query.sortOrder as string as 'asc' | 'desc'
      };

      // Get users and stats
      const [usersData, stats] = await Promise.all([
        this.userManagementService.getUsers(filters),
        this.userManagementService.getUserStats()
      ]);

      res.status(200).json({
        success: true,
        data: {
          users: usersData.users,
          stats,
          pagination: usersData.pagination
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      next(error);
    }
  };

  /**
   * GET /api/admin/users/stats
   * Get user statistics
   */
  getUserStats = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.userManagementService.getUserStats();

      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      next(error);
    }
  };

  /**
   * GET /api/admin/users/:id
   * Get detailed information about a specific user
   */
  getUserById = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.params.id as string;

      const userData = await this.userManagementService.getUserById(userId);

      if (!userData) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: userData
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      next(error);
    }
  };

  /**
   * PUT /api/admin/users/:id
   * Update user information
   */
  updateUser = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin ID not found'
        });
        return;
      }

      const updateData: UpdateUserRequest = req.body;

      const updatedUser = await this.userManagementService.updateUser(
        userId, 
        updateData, 
        adminId
      );

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('Update user error:', error);
      next(error);
    }
  };

  /**
   * POST /api/admin/users/:id/action
   * Perform action on a user (suspend, activate, verify, etc.)
   */
  performUserAction = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin ID not found'
        });
        return;
      }

      const { action, reason }: UserActionRequest = req.body;

      if (!action) {
        res.status(400).json({
          success: false,
          message: 'Action is required'
        });
        return;
      }

      const validActions = ['activate', 'deactivate', 'suspend', 'unsuspend', 'verify', 'reject', 'delete'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          message: `Invalid action. Valid actions are: ${validActions.join(', ')}`
        });
        return;
      }

      const updatedUser = await this.userManagementService.performUserAction(
        userId,
        action,
        adminId,
        reason
      );

      res.status(200).json({
        success: true,
        message: `Action '${action}' performed successfully`,
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('Perform user action error:', error);
      next(error);
    }
  };

  /**
   * POST /api/admin/users/bulk-action
   * Perform bulk action on multiple users
   */
  performBulkAction = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin ID not found'
        });
        return;
      }

      const { userIds, action, reason }: BulkActionRequest = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'userIds array is required and must not be empty'
        });
        return;
      }

      if (!action) {
        res.status(400).json({
          success: false,
          message: 'Action is required'
        });
        return;
      }

      const validActions = ['activate', 'deactivate', 'suspend', 'unsuspend', 'verify', 'reject', 'delete'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          message: `Invalid action. Valid actions are: ${validActions.join(', ')}`
        });
        return;
      }

      const results = await this.userManagementService.performBulkAction(
        userIds,
        action,
        adminId,
        reason
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Bulk action completed. Success: ${successCount}, Failed: ${failureCount}`,
        data: { results }
      });
    } catch (error) {
      console.error('Perform bulk action error:', error);
      next(error);
    }
  };

  /**
   * DELETE /api/admin/users/:id/permanent
   * Permanently delete a user (use with caution)
   */
  deleteUserPermanently = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({
          success: false,
          message: 'Admin ID not found'
        });
        return;
      }

      // Additional security check - require confirmation token
      const confirmationToken = req.body.confirmationToken;
      const expectedToken = req.body.expectedToken; // Should be userId hashed or similar

      if (!confirmationToken || confirmationToken !== expectedToken) {
        res.status(400).json({
          success: false,
          message: 'Invalid confirmation token. Permanent deletion requires confirmation.'
        });
        return;
      }

      await this.userManagementService.deleteUserPermanently(userId, adminId);

      res.status(200).json({
        success: true,
        message: 'User permanently deleted'
      });
    } catch (error) {
      console.error('Delete user permanently error:', error);
      next(error);
    }
  };

  /**
   * GET /api/admin/users/export
   * Export users data as CSV
   */
  exportUsers = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      // Extract filters (without pagination for export)
      const filters: UserManagementFilters = {
        search: req.query.search as string as string,
        role: req.query.role as string as any,
        status: req.query.status as string as any,
        verification: req.query.verification as string as any,
        limit: 10000 // Large limit for export
      };

      const usersData = await this.userManagementService.getUsers(filters);

      // Convert to CSV format
      const csvHeader = 'ID,Name,Email,Role,Status,Verification,Created,Location,Contact\n';
      const csvRows = usersData.users.map(user => 
        `"${user.id}","${user.name}","${user.email}","${user.role}","${user.status}","${user.verification}","${user.created.toISOString()}","${user.location || ''}","${user.contact_number || ''}"`
      ).join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      res.status(200).send(csv);
    } catch (error) {
      console.error('Export users error:', error);
      next(error);
    }
  };
}