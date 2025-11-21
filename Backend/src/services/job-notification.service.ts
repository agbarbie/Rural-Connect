// src/services/job-notification.service.ts - COMPLETE FIX WITH ALL METHODS
import { Pool } from 'pg';
import pool from '../db/db.config';

export class JobNotificationService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * ✅ FIXED: Create a notification with better error handling
   */
 async createNotification(
  userId: string,
  type: string,
  message: string,
  metadata: any
): Promise<void> {
  try {
    const title = this.generateNotificationTitle(type, message);
    
    console.log('📬 Creating notification:', {
      userId,
      type,
      title,
      messagePreview: message.substring(0, 50)
    });

    // Verify user exists and get user type
    const userExists = await this.db.query(
      'SELECT id, user_type, email FROM users WHERE id = $1',
      [userId]
    );

    if (userExists.rows.length === 0) {
      console.error('❌ User not found:', userId);
      throw new Error(`User ${userId} not found`);
    }

    const user = userExists.rows[0];
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      userType: user.user_type
    });

    // Verify notification type is appropriate for user type
    if (user.user_type === 'employer' && type === 'application_received') {
      console.log('✅ Creating application_received notification for EMPLOYER');
    } else if (user.user_type === 'jobseeker' && type === 'application_received') {
      console.error('❌ ERROR: Attempting to create application_received for JOBSEEKER');
      throw new Error('Invalid notification type for jobseeker');
    }

    const relatedId = metadata?.job_id || 
                      metadata?.application_id || 
                      null;

    console.log('🔗 Notification data:', { 
      userId, 
      userType: user.user_type,
      type, 
      relatedId 
    });

    // Insert notification
    const result = await this.db.query(`
      INSERT INTO notifications (
        user_id, 
        type, 
        title, 
        message, 
        metadata, 
        related_id,
        created_at, 
        read
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, false)
      RETURNING id, user_id, type, title, read, created_at
    `, [
      userId, 
      type, 
      title, 
      message, 
      JSON.stringify(metadata),
      relatedId
    ]);

    const createdNotification = result.rows[0];
    console.log('✅ ✅ ✅ NOTIFICATION CREATED SUCCESSFULLY:', {
      notificationId: createdNotification.id,
      userId: createdNotification.user_id,
      type: createdNotification.type,
      title: createdNotification.title,
      read: createdNotification.read,
      createdAt: createdNotification.created_at
    });

    // VERIFY notification was actually created
    const verifyResult = await this.db.query(
      'SELECT id, user_id, type, read FROM notifications WHERE id = $1',
      [createdNotification.id]
    );

    if (verifyResult.rows.length > 0) {
      console.log('✅ ✅ VERIFICATION: Notification exists in database');
    } else {
      console.error('❌ ❌ CRITICAL: Notification NOT found in database after insert!');
    }

  } catch (error: any) {
    console.error('❌ CRITICAL: Error creating notification:', {
      error: error.message,
      code: error.code,
      detail: error.detail,
      userId,
      type,
      stack: error.stack
    });
    
    throw error; // Re-throw to ensure calling code knows notification failed
  }
}


  /**
   * Generate notification title based on type
   */
  private generateNotificationTitle(type: string, message: string): string {
    const titleMap: Record<string, string> = {
      'new_job': '💼 New Job Posted',
      'job_updated': '✏️ Job Updated',
      'job_deleted': '🗑️ Job Removed',
      'job_closed': '🔒 Job Closed',
      'job_filled': '✅ Job Filled',
      'application_received': '📨 New Application',
      'application_reviewed': '👀 Application Reviewed',
      'application_shortlisted': '⭐ You\'re Shortlisted!',
      'application_rejected': '❌ Application Update',
      'application_accepted': '🎉 Application Accepted!',
      'interview_scheduled': '📅 Interview Scheduled',
      'job_status_changed': '🔄 Job Status Changed'
    };
    return titleMap[type] || message.split('.')[0].substring(0, 255) || 'Job Update';
  }

  /**
   * 🔥 CRITICAL FIX: Notify employer about new application
   * Changed signature to accept employer_id directly from job
   */
async notifyEmployerAboutApplication(
  employerId: string,
  jobId: string,
  jobTitle: string,
  applicantName: string,
  applicationId: string
): Promise<void> {
  try {
    console.log('📢 ========================================');
    console.log('📢 NOTIFYING EMPLOYER ABOUT APPLICATION');
    console.log('📢 ========================================');
    console.log('📢 Input parameters:', {
      employerId,
      jobId,
      jobTitle,
      applicantName,
      applicationId
    });

    // Get employer's USER_ID from employer_id
    const employerQuery = await this.db.query(`
      SELECT e.id, e.user_id, u.email, u.first_name, u.last_name, u.user_type
      FROM employers e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [employerId]);

    if (employerQuery.rows.length === 0) {
      console.error('❌ Employer not found for employer_id:', employerId);
      throw new Error(`Employer ${employerId} not found`);
    }

    const employer = employerQuery.rows[0];
    const employerUserId = employer.user_id;

    console.log('✅ Found employer:', {
      employerId: employer.id,
      userId: employerUserId,
      email: employer.email,
      name: `${employer.first_name} ${employer.last_name}`,
      userType: employer.user_type
    });

    // Verify this is actually an employer user
    if (employer.user_type !== 'employer') {
      console.error('❌ User is not an employer:', employer.user_type);
      throw new Error('User is not an employer');
    }

    console.log('✅ User type verified: EMPLOYER');
    console.log('📬 Creating notification for employer user_id:', employerUserId);

    // Create notification for employer's USER_ID
    await this.createNotification(
      employerUserId,
      'application_received',
      `${applicantName} applied for ${jobTitle}`,
      {
        job_id: jobId,
        job_title: jobTitle,
        applicant_name: applicantName,
        application_id: applicationId,
        action: 'new_application',
        timestamp: new Date().toISOString()
      }
    );

    console.log('✅ ✅ ✅ EMPLOYER NOTIFICATION CREATED SUCCESSFULLY');
    console.log('📢 ========================================');
    
  } catch (error: any) {
    console.error('❌ ❌ ❌ CRITICAL: Failed to notify employer');
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      employerId,
      jobId
    });
    console.error('📢 ========================================');
    
    throw error; // Re-throw to ensure caller knows
  }
}

  /**
   * ✅ FIXED: Notify jobseeker about application status change
   */
  async notifyJobseekerAboutApplicationStatus(
    jobseekerId: string,
    jobId: string,
    jobTitle: string,
    status: string,
    applicationId: string,
    companyName?: string
  ): Promise<void> {
    try {
      console.log('📢 Notifying jobseeker about status change:', {
        jobseekerId,
        jobId,
        status
      });

      // Verify jobseeker exists
      const userCheck = await this.db.query(
        'SELECT id, user_type FROM users WHERE id = $1',
        [jobseekerId]
      );

      if (userCheck.rows.length === 0) {
        console.error('❌ Jobseeker not found:', jobseekerId);
        throw new Error(`Jobseeker ${jobseekerId} not found`);
      }

      if (userCheck.rows[0].user_type !== 'jobseeker') {
        console.error('❌ User is not a jobseeker:', userCheck.rows[0].user_type);
        throw new Error('User is not a jobseeker');
      }

      let notificationType: string;
      let message: string;

      switch (status) {
        case 'reviewed':
          notificationType = 'application_reviewed';
          message = `Your application for ${jobTitle} at ${companyName || 'the company'} is being reviewed`;
          break;
        case 'shortlisted':
          notificationType = 'application_shortlisted';
          message = `Congratulations! You've been shortlisted for ${jobTitle} at ${companyName || 'the company'}`;
          break;
        case 'rejected':
          notificationType = 'application_rejected';
          message = `Your application for ${jobTitle} at ${companyName || 'the company'} was not successful`;
          break;
        case 'accepted':
          notificationType = 'application_accepted';
          message = `Great news! Your application for ${jobTitle} at ${companyName || 'the company'} has been accepted`;
          break;
        default:
          notificationType = 'application_reviewed';
          message = `Application status updated for ${jobTitle}`;
      }

      await this.createNotification(
        jobseekerId,
        notificationType,
        message,
        {
          job_id: jobId,
          job_title: jobTitle,
          company_name: companyName,
          application_id: applicationId,
          status: status,
          action: 'status_change',
          timestamp: new Date().toISOString()
        }
      );

      console.log('✅ Jobseeker notification created successfully');
    } catch (error: any) {
      console.error('❌ Failed to notify jobseeker:', error);
      throw error;
    }
  }

  /**
   * ✅ Notify jobseekers about new job posting
   */
  async notifyJobseekersAboutNewJob(
    jobId: string,
    jobTitle: string,
    companyName: string,
    skills: string[],
    location: string,
    employmentType: string
  ): Promise<void> {
    try {
      console.log('📢 Finding relevant jobseekers for new job:', jobTitle);

      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      let notifiedCount = 0;

      while (hasMore) {
        const jobseekers = await this.db.query(`
          SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
          FROM users u
          LEFT JOIN user_profiles up ON u.id = up.user_id
          WHERE u.user_type = 'jobseeker' 
            AND u.deleted_at IS NULL
            AND u.is_active = true
            AND (
              up.skills && $1::text[]
              OR up.preferred_location ILIKE $2
              OR $3 = ANY(up.preferred_job_types)
            )
          ORDER BY u.id
          LIMIT $4 OFFSET $5
        `, [skills, `%${location}%`, employmentType, BATCH_SIZE, offset]);

        if (jobseekers.rows.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`📤 Processing batch: ${offset + 1} to ${offset + jobseekers.rows.length}`);

        const message = `New job opportunity: ${jobTitle} at ${companyName}`;
        const metadata = {
          job_id: jobId,
          job_title: jobTitle,
          company_name: companyName,
          location: location,
          employment_type: employmentType
        };

        await Promise.all(
          jobseekers.rows.map(jobseeker =>
            this.createNotification(jobseeker.id, 'new_job', message, metadata)
              .catch((err: any) => console.error(`Failed to notify ${jobseeker.id}:`, err))
          )
        );

        notifiedCount += jobseekers.rows.length;
        offset += BATCH_SIZE;
        
        if (jobseekers.rows.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      console.log(`✅ Notified ${notifiedCount} relevant jobseekers about new job`);
    } catch (error: any) {
      console.error('❌ Error notifying jobseekers:', error);
    }
  }

  /**
   * ✅ Notify jobseekers who saved a job about updates
   */
  async notifyJobseekersSavedJob(
    jobId: string,
    jobTitle: string,
    updateType: 'updated' | 'deleted' | 'closed' | 'filled'
  ): Promise<void> {
    try {
      console.log(`📢 Notifying jobseekers who saved job: ${jobTitle}`);

      const savedUsers = await this.db.query(`
        SELECT DISTINCT u.id, u.first_name, u.last_name
        FROM job_bookmarks jb
        JOIN users u ON jb.user_id = u.id
        WHERE jb.job_id = $1
          AND u.user_type = 'jobseeker'
          AND u.deleted_at IS NULL
      `, [jobId]);

      console.log(`✅ Found ${savedUsers.rows.length} users who saved this job`);

      let notificationType: string;
      let message: string;

      switch (updateType) {
        case 'updated':
          notificationType = 'job_updated';
          message = `"${jobTitle}" has been updated`;
          break;
        case 'deleted':
          notificationType = 'job_deleted';
          message = `"${jobTitle}" has been removed`;
          break;
        case 'closed':
          notificationType = 'job_closed';
          message = `"${jobTitle}" is no longer accepting applications`;
          break;
        case 'filled':
          notificationType = 'job_filled';
          message = `"${jobTitle}" position has been filled`;
          break;
      }

      await Promise.all(
        savedUsers.rows.map(user =>
          this.createNotification(
            user.id,
            notificationType,
            message,
            {
              job_id: jobId,
              job_title: jobTitle,
              action: updateType
            }
          ).catch((err: any) => console.error(`Failed to notify ${user.id}:`, err))
        )
      );

      console.log('✅ All users notified about job update');
    } catch (error: any) {
      console.error('❌ Error notifying saved job users:', error);
    }
  }

  /**
   * ✅ FIXED: Get notifications filtered by user type
   */
  async getNotifications(
    userId: string,
    params: { read?: boolean | string; page?: number; limit?: number }
  ): Promise<any> {
    const { page = 1, limit = 10, read } = params;
    const offset = (page - 1) * limit;

    console.log('🔔 Getting notifications:', { userId, page, limit, read });

    try {
      // Get user type
      const userTypeResult = await this.db.query(
        'SELECT user_type FROM users WHERE id = $1',
        [userId]
      );

      if (userTypeResult.rows.length === 0) {
        console.error('❌ User not found:', userId);
        return {
          notifications: [],
          pagination: { current_page: page, total_pages: 0, total_count: 0 }
        };
      }

      const userType = userTypeResult.rows[0].user_type;
      console.log('👤 User type:', userType);

      // Define allowed notification types by user role
      let allowedNotificationTypes: string[] = [];

      if (userType === 'employer') {
        allowedNotificationTypes = [
          'application_received',
          'job_updated',
          'job_deleted',
          'job_closed',
          'job_filled'
        ];
      } else if (userType === 'jobseeker') {
        allowedNotificationTypes = [
          'new_job',
          'job_updated',
          'job_deleted',
          'job_closed',
          'job_filled',
          'application_reviewed',
          'application_shortlisted',
          'application_rejected',
          'application_accepted',
          'interview_scheduled'
        ];
      }

      console.log('✅ Allowed types:', allowedNotificationTypes);

      let whereClause = 'WHERE user_id = $1';
      const queryParams: any[] = [userId];
      let paramIndex = 2;

      // Filter by allowed types
      if (allowedNotificationTypes.length > 0) {
        whereClause += ` AND type = ANY($${paramIndex}::text[])`;
        queryParams.push(allowedNotificationTypes);
        paramIndex++;
      }

      // Read filter
      if (read !== undefined) {
        const readBool = (read === true || read === 'true');
        whereClause += ` AND read = $${paramIndex++}`;
        queryParams.push(readBool);
      }

      const query = `
        SELECT
          id, user_id, type, title, message, metadata,
          related_id, read, created_at,
          COUNT(*) OVER() AS total_count
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      queryParams.push(limit, offset);

      console.log('🔍 Query:', query);
      console.log('🔍 Params:', queryParams);

      const result = await this.db.query(query, queryParams);
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

      console.log('✅ Fetched:', {
        count: result.rows.length,
        unread: result.rows.filter(r => !r.read).length,
        total: totalCount,
        userType
      });

      return {
        notifications: result.rows.map(row => ({
          id: row.id,
          user_id: row.user_id,
          type: row.type,
          title: row.title,
          message: row.message,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
          related_id: row.related_id,
          read: row.read,
          created_at: row.created_at
        })),
        pagination: {
          current_page: page,
          total_pages: Math.ceil(totalCount / limit),
          total_count: totalCount
        }
      };
    } catch (error: any) {
      console.error('❌ Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.db.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [userId]
    );
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }
}