import pool from '../db/db.config';
import { 
  UserManagementFilters, 
  UserManagementResponse, 
  UserStats,
  ActivityLog,
  UpdateUserRequest
} from '../types/user.management.types';
import { validate as isValidUUID } from 'uuid';

export class UserManagementService {
  
  /**
   * Get all users with filtering, pagination, and search
   */
  async getUsers(filters: UserManagementFilters) {
    try {
      const {
        search = '',
        role = 'All Roles',
        status = 'All Status',
        verification = 'All Verification',
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = filters;

      // Build WHERE clause
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Exclude soft-deleted users unless specifically looking for inactive
      if (status !== 'Inactive' && status !== 'All Status') {
        conditions.push(`u.deleted_at IS NULL`);
      }

      // Search filter
      if (search) {
        conditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      // Role filter
      if (role !== 'All Roles') {
        conditions.push(`u.user_type = $${paramIndex}`);
        values.push(role.toLowerCase());
        paramIndex++;
      }

      // Status filter - now using account_status column
      if (status !== 'All Status') {
        conditions.push(`u.account_status = $${paramIndex}`);
        values.push(status.toLowerCase());
        paramIndex++;
      }

      // Verification filter - now using verification_status column
      if (verification !== 'All Verification') {
        conditions.push(`u.verification_status = $${paramIndex}`);
        values.push(verification.toLowerCase());
        paramIndex++;
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';

      // Count total users matching filters
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, values);
      const totalUsers = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalUsers / limit);
      const offset = (page - 1) * limit;

      // Get users with pagination
      const allowedSortColumns = ['created_at', 'name', 'email', 'user_type', 'account_status', 'updated_at'];
      const sanitizedSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sanitizedSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      const usersQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.user_type as role,
          u.account_status as status,
          u.verification_status as verification,
          u.created_at as created,
          u.location,
          u.contact_number,
          u.updated_at as last_login,
          u.profile_picture as avatar,
          u.first_name,
          u.last_name,
          u.company_name,
          u.deleted_at
        FROM users u
        ${whereClause}
        ORDER BY u.${sanitizedSortBy} ${sanitizedSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const usersResult = await pool.query(usersQuery, values);

      // Transform to match frontend expectations
      const users: UserManagementResponse[] = usersResult.rows.map(row => ({
        id: row.id,
        name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown',
        email: row.email,
        role: this.mapUserType(row.role),
        status: this.capitalizeFirst(row.status),
        created: new Date(row.created),
        verification: this.capitalizeFirst(row.verification),
        avatar: row.avatar,
        location: row.location,
        contact_number: row.contact_number,
        last_login: row.last_login ? new Date(row.last_login) : undefined
      }));

      return {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          limit
        }
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Get user statistics for dashboard
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_users,
          COUNT(*) FILTER (WHERE account_status = 'active' AND deleted_at IS NULL) as active_users,
          COUNT(*) FILTER (WHERE verification_status = 'pending' AND deleted_at IS NULL) as pending_verification,
          COUNT(*) FILTER (WHERE account_status = 'suspended' AND deleted_at IS NULL) as suspended_accounts
        FROM users
      `;

      const result = await pool.query(statsQuery);
      const stats = result.rows[0];

      // Calculate percentage changes
      const changes = await this.calculateStatsChanges();

      return {
        totalUsers: parseInt(stats.total_users) || 0,
        activeUsers: parseInt(stats.active_users) || 0,
        pendingVerification: parseInt(stats.pending_verification) || 0,
        suspendedAccounts: parseInt(stats.suspended_accounts) || 0,
        totalUsersChange: changes.totalUsersChange,
        activeUsersChange: changes.activeUsersChange,
        pendingVerificationChange: changes.pendingVerificationChange,
        suspendedAccountsChange: changes.suspendedAccountsChange
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw new Error('Failed to fetch user statistics');
    }
  }

  /**
   * Get detailed information about a specific user
   */
  async getUserById(userId: string) {
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      const userQuery = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.user_type,
          u.account_status,
          u.verification_status,
          u.created_at,
          u.updated_at,
          u.location,
          u.contact_number,
          u.profile_picture as avatar_url,
          u.first_name,
          u.last_name,
          u.company_name,
          u.role_in_company,
          u.deleted_at
        FROM users u
        WHERE u.id = $1
      `;

      const result = await pool.query(userQuery, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      // Get role-specific profile data
      let profile = null;
      if (user.user_type === 'jobseeker') {
        profile = await this.getJobseekerProfile(userId);
      } else if (user.user_type === 'employer') {
        profile = await this.getEmployerProfile(userId);
        if (profile) {
          profile.company_name = user.company_name;
          profile.role_in_company = user.role_in_company;
        }
      }

      // Get activity log
      const activityLog = await this.getUserActivityLog(userId);

      return {
        user: {
          id: user.id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          role: this.mapUserType(user.user_type),
          status: this.capitalizeFirst(user.account_status),
          created: new Date(user.created_at),
          verification: this.capitalizeFirst(user.verification_status),
          avatar: user.avatar_url,
          location: user.location,
          contact_number: user.contact_number,
          last_login: user.updated_at ? new Date(user.updated_at) : undefined
        },
        profile,
        activityLog
      };
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw new Error('Failed to fetch user details');
    }
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, updateData: UpdateUserRequest, adminId: string) {
    const client = await pool.connect();
    
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name) {
        updates.push(`name = $${paramIndex}`);
        values.push(updateData.name);
        paramIndex++;
      }

      if (updateData.email) {
        updates.push(`email = $${paramIndex}`);
        values.push(updateData.email);
        paramIndex++;
      }

      if (updateData.role) {
        updates.push(`user_type = $${paramIndex}`);
        values.push(updateData.role.toLowerCase());
        paramIndex++;
      }

      if (updateData.status) {
        updates.push(`account_status = $${paramIndex}`);
        values.push(updateData.status.toLowerCase());
        paramIndex++;
      }

      if (updateData.verification) {
        updates.push(`verification_status = $${paramIndex}`);
        values.push(updateData.verification.toLowerCase());
        paramIndex++;
      }

      if (updateData.location) {
        updates.push(`location = $${paramIndex}`);
        values.push(updateData.location);
        paramIndex++;
      }

      if (updateData.contact_number) {
        updates.push(`contact_number = $${paramIndex}`);
        values.push(updateData.contact_number);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new Error('No valid update fields provided');
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const updateQuery = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Log the action
      await this.logActivity(client, {
        user_id: userId,
        action: 'user_updated',
        details: `User information updated by admin`,
        performed_by: adminId
      });

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Perform action on a single user (suspend, activate, verify, etc.)
   */
  async performUserAction(
    userId: string, 
    action: string, 
    adminId: string, 
    reason?: string
  ) {
    const client = await pool.connect();
    
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      await client.query('BEGIN');

      let updateQuery: string;
      let actionDescription: string;

      switch (action) {
        case 'activate':
          updateQuery = `
            UPDATE users 
            SET account_status = 'active', deleted_at = NULL, updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = 'User activated';
          break;
        
        case 'deactivate':
          updateQuery = `
            UPDATE users 
            SET account_status = 'inactive', updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = 'User deactivated';
          break;
        
        case 'suspend':
          updateQuery = `
            UPDATE users 
            SET account_status = 'suspended', updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = `User suspended${reason ? ': ' + reason : ''}`;
          break;
        
        case 'unsuspend':
          updateQuery = `
            UPDATE users 
            SET account_status = 'active', deleted_at = NULL, updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = 'User suspension lifted';
          break;
        
        case 'verify':
          updateQuery = `
            UPDATE users 
            SET verification_status = 'verified', updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = 'User verified';
          break;
        
        case 'reject':
          updateQuery = `
            UPDATE users 
            SET verification_status = 'rejected', updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = `Verification rejected${reason ? ': ' + reason : ''}`;
          break;
        
        case 'delete':
          // Soft delete
          updateQuery = `
            UPDATE users 
            SET account_status = 'inactive', deleted_at = NOW(), updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
          `;
          actionDescription = `User soft deleted${reason ? ': ' + reason : ''}`;
          break;
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const result = await client.query(updateQuery, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Log the action
      await this.logActivity(client, {
        user_id: userId,
        action,
        details: actionDescription,
        performed_by: adminId
      });

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error performing user action:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Perform bulk action on multiple users
   */
  async performBulkAction(
    userIds: string[], 
    action: string, 
    adminId: string, 
    reason?: string
  ) {
    // Validate all user IDs first
    if (!userIds.every(id => isValidUUID(id))) {
      throw new Error('Invalid user ID format in bulk action');
    }

    const results = [];

    // Process each user
    for (const userId of userIds) {
      try {
        const result = await this.performUserAction(userId, action, adminId, reason);
        results.push({ userId, success: true, user: result });
        console.log(`✓ Bulk action '${action}' successful for user ${userId}`);
      } catch (error) {
        console.error(`✗ Bulk action '${action}' failed for user ${userId}:`, error);
        results.push({ 
          userId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Log bulk action summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    console.log(`Bulk action '${action}' completed: ${successCount} succeeded, ${failureCount} failed`);

    return results;
  }

  /**
   * Delete user permanently (use with caution)
   */
  async deleteUserPermanently(userId: string, adminId: string) {
    const client = await pool.connect();
    
    try {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID format');
      }

      await client.query('BEGIN');

      // Log before deletion
      await this.logActivity(client, {
        user_id: userId,
        action: 'user_permanently_deleted',
        details: 'User permanently deleted by admin',
        performed_by: adminId
      });

      // Delete from role-specific tables first (to handle foreign keys)
      try {
        await client.query('DELETE FROM jobseekers WHERE user_id = $1', [userId]);
      } catch (e) {
        console.log('No jobseeker profile to delete');
      }
      
      try {
        await client.query('DELETE FROM employers WHERE user_id = $1', [userId]);
      } catch (e) {
        console.log('No employer profile to delete');
      }
      
      // Delete from users table
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      await client.query('COMMIT');

      console.log(`✓ User ${userId} permanently deleted`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error permanently deleting user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper methods

  private async getJobseekerProfile(userId: string) {
    try {
      const query = `SELECT * FROM jobseekers WHERE user_id = $1`;
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  private async getEmployerProfile(userId: string) {
    try {
      const query = `SELECT * FROM employers WHERE user_id = $1`;
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      return null;
    }
  }

  private async getUserActivityLog(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          action,
          details,
          performed_by,
          created_at as timestamp
        FROM activity_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      
      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      // Activity logs might not exist yet
      return [];
    }
  }

  private async logActivity(
    client: any, 
    data: { user_id: string; action: string; details: string; performed_by: string }
  ) {
    try {
      const query = `
        INSERT INTO activity_logs (user_id, action, details, performed_by, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await client.query(query, [data.user_id, data.action, data.details, data.performed_by]);
      console.log(`✓ Activity logged: ${data.action} for user ${data.user_id}`);
    } catch (error) {
      // Don't fail the whole operation if logging fails
      console.log('Activity logging skipped (table may not exist)');
    }
  }

  private async calculateStatsChanges() {
    // Mock data - implement with historical tracking if needed
    return {
      totalUsersChange: 12,
      activeUsersChange: 8,
      pendingVerificationChange: 15,
      suspendedAccountsChange: -3
    };
  }

  private mapUserType(userType: string): 'Admin' | 'Employer' | 'Jobseeker' {
    switch (userType.toLowerCase()) {
      case 'admin':
        return 'Admin';
      case 'employer':
        return 'Employer';
      case 'jobseeker':
        return 'Jobseeker';
      default:
        return 'Jobseeker';
    }
  }

  private capitalizeFirst(str: string): any {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}